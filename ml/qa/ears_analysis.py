"""Analysis shared by the EARS QA report: integrity checks, DOH consistency, news comparison."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ml"))
import clean_dengue  # noqa: E402
import ears  # noqa: E402

E = pd.read_excel(REPO / "data/processed/dengue_ears.xlsx", sheet_name=None)
SRC = pd.read_excel(REPO / "data/processed/dengue_cases_combined.xlsx", sheet_name=None)
nat, loc = E["NATIONAL"], E["LOCAL"]
ELEVATED = {"alert", "epidemic"}
DOH_OK = {"normal", "alert", "epidemic"}


# ---------------- integrity ----------------
def recompute(g):
    """Plain re-implementation of C1-C3 used only to cross-check ears.py."""
    g = g.sort_values("period_start").reset_index(drop=True)
    y = g.value.astype(float).values
    use = ((g.data_quality == "ok") & g.data_flag.isna()).values
    ok = (g.data_quality == "ok").values
    c = {1: np.full(len(g), np.nan), 2: np.full(len(g), np.nan)}
    for t in range(len(g)):
        if not ok[t]:
            continue
        for m, lag in ((1, 1), (2, 3)):
            lo = t - lag - 6
            if lo < 0:
                continue
            b = [y[i] for i in range(lo, t - lag + 1) if use[i]]
            if len(b) >= 5:
                c[m][t] = (y[t] - np.mean(b)) / max(np.std(b, ddof=1), 1.0)
    c3 = np.full(len(g), np.nan)
    for t in range(2, len(g)):
        w = c[2][t - 2:t + 1]
        if ok[t] and not np.isnan(w).any():
            c3[t] = np.maximum(0, w - 1).sum()
    return g.assign(r1=c[1], r2=c[2], r3=c3)


def integrity():
    checks = {}
    checks["rows"] = (len(nat) == len(SRC["NATIONAL"]), len(loc) == len(SRC["LOCAL"]))
    sample = pd.concat([recompute(nat)] + [recompute(g) for _, g in loc.groupby("geography_name")])
    diffs = 0
    for a, b in (("c1_stat", "r1"), ("c2_stat", "r2"), ("c3_stat", "r3")):
        both_nan = sample[a].isna() & sample[b].isna()
        close = (sample[a] - sample[b]).abs() <= 0.011
        diffs += int((~(both_nan | close)).sum())
    checks["recompute_rows"], checks["recompute_diffs"] = len(sample), diffs
    allowed = set(ears.COMBOS) | {"none", "not computed"}
    allrows = pd.concat([nat, loc])
    checks["labels_valid"] = bool(allrows.ears_alarm.isin(allowed).all())
    bad = 0
    for m, thr in (("c1", 3), ("c2", 3), ("c3", 2)):
        a = allrows[f"{m}_alarm"] == True  # noqa: E712
        bad += int((a & ~((allrows[f"{m}_stat"] > thr) & (allrows.value >= 5))).sum())
    checks["alarm_rule_violations"] = bad
    checks["alarms_on_non_ok"] = int(((allrows.data_quality != "ok") & ~allrows.ears_alarm.isin(["not computed"])).sum())
    fl = allrows.data_flag.notna()
    checks["flag_note_coverage"] = (int((fl & allrows.flag_note.fillna("").str.contains("current week flagged")).sum()), int(fl.sum()))
    # label consistent with alarm columns
    def lab(r):
        f = [m.upper() for m in ("c1", "c2", "c3") if r[f"{m}_alarm"] == True]  # noqa: E712
        comp = [m for m in ("c1", "c2", "c3") if pd.notna(r[f"{m}_alarm"])]
        return "not computed" if not comp else ("+".join(f) if f else "none")
    checks["label_mismatch"] = int((allrows.apply(lab, axis=1) != allrows.ears_alarm).sum())
    return checks


# ---------------- DOH consistency ----------------
def comparable(df):
    return df[(df.epi_year >= 2019) & df.doh_status.isin(DOH_OK) & (df.ears_alarm != "not computed")].copy()


def agreement(df):
    c = comparable(df)
    e = c.ears_alarm != "none"
    d = c.doh_status.isin(ELEVATED)
    tp, fp, fn, tn = int((e & d).sum()), int((e & ~d).sum()), int((~e & d).sum()), int((~e & ~d).sum())
    n = tp + fp + fn + tn
    po = (tp + tn) / n
    pe = ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / n ** 2
    return dict(n=n, tp=tp, fp=fp, fn=fn, tn=tn, agree=po, kappa=(po - pe) / (1 - pe),
                ears_given_doh=tp / (tp + fn) if tp + fn else np.nan,
                doh_given_ears=tp / (tp + fp) if tp + fp else np.nan,
                xtab=pd.crosstab(c.ears_alarm, c.doh_status).reindex(
                    index=["none"] + ears.COMBOS, columns=["normal", "alert", "epidemic"], fill_value=0))


def episodes(df, keys):
    """DOH epidemic episodes (2+ consecutive epidemic weeks) and EARS timing around their onset."""
    rows = []
    for k, g in df.groupby(keys):
        g = g.sort_values("period_start").reset_index(drop=True)
        epi = g.doh_status.eq("epidemic").values
        t = 0
        while t < len(g):
            if epi[t]:
                s = t
                while t < len(g) and epi[t]:
                    t += 1
                if t - s >= 2:
                    on = g.period_start.iat[s]
                    win = g[(g.period_start >= on - pd.Timedelta(weeks=8)) & (g.period_start <= g.period_start.iat[t - 1])]
                    al = win[~win.ears_alarm.isin(["none", "not computed"])]
                    first = al.period_start.min() if len(al) else pd.NaT
                    rows.append(dict(series=k if isinstance(k, str) else k[-1], onset=on, weeks=t - s,
                                     first_alarm=first,
                                     lead=(on - first).days // 7 if pd.notna(first) else np.nan))
            else:
                t += 1
    return pd.DataFrame(rows)


# ---------------- regions (aggregated from local) ----------------
def regional():
    src = SRC["LOCAL"]
    src = src.assign(value=src.value.where(src.data_quality == "ok"))  # suspect swap rows count as missing
    g = (src.groupby(["region", "period_start"])
            .agg(value=("value", lambda v: v.sum() if v.notna().all() else np.nan),
                 flagged=("data_flag", lambda f: f.notna().any()))
            .reset_index())
    g["geographic_level"] = "regional"
    g["value"] = g["value"].astype("Int64")
    g["data_quality"] = np.where(g.value.isna(), "missing", "ok")
    g["data_flag"] = None  # place-level flags are diluted in a regional sum
    g = clean_dengue.add_doh_thresholds(g, keys=["region"])
    r = ears.run(g, ["region"])
    return r


NEWS_REGION = {  # DOH classification announced 15/07/2019 (ABS-CBN, Inquirer)
    "REGION IV-B-MIMAROPA": "epidemic", "REGION VI-WESTERN VISAYAS": "epidemic",
    "REGION VII-CENTRAL VISAYAS": "epidemic", "REGION X-NORTHERN MINDANAO": "epidemic",
    "REGION I-ILOCOS REGION": "alert", "REGION II-CAGAYAN VALLEY": "alert",
    "REGION IV-A-CALABARZON": "alert", "REGION V-BICOL REGION": "alert",
    "REGION VIII-EASTERN VISAYAS": "alert", "REGION IX-ZAMBOANGA PENINSULA": "alert",
    "REGION XI-DAVAO REGION": "alert", "BARMM": "alert", "CAR": "alert",
}


def region_table(r):
    wk = pd.Timestamp("2019-07-14")  # epi week containing 15/07/2019
    rows = []
    for reg, g in r.groupby("region"):
        g = g[(g.period_start >= "2019-03-01") & (g.period_start <= wk)]
        al = g[~g.ears_alarm.isin(["none", "not computed"])]
        ep = g[g.doh_status == "epidemic"]
        at = g[g.period_start == wk].iloc[0]
        rows.append(dict(region=reg, news=NEWS_REGION.get(reg, "not named"),
                         doh_calc=at.doh_status, ears_by_jul15=len(al) > 0,
                         first_ears=al.period_start.min(), first_combo=al.ears_alarm.iloc[0] if len(al) else "",
                         first_doh_epi=ep.period_start.min()))
    order = {"epidemic": 0, "alert": 1, "not named": 2}
    return pd.DataFrame(rows).sort_values(["news", "region"], key=lambda s: s.map(order) if s.name == "news" else s)


NEWS_PLACES = [  # place, event, date, source key
    ("ILOILO CITY", "outbreak declared", "2019-07-05", "shimbun"),
    ("CAPIZ", "outbreak declared", "2019-07-12", "shimbun"),
    ("GUIMARAS", "outbreak declared", "2019-07-12", "shimbun"),
    ("ILOILO", "state of calamity", "2019-07-16", "inq_iloilo"),
    ("ZAMBOANGA SIBUGAY", "state of calamity", "2019-07-17", "inq_sibugay"),
    ("ILOILO CITY", "state of calamity", "2019-07-26", "ptv_iloilo"),
]


def place_table():
    rows = []
    for pl, ev, d, src in NEWS_PLACES:
        g = loc[(loc.geography_name == pl) & (loc.period_start >= "2019-03-01") & (loc.period_start <= "2019-09-30")]
        al = g[~g.ears_alarm.isin(["none", "not computed"])]
        ep = g[g.doh_status == "epidemic"]
        fa = al.period_start.min()
        rows.append(dict(place=pl, event=ev, date=pd.Timestamp(d), first_ears=fa,
                         combo=al.ears_alarm.iloc[0] if len(al) else "",
                         first_doh_epi=ep.period_start.min(),
                         lead=(pd.Timestamp(d) - fa).days // 7 if pd.notna(fa) else np.nan))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    pd.set_option("display.width", 250)
    print(integrity())
    for nm, df in (("national", nat), ("local", loc)):
        a = agreement(df); x = a.pop("xtab"); print(nm, {k: round(v, 3) if isinstance(v, float) else v for k, v in a.items()}); print(x)
    print(nat[(nat.epi_year == 2019)].query("doh_status=='epidemic'").period_start.min())
    ep = episodes(loc, ["region", "geography_name"]); print(len(ep), ep.lead.notna().mean(), ep.lead.median(), ep.lead.describe())
    print(episodes(nat, ["geographic_level"]))
    r = regional(); print(region_table(r).to_string())
    print(place_table().to_string())
