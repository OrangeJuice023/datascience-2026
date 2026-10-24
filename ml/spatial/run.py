"""Run the spatial analysis: method doc §4.2 steps 3-7 and the §4.4 validation.

    cd ml && python -m spatial.run

Output (local, git-ignored): data/processed/spatial/
  weights_units.csv      W1-W3 neighbour lists per reporting unit
  global_moran.csv       weekly Moran's I of C2 per variant / level / weights / transform
  local_clusters.csv     weekly local Moran + Gi* per unit (cluster_class is the map category)
  knox.csv               Knox space-time test of EARS alarm-episode starts
  lead_times.csv         aggregate threshold episodes vs first local / aggregate EARS alarm
  lead_background.csv    how often the same lead-time rule fires outside any episode
  negative_control.csv   the clustering tests with unit locations shuffled
  summary.json           every number the report quotes

Choices fixed before the results were computed (method doc §4.6):
- statistic: C2 (each unit against its own baseline), never raw counts
- a week is analysed only when at least MIN_COVERAGE of units have C2; a unit
  whose neighbours all lack C2 that week is dropped, neighbours are not replaced
- significance: 999 permutations, Benjamini-Hochberg at ALPHA over weeks
  (global) or over units within a week (local)
- "high-signal cluster" / "isolated high signal" also need the unit's own
  C2 > HIGH_C2 (C3 counts only C2 above 1 as excess), so a unit merely above
  a low weekly mean is not called high
- no parameter is tuned: 2016-2018 and 2019-2021 are both reported, and
  2019-2021 was not used to choose anything
"""

import json
import sys

import numpy as np
import pandas as pd

from . import panel, paths, stats, weights

PERMS = 999
NULL_PERMS = 199
SHUFFLES = 20
SEED = 20261024
MIN_COVERAGE = 0.8
ALPHA = 0.05
HIGH_C2 = 1.0
KNOX_MAX_DT = 2
LOOKBACK = 8
PERIODS = {"2016-2018": (2016, 2018), "2019-2021": (2019, 2021)}
SEASON_MONTHS = (6, 7, 8, 9, 10, 11)  # June-November (planning/SIGMA_RESEARCH.md §9B)
CLASSES = ("high-signal cluster", "isolated high signal", "not significant")


def epi_years(weeks: pd.DatetimeIndex) -> np.ndarray:
    return (weeks + pd.Timedelta(days=3)).year.to_numpy()


def _subset(w: np.ndarray, ok: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Weights among units with a value; drop units left without neighbours."""
    idx = np.flatnonzero(ok)
    sub = w[np.ix_(idx, idx)]
    keep = sub.sum(axis=1) > 0
    return idx[keep], sub[np.ix_(keep, keep)]


def _rank(x: np.ndarray) -> np.ndarray:
    return pd.Series(x).rank().to_numpy()


# ---------------------------------------------------------------- step 4: global Moran
def global_series(c2, w, weeks, rng, perms=PERMS, transform="raw") -> pd.DataFrame:
    min_units = int(np.ceil(MIN_COVERAGE * len(c2)))
    rows = []
    for t, wk in enumerate(weeks):
        ok = ~np.isnan(c2[:, t])
        row = dict(week=wk, n_units=int(ok.sum()), moran_i=np.nan, p=np.nan)
        if ok.sum() >= min_units:
            idx, sub = _subset(w, ok)
            x = c2[idx, t] if transform == "raw" else _rank(c2[idx, t])
            row["moran_i"], row["p"] = stats.moran_global(x, sub, perms, rng)
        rows.append(row)
    df = pd.DataFrame(rows)
    df["q"] = stats.bh_fdr(df.p.to_numpy())
    return df


# ---------------------------------------------------------------- step 5: local clusters
def local_series(c2, w, weeks, ids, rng) -> pd.DataFrame:
    min_units = int(np.ceil(MIN_COVERAGE * len(c2)))
    parts = []
    for t, wk in enumerate(weeks):
        ok = ~np.isnan(c2[:, t])
        if ok.sum() < min_units:
            continue
        idx, sub = _subset(w, ok)
        x = c2[idx, t]
        r = stats.local_stats(x, sub, PERMS, rng)
        df = pd.DataFrame(dict(week=wk, unit_id=np.asarray(ids)[idx], c2=x,
                               neighbour_mean=r["lag"] + x.mean(), lisa=r["lisa"], p_lisa=r["p_lisa"],
                               gi=r["gi"], p_gi=r["p_gi"]))
        df["q_lisa"] = stats.bh_fdr(df.p_lisa.to_numpy())
        df["q_gi"] = stats.bh_fdr(df.p_gi.to_numpy())
        high_self = x > x.mean()
        high_nb = r["lag"] > 0
        df["quadrant"] = np.select([high_self & high_nb, high_self & ~high_nb, ~high_self & high_nb],
                                   ["HH", "HL", "LH"], "LL")
        sig = df.q_lisa <= ALPHA
        high = df.c2 > HIGH_C2
        df["cluster_class"] = np.select([sig & high & df.quadrant.eq("HH"), sig & high & df.quadrant.eq("HL")],
                                        CLASSES[:2], CLASSES[2])
        df["gi_hot_spot"] = (df.q_gi <= ALPHA) & (df.gi > 0) & high
        parts.append(df)
    return pd.concat(parts, ignore_index=True)


# ---------------------------------------------------------------- step 6: Knox
def knox_runs(alarm, weeks, close, rng, perms=PERMS) -> list[dict]:
    eps = panel.alarm_episodes(alarm)
    u = np.array([e[0] for e in eps])
    t = np.array([e[1] for e in eps])
    yr = epi_years(weeks)[t]
    out = []
    for period, (a, b) in {"all": (2016, 2021), **PERIODS}.items():
        m = (yr >= a) & (yr <= b)
        for null, strata in (("all weeks", None), ("within epi year", yr[m])):
            r = stats.knox(u[m], t[m], close, KNOX_MAX_DT, perms, rng, strata)
            out.append(dict(period=period, null=null, **r))
    return out


# ---------------------------------------------------------------- step 7: local vs aggregate lead time
# An onset counts only when the week before it was evaluated and below the threshold;
# otherwise (thresholds start in 2019, the nationwide gap at 2019-01-06) the start is censored.
BELOW = {"epidemic": {"normal", "alert"}, "alert or epidemic": {"normal"}}
STATUSES = {"epidemic": {"epidemic"}, "alert or epidemic": {"alert", "epidemic"}}
OFF_SEASON = (12, 1, 2, 3, 4, 5)
CALIBRATION = (2016, 2018)
CAL_QUANTILE = 0.95
# DOH announcements (ml/qa/ears_analysis.py, docs/dengue-pipeline.md): the national
# HDX-sum series has no observed threshold onset, so the national comparison uses these.
ANNOUNCED = {"DOH national alert announced 15/07/2019": "2019-07-14",
             "DOH national epidemic declared 06/08/2019": "2019-08-04"}
ANNOUNCED_FROM = "2019-03-03"  # same season start as ears_analysis.region_table


def calibrated_k(count: np.ndarray, weeks: pd.DatetimeIndex) -> int:
    """Units alarming in the same week that off-season 2016-2018 weeks exceed only 5% of the time."""
    yrs = epi_years(weeks)
    cal = (yrs >= CALIBRATION[0]) & (yrs <= CALIBRATION[1]) & np.isin(weeks.month, OFF_SEASON)
    return int(np.quantile(count[cal], CAL_QUANTILE))


def _lead_row(st, lo, en, weeks, agg_alarm, agg_known, count, k_cal, m_alarm) -> dict:
    def first(mask):
        hit = np.flatnonzero(mask[lo:en + 1])
        return lo + int(hit[0]) if len(hit) else None

    found = dict(aggregate=first(agg_alarm), local1=first(count >= 1), local2=first(count >= 2),
                 local_cal=first(count > k_cal))
    before = found["aggregate"] if found["aggregate"] is not None else en + 1
    row = dict(window_weeks=en + 1 - lo, aggregate_weeks_computed=int(agg_known[lo:en + 1].sum()), k_cal=k_cal,
               members_alarmed_before_aggregate=int(m_alarm[:, lo:before].any(axis=1).sum()))
    for name, t in found.items():
        row[f"{name}_first"] = weeks[t] if t is not None else pd.NaT
        row[f"{name}_lead"] = st - t if t is not None else np.nan
    return row


def lead_times(local, u, mats, variant) -> tuple[list[dict], list[dict]]:
    ids, weeks = u.unit_id.tolist(), mats["weeks"]
    pos = {x: i for i, x in enumerate(ids)}
    years = epi_years(weeks)
    region = u.set_index("unit_id").analysis_region_id
    levels = {"region": region, "national": pd.Series("national", index=region.index)}
    rows, background = [], []
    for level, group_of in levels.items():
        agg = panel.aggregate(local, group_of, level)
        for key, s in agg.groupby("group"):
            s = s.sort_values("period_start").reset_index(drop=True)
            assert (pd.DatetimeIndex(s.period_start) == weeks).all()
            agg_alarm = (~s.ears_alarm.isin(panel.NO_SIGNAL)).to_numpy()
            agg_known = s.ears_alarm.ne("not computed").to_numpy()
            members = [pos[x] for x in group_of[group_of == key].index]
            m_alarm = mats["alarm"][members]
            count = m_alarm.sum(axis=0)
            k_cal = calibrated_k(count, weeks)
            base = dict(variant=variant, level=level, group=key, members=len(members))
            for threshold, statuses in STATUSES.items():
                eps = panel.threshold_episodes(s, statuses)
                covered = np.zeros(len(weeks), bool)
                for st, en in eps:
                    covered[max(0, st - LOOKBACK):en + 1] = True
                for st, en in eps:
                    observed = st > 0 and s.doh_status.iat[st - 1] in BELOW[threshold]
                    rows.append(dict(**base, threshold=threshold, onset=weeks[st], end=weeks[en],
                                     episode_weeks=en - st + 1, onset_observed=observed,
                                     **_lead_row(st, max(0, st - LOOKBACK), en, weeks,
                                                 agg_alarm, agg_known, count, k_cal, m_alarm)))
                # The same rules outside any episode: how often would they "warn" anyway?
                cand = [t for t in range(LOOKBACK, len(weeks))
                        if years[t] >= 2019 and not covered[t - LOOKBACK:t + 1].any()]
                win = [slice(t - LOOKBACK, t + 1) for t in cand]

                def hit(mask):
                    return float(np.mean([mask[w].any() for w in win])) if cand else np.nan

                background.append(dict(**base, threshold=threshold, k_cal=k_cal, windows=len(cand),
                                       aggregate_hit=hit(agg_alarm), local1_hit=hit(count >= 1),
                                       local2_hit=hit(count >= 2), local_cal_hit=hit(count > k_cal)))
            if level == "national":
                lo = int(np.searchsorted(weeks, pd.Timestamp(ANNOUNCED_FROM)))
                for event, wk in ANNOUNCED.items():
                    st = int(np.searchsorted(weeks, pd.Timestamp(wk)))
                    rows.append(dict(**base, threshold=event, onset=weeks[st], end=weeks[st], episode_weeks=np.nan,
                                     onset_observed=True,
                                     **_lead_row(st, lo, st, weeks, agg_alarm, agg_known, count, k_cal, m_alarm)))
    return rows, background


# ---------------------------------------------------------------- summaries
def global_summary(df: pd.DataFrame) -> dict:
    yrs = epi_years(pd.DatetimeIndex(df.week))
    months = pd.DatetimeIndex(df.week).month
    out = {}
    for name, m in {"all": np.ones(len(df), bool),
                    **{p: (yrs >= a) & (yrs <= b) for p, (a, b) in PERIODS.items()},
                    "2019 season": (yrs == 2019) & np.isin(months, SEASON_MONTHS),
                    "other seasons": (yrs != 2019) & np.isin(months, SEASON_MONTHS)}.items():
        d = df[m & df.moran_i.notna().to_numpy()]
        out[name] = dict(weeks=len(d), significant=int((d.q <= ALPHA).sum()),
                         share_significant=round(float((d.q <= ALPHA).mean()), 3) if len(d) else None,
                         median_i=round(float(d.moran_i.median()), 3) if len(d) else None)
    return out


def local_summary(df: pd.DataFrame) -> dict:
    yrs = epi_years(pd.DatetimeIndex(df.week))
    out = {}
    for name, (a, b) in {"all": (2016, 2021), **PERIODS}.items():
        d = df[(yrs >= a) & (yrs <= b)]
        out[name] = dict(unit_weeks=len(d), **{c: int((d.cluster_class == c).sum()) for c in CLASSES},
                         gi_hot_spots=int(d.gi_hot_spot.sum()),
                         hot_spots_also_high_cluster=int((d.gi_hot_spot & d.cluster_class.eq(CLASSES[0])).sum()),
                         weeks_with_any_cluster=int(d[d.cluster_class == CLASSES[0]].week.nunique()))
    return out


def lead_summary(lt: pd.DataFrame, bg: pd.DataFrame) -> dict:
    out = {}
    eps = lt[lt.level.eq("region") & lt.onset_observed]
    for (variant, threshold), d in eps.groupby(["variant", "threshold"]):
        b = bg[(bg.variant == variant) & (bg.level == "region") & (bg.threshold == threshold)]
        row = dict(episodes=len(d), censored_excluded=int(((lt.variant == variant) & (lt.threshold == threshold)
                                                          & lt.level.eq("region") & ~lt.onset_observed).sum()),
                   k_cal_median=float(b.k_cal.median()))
        for rule in ("aggregate", "local1", "local2", "local_cal"):
            row[rule] = dict(found=int(d[f"{rule}_lead"].notna().sum()),
                             median_lead=float(d[f"{rule}_lead"].median()) if d[f"{rule}_lead"].notna().any() else None,
                             background_hit=round(float(b[f"{rule}_hit"].mean()), 3))
            if rule != "aggregate":
                both = d.dropna(subset=["aggregate_lead", f"{rule}_lead"])
                diff = both[f"{rule}_lead"] - both.aggregate_lead
                row[rule].update(earlier=int((diff > 0).sum()), same=int((diff == 0).sum()), later=int((diff < 0).sum()),
                                 only_local=int((d.aggregate_lead.isna() & d[f"{rule}_lead"].notna()).sum()),
                                 median_gain=float(diff.median()) if len(diff) else None)
        out[f"{variant}|{threshold}"] = row
    nat = lt[lt.level.eq("national")]
    out["national"] = [dict(variant=r.variant, threshold=r.threshold, onset=str(r.onset.date()),
                            onset_observed=bool(r.onset_observed), k_cal=int(r.k_cal),
                            aggregate_first=str(r.aggregate_first.date()) if pd.notna(r.aggregate_first) else None,
                            local_cal_first=str(r.local_cal_first.date()) if pd.notna(r.local_cal_first) else None,
                            aggregate_lead=r.aggregate_lead, local_cal_lead=r.local_cal_lead)
                       for r in nat.itertuples()]
    return out


def kappa(a: pd.Series, b: pd.Series) -> float:
    cats = sorted(set(a) | set(b))
    t = pd.crosstab(a, b).reindex(index=cats, columns=cats, fill_value=0).to_numpy(float)
    n = t.sum()
    po, pe = np.trace(t) / n, (t.sum(0) @ t.sum(1)) / n ** 2
    return float((po - pe) / (1 - pe)) if pe < 1 else np.nan


def weights_agreement(local: pd.DataFrame) -> dict:
    piv = local.pivot_table(index=["week", "unit_id"], columns="weights", values="cluster_class", aggfunc="first").dropna()
    out = {}
    for other in ("W2", "W3"):
        a, b = piv["W1"] == CLASSES[0], piv[other] == CLASSES[0]
        out[f"W1_vs_{other}"] = dict(unit_weeks=len(piv), kappa=round(kappa(piv["W1"], piv[other]), 3),
                                     high_cluster_W1=int(a.sum()), high_cluster_other=int(b.sum()),
                                     high_cluster_both=int((a & b).sum()))
    return out


def plausibility(local_w1: pd.DataFrame, g_w1: pd.DataFrame, loc_regions: pd.Series) -> dict:
    sys.path.insert(0, str(paths.REPO / "ml" / "qa"))
    from ears_analysis import NEWS_PLACES, NEWS_REGION  # noqa: E402  (DOH classification, 15/07/2019)

    d = local_w1[(local_w1.week >= "2019-05-01") & (local_w1.week <= "2019-07-14")]
    in_cluster = d[d.cluster_class == CLASSES[0]].unit_id.unique()
    reg = loc_regions.reset_index()
    reg["in_cluster"] = reg.unit_id.isin(in_cluster)
    reg["news"] = reg.region.map(NEWS_REGION).fillna("not named")
    regions = (reg.groupby("news").agg(regions=("region", "nunique"), units=("unit_id", "size"),
                                       units_in_cluster=("in_cluster", "sum")).reset_index())
    regions["share"] = (regions.units_in_cluster / regions.units).round(3)
    places = []
    name_to_unit = loc_regions.reset_index().set_index("geography_name").unit_id
    for place, event, date, _ in NEWS_PLACES:
        uid, end = name_to_unit[place], pd.Timestamp(date)
        h = local_w1[(local_w1.unit_id == uid) & (local_w1.week <= end) & (local_w1.week > end - pd.Timedelta(weeks=8))]
        places.append(dict(place=place, event=event, date=date,
                           weeks_high_cluster=int((h.cluster_class == CLASSES[0]).sum()),
                           weeks_isolated_high=int((h.cluster_class == CLASSES[1]).sum()),
                           weeks_evaluated=len(h)))
    decl = g_w1[g_w1.week == pd.Timestamp("2019-08-04")].iloc[0]  # epi week holding 06/08/2019
    return dict(window="2019-05-01 to 2019-07-14", regions=regions.to_dict("records"), places=places,
                national_declaration_week=dict(week="2019-08-04", moran_i=round(float(decl.moran_i), 3),
                                               q=round(float(decl.q), 4)))


def main() -> None:
    paths.require(paths.COMBINED, paths.EARS, paths.CROSSWALK, paths.UNITS_GEOJSON)
    paths.OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    summary = dict(settings=dict(perms=PERMS, null_perms=NULL_PERMS, shuffles=SHUFFLES, seed=SEED,
                                 min_coverage=MIN_COVERAGE, alpha=ALPHA, high_c2=HIGH_C2, k=weights.K,
                                 knox_max_dt=KNOX_MAX_DT, lookback=LOOKBACK,
                                 episode_max_gap=panel.EPISODE_MAX_GAP))

    u = panel.units()
    W = weights.unit_weights(u)
    ids = W["ids"]
    summary["reproduces_ears"] = panel.check_primary_reproduces()
    nb = {k: W[k].sum(axis=1) for k in ("W1", "W2", "W3")}
    summary["weights"] = dict(units=len(ids), **W["info"],
                              **{f"{k}_neighbours": dict(min=int(v.min()), median=float(np.median(v)), max=int(v.max()))
                                 for k, v in nb.items()})
    pd.DataFrame({"unit_id": ids, **{k: [";".join(np.asarray(ids)[W[k][i] > 0]) for i in range(len(ids))]
                                     for k in ("W1", "W2", "W3")}}).to_csv(paths.OUT / "weights_units.csv", index=False)
    print(f"weights: {summary['weights']}")

    g_rows, l_rows, k_rows, lt_rows, bg_rows = [], [], [], [], []
    loc_regions = None
    mats_by_variant = {}
    for variant in panel.VARIANTS:
        local = panel.attach_units(panel.local_results(variant), u)
        mats = panel.matrices(local, ids)
        mats_by_variant[variant] = mats
        if variant == "primary":
            loc_regions = local.drop_duplicates("unit_id").set_index("unit_id")[["region", "geography_name"]]
        weight_set = ("W1", "W2", "W3") if variant == "primary" else ("W1",)
        for wn in weight_set:
            transforms = ("raw", "rank") if variant == "primary" and wn == "W1" else ("raw",)
            for tr in transforms:
                g = global_series(mats["c2"], W[wn], mats["weeks"], rng, transform=tr)
                g_rows.append(g.assign(variant=variant, level="unit", weights=wn, transform=tr))
            l_rows.append(local_series(mats["c2"], W[wn], mats["weeks"], ids, rng).assign(variant=variant, weights=wn))
            for r in knox_runs(mats["alarm"], mats["weeks"], weights.symmetric(W[wn]), rng):
                k_rows.append(dict(variant=variant, weights=wn, **r))
        lt, bg = lead_times(local, u, mats, variant)
        lt_rows += lt
        bg_rows += bg
        print(f"{variant}: global, local, Knox and lead times done")

        if variant == "primary":  # MAUP: the same tests on 83 full provinces
            key = panel.province_key(u)
            P = weights.province_weights(u, W["W3"], key.reindex(ids).reset_index(drop=True))
            prov = panel.aggregate(local, key, "province")
            pmats = panel.matrices(prov.rename(columns={"group": "unit_id"}), P["ids"])
            summary["province_weights"] = dict(units=len(P["ids"]), **P["info"])
            for wn in ("W1", "W2", "W3"):
                g = global_series(pmats["c2"], P[wn], pmats["weeks"], rng)
                g_rows.append(g.assign(variant=variant, level="province", weights=wn, transform="raw"))
                for r in knox_runs(pmats["alarm"], pmats["weeks"], weights.symmetric(P[wn]), rng):
                    k_rows.append(dict(variant=variant, weights=f"province {wn}", **r))
            print("province (MAUP) done")

    G = pd.concat(g_rows, ignore_index=True)
    L = pd.concat(l_rows, ignore_index=True)
    K = pd.DataFrame(k_rows)
    LT, BG = pd.DataFrame(lt_rows), pd.DataFrame(bg_rows)

    # Negative control: shuffle unit locations (fixed per shuffle), keep each series intact.
    mats = mats_by_variant["primary"]
    nc = []
    for s in range(SHUFFLES):
        perm = rng.permutation(len(ids))
        w_shuf = W["W1"][np.ix_(perm, perm)]
        g = global_series(mats["c2"], w_shuf, mats["weeks"], rng, perms=NULL_PERMS)
        ev = g.dropna(subset=["moran_i"])
        kn = [r for r in knox_runs(mats["alarm"], mats["weeks"], weights.symmetric(w_shuf), rng, perms=NULL_PERMS)
              if r["period"] == "all"]
        nc.append(dict(shuffle=s, weeks=len(ev), share_p05=float((ev.p <= ALPHA).mean()),
                       share_q05=float((ev.q <= ALPHA).mean()), median_i=float(ev.moran_i.median()),
                       **{f"knox_ratio_{r['null'].replace(' ', '_')}": r["ratio"] for r in kn},
                       **{f"knox_p_{r['null'].replace(' ', '_')}": r["p"] for r in kn}))
    NC = pd.DataFrame(nc)
    print("negative control done")

    # ---------------------------------------------------------------- write
    G.to_csv(paths.OUT / "global_moran.csv", index=False, float_format="%.4f")
    L.to_csv(paths.OUT / "local_clusters.csv", index=False, float_format="%.4f")
    K.to_csv(paths.OUT / "knox.csv", index=False, float_format="%.4f")
    LT.to_csv(paths.OUT / "lead_times.csv", index=False, float_format="%.4f")
    BG.to_csv(paths.OUT / "lead_background.csv", index=False, float_format="%.4f")
    NC.to_csv(paths.OUT / "negative_control.csv", index=False, float_format="%.4f")

    summary["global"] = {f"{v}|{lv}|{w}|{tr}": global_summary(d)
                         for (v, lv, w, tr), d in G.groupby(["variant", "level", "weights", "transform"])}
    unit_g = G[(G["level"] == "unit") & (G["variant"] == "primary") & (G["transform"] == "raw")]
    piv = unit_g.pivot(index="week", columns="weights", values="moran_i")
    prov_i = G[(G["level"] == "province") & (G["weights"] == "W1")].set_index("week")["moran_i"]
    both = pd.concat([piv["W1"], prov_i], axis=1, keys=["unit", "province"]).dropna()
    summary["global_agreement"] = dict(
        corr_W1_W2=round(float(piv.W1.corr(piv.W2)), 3), corr_W1_W3=round(float(piv.W1.corr(piv.W3)), 3),
        corr_unit_province_W1=round(float(both.unit.corr(both.province)), 3), common_weeks=len(both))
    summary["local"] = {f"{v}|{w}": local_summary(d) for (v, w), d in L.groupby(["variant", "weights"])}
    summary["local_weights_agreement"] = weights_agreement(L[L.variant == "primary"])
    summary["negative_control"] = dict(
        shuffles=SHUFFLES, perms=NULL_PERMS,
        share_q05=dict(mean=round(float(NC.share_q05.mean()), 3), max=round(float(NC.share_q05.max()), 3)),
        share_p05=dict(mean=round(float(NC.share_p05.mean()), 3), max=round(float(NC.share_p05.max()), 3)),
        knox_ratio_all_weeks=dict(mean=round(float(NC.knox_ratio_all_weeks.mean()), 3),
                                  min=round(float(NC.knox_ratio_all_weeks.min()), 3),
                                  max=round(float(NC.knox_ratio_all_weeks.max()), 3)),
        knox_p_within_epi_year_below_05=int((NC.knox_p_within_epi_year <= ALPHA).sum()))
    summary["lead_times"] = lead_summary(LT, BG)
    w1 = L[(L.variant == "primary") & (L.weights == "W1")]
    g_w1 = unit_g[unit_g.weights == "W1"]
    summary["plausibility"] = plausibility(w1, g_w1, loc_regions)
    (paths.OUT / "summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(f"-> {paths.OUT.relative_to(paths.REPO)}")


if __name__ == "__main__":
    main()
