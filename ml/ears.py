"""Apply the CDC EARS C1, C2 and C3 aberration-detection methods to the cleaned dengue data.

Input:  data/processed/dengue_cases_combined.xlsx (built by ml/clean_dengue.py)
Output: data/processed/dengue_ears.xlsx, with NATIONAL, LOCAL and METHOD sheets.

For week t of each series:
  C1: baseline = weeks t-7 .. t-1           stat = (Y_t - mean) / sd, alarm if > 3
  C2: baseline = weeks t-9 .. t-3 (2-wk lag) stat = (Y_t - mean) / sd, alarm if > 3
  C3: stat = sum over i = 0..2 of max(0, C2_{t-i} - 1),           alarm if > 2

Handling of gaps and flags (agreed during data cleaning):
- Only weeks with data_quality "ok" are usable; any other week counts as null.
- Weeks with a data_flag (possible non-reporting, one-week spike) still get
  their own result, but are left out of other weeks' baselines.
- A baseline needs at least 5 of its 7 weeks usable; otherwise no result.
- No result when the current week is not "ok". C3 needs C2 at t, t-1, t-2.
- sd is floored at MIN_SD so a flat baseline cannot divide by zero, and a
  week needs at least MIN_COUNT cases to raise an alarm.
"""
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data" / "processed"
SRC = DATA / "dengue_cases_combined.xlsx"
OUT = DATA / "dengue_ears.xlsx"

THRESHOLD_C1_C2 = 3.0
THRESHOLD_C3 = 2.0
BASELINE_WEEKS = 7
MIN_BASELINE = 5
MIN_SD = 1.0
MIN_COUNT = 5
EXCLUDE_FLAGGED_FROM_BASELINE = True

COMBOS = ["C1", "C2", "C3", "C1+C2", "C1+C3", "C2+C3", "C1+C2+C3"]


def run_series(g: pd.DataFrame) -> pd.DataFrame:
    """Compute C1-C3 for one series, ordered by week."""
    g = g.sort_values("period_start").reset_index(drop=True)
    y = g["value"].astype(float).to_numpy()
    dates = g["period_start"].dt.strftime("%d/%m/%Y").to_numpy()
    ok = (g["data_quality"] == "ok").to_numpy()
    flag = g["data_flag"].to_numpy()
    flagged = pd.notna(flag)
    usable = ok & ~flagged if EXCLUDE_FLAGGED_FROM_BASELINE else ok
    n = len(g)

    out = {k: np.full(n, np.nan) for k in
           ("c1_mean", "c1_sd", "c1_stat", "c2_mean", "c2_sd", "c2_stat", "c3_stat")}
    notes = [[] for _ in range(n)]
    flag_notes = [[] for _ in range(n)]

    for t in range(n):
        for name, lag in (("c1", 1), ("c2", 3)):
            lo, hi = t - lag - BASELINE_WEEKS + 1, t - lag + 1
            if lo < 0:
                continue  # not enough history at the start of the series
            idx = np.arange(lo, hi)
            use = idx[usable[idx]]
            skipped = idx[ok[idx] & flagged[idx]] if EXCLUDE_FLAGGED_FROM_BASELINE else idx[flagged[idx]]
            if len(skipped):
                verb = "excluded" if EXCLUDE_FLAGGED_FROM_BASELINE else "kept"
                flag_notes[t].append(f"{name.upper()} baseline {verb} flagged week(s): "
                                     + ", ".join(f"{dates[i]} ({flag[i]})" for i in skipped))
            if len(use) < MIN_BASELINE:
                notes[t].append(f"{name.upper()} not computed: {len(use)} of {BASELINE_WEEKS} baseline weeks usable")
                continue
            if len(use) < BASELINE_WEEKS:
                notes[t].append(f"{name.upper()} baseline {len(use)} of {BASELINE_WEEKS} weeks")
            mean, sd = y[use].mean(), y[use].std(ddof=1)
            out[f"{name}_mean"][t], out[f"{name}_sd"][t] = mean, sd
            if ok[t]:
                if sd < MIN_SD:
                    notes[t].append(f"{name.upper()} sd {sd:.2f} floored to {MIN_SD:g}")
                out[f"{name}_stat"][t] = (y[t] - mean) / max(sd, MIN_SD)

        if ok[t] and t >= 2:
            c2 = out["c2_stat"][t - 2:t + 1]
            if np.isnan(c2).any():
                if not np.isnan(out["c2_stat"][t]):
                    notes[t].append("C3 not computed: C2 missing in one of the last 3 weeks")
            else:
                out["c3_stat"][t] = np.maximum(0, c2 - 1).sum()

        if not ok[t]:
            notes[t].insert(0, f"current week {g['data_quality'].iat[t]}, not evaluated")
        elif flagged[t]:
            flag_notes[t].insert(0, f"current week flagged: {flag[t]} (an alarm here may be a reporting artefact)")

    res = g.copy()
    for k, v in out.items():
        res[k] = np.round(v, 2)

    alarms = {}
    for name, thr in (("c1", THRESHOLD_C1_C2), ("c2", THRESHOLD_C1_C2), ("c3", THRESHOLD_C3)):
        stat = res[f"{name}_stat"]
        alarm = (stat > thr) & (res["value"] >= MIN_COUNT)
        res[f"{name}_alarm"] = alarm.where(stat.notna())  # null when not computed
        alarms[name] = res[f"{name}_alarm"]
        suppressed = (stat > thr) & (res["value"] < MIN_COUNT)
        for t in np.flatnonzero(suppressed.to_numpy()):
            notes[t].append(f"{name.upper()} above threshold but under {MIN_COUNT} cases, no alarm")

    labels = []
    for t in range(n):
        computed = [k for k in ("c1", "c2", "c3") if pd.notna(alarms[k].iat[t])]
        if not computed:
            labels.append("not computed")
            continue
        fired = [k.upper() for k in computed if alarms[k].iat[t]]
        labels.append("+".join(fired) if fired else "none")
        missing = [k.upper() for k in ("c1", "c2", "c3") if k not in computed]
        if missing and fired:
            notes[t].append("label based on " + ", ".join(k.upper() for k in computed)
                            + " only (" + ", ".join(missing) + " not computed)")
    res["ears_alarm"] = labels
    res["ears_note"] = ["; ".join(x) or None for x in notes]
    res["flag_note"] = ["; ".join(x) or None for x in flag_notes]
    return res


def run(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    parts = [run_series(g) for _, g in df.groupby(keys, sort=False)]
    res = pd.concat(parts, ignore_index=True)
    cols = (keys + ["period_start", "epi_year", "epi_week", "value", "data_quality", "data_flag",
                    "c1_mean", "c1_sd", "c1_stat", "c1_alarm",
                    "c2_mean", "c2_sd", "c2_stat", "c2_alarm",
                    "c3_stat", "c3_alarm", "ears_alarm", "ears_note", "flag_note", "doh_status"])
    return res[cols]


def method_sheet() -> pd.DataFrame:
    rows = [
        ("Source", "data/processed/dengue_cases_combined.xlsx (ml/clean_dengue.py)"),
        ("C1", f"baseline weeks t-7..t-1; stat = (Y - mean) / sd; alarm if stat > {THRESHOLD_C1_C2:g}"),
        ("C2", f"baseline weeks t-9..t-3 (2-week lag); stat = (Y - mean) / sd; alarm if stat > {THRESHOLD_C1_C2:g}"),
        ("C3", f"stat = sum of max(0, C2 - 1) over weeks t, t-1, t-2; alarm if stat > {THRESHOLD_C3:g}"),
        ("sd", "sample standard deviation (n - 1) of the usable baseline weeks"),
        ("Usable week", 'data_quality = "ok"'
         + (" and no data_flag" if EXCLUDE_FLAGGED_FROM_BASELINE else "")),
        ("Minimum baseline", f"{MIN_BASELINE} of {BASELINE_WEEKS} weeks usable, otherwise not computed"),
        ("Current week", 'evaluated only when data_quality = "ok"; flagged weeks are evaluated, with flag_note'),
        ("SD floor", f"sd below {MIN_SD:g} is raised to {MIN_SD:g}"),
        ("Minimum count", f"a week needs at least {MIN_COUNT} cases to alarm"),
        ("ears_alarm", "none, one of " + ", ".join(COMBOS) + ", or not computed"),
        ("ears_note", "how the result was computed (shortened baselines, SD floor, suppressed alarms)"),
        ("flag_note", "data_flag warnings: current week flagged, flagged weeks left out of the baselines"),
        ("doh_status", "copied from the DOH threshold columns of the source workbook, for comparison"),
    ]
    return pd.DataFrame(rows, columns=["item", "definition"])


def main() -> None:
    src = pd.read_excel(SRC, sheet_name=None)
    national = run(src["NATIONAL"], ["geographic_level"])
    local = run(src["LOCAL"], ["region", "geography_name"])

    with pd.ExcelWriter(OUT, engine="openpyxl", datetime_format="DD/MM/YYYY") as xw:
        national.to_excel(xw, sheet_name="NATIONAL", index=False)
        local.to_excel(xw, sheet_name="LOCAL", index=False)
        method_sheet().to_excel(xw, sheet_name="METHOD", index=False)
        for ws in xw.book.worksheets:
            ws.freeze_panes = "A2"
            for col in ws.columns:
                width = max(len(str(c.value)) for c in col[:200])
                ws.column_dimensions[col[0].column_letter].width = min(max(width, 10) + 2, 60)

    for name, df in (("national", national), ("local", local)):
        print(f"{name}: {len(df)} rows")
        print(f"  ears_alarm: {df['ears_alarm'].value_counts().to_dict()}")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
