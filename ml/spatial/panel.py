"""Unit x week panels of EARS results, data-quality variants and aggregates.

Method doc §4.2 steps 1-2 and the §4.4 data-quality sensitivity:
- "primary": dengue_ears.xlsx as built (swap rows and missing weeks are
  missing, never zero).
- "swapped_back": the 665 suspect swap rows take the source `deaths` value as
  their case count. A sensitivity check only, never a published series.
- "no_2016": every 2016 week is set missing before EARS (51 of its weeks are
  incomplete because Davao Occidental has no rows).

Aggregates (full province, region, national) are sums of member units, and
only in weeks where every member has an "ok" value (ml/qa/local_sums.py rule);
they are never split downward.
"""

import sys

import numpy as np
import pandas as pd

from . import paths

sys.path.insert(0, str(paths.REPO / "ml"))
import clean_dengue  # noqa: E402
import ears  # noqa: E402

VARIANTS = ("primary", "swapped_back", "no_2016")
NO_SIGNAL = {"none", "not computed"}
# Alarm weeks separated by at most this many non-alarm weeks are one episode.
EPISODE_MAX_GAP = 1


def units() -> pd.DataFrame:
    """Crosswalk rows in a fixed order (unit_id), with the ml join key."""
    cw = pd.read_csv(paths.CROSSWALK)
    return cw.sort_values("unit_id").reset_index(drop=True)


def _rerun(local: pd.DataFrame) -> pd.DataFrame:
    """Re-derive flags, DOH thresholds and EARS after data_quality/value changes."""
    local = local[["geographic_level", "region", "geography_name", "period_start", "value", "data_quality"]].copy()
    clean_dengue.flag_suspect_local_weeks(local)
    local = clean_dengue.add_doh_thresholds(local, keys=["region", "geography_name"])
    return ears.run(local, ["region", "geography_name"])


def _swapped_back(src: pd.DataFrame) -> pd.DataFrame:
    raw = pd.read_csv(paths.hdx_raw(), skiprows=[1])
    raw["loc"] = raw["loc"].str.strip().str.upper().replace(clean_dengue.LOC_FIXES)
    raw["date"] = pd.to_datetime(raw["date"], format="%m/%d/%Y")
    raw["suspect_swap"] = clean_dengue.mark_suspect_swaps(raw)
    swaps = (raw[raw.suspect_swap]
             .rename(columns={"loc": "geography_name", "date": "period_start"})
             [["geography_name", "period_start", "deaths"]]
             .drop_duplicates(["geography_name", "period_start"]))
    out = src.merge(swaps, on=["geography_name", "period_start"], how="left")
    hit = out["data_quality"].eq("suspect swap")
    if hit.sum() != out["deaths"].notna().sum() or hit.sum() != 665:
        raise SystemExit(f"swap rows do not line up with the source: {hit.sum()} marked, "
                         f"{out['deaths'].notna().sum()} found in the raw file")
    out.loc[hit, "value"] = out.loc[hit, "deaths"].astype("int64")
    out.loc[hit, "data_quality"] = "ok"
    return out.drop(columns="deaths")


def local_results(variant: str) -> pd.DataFrame:
    """LOCAL EARS results for one data-quality variant."""
    if variant == "primary":
        return pd.read_excel(paths.EARS, sheet_name="LOCAL")
    src = pd.read_excel(paths.COMBINED, sheet_name="LOCAL")
    if variant == "swapped_back":
        src = _swapped_back(src)
    elif variant == "no_2016":
        src.loc[src.period_start.dt.year == 2016, "data_quality"] = "missing"
    else:
        raise ValueError(variant)
    return _rerun(src)


def check_primary_reproduces() -> int:
    """Re-running EARS on the combined workbook must give dengue_ears.xlsx (C2 and labels)."""
    src = pd.read_excel(paths.COMBINED, sheet_name="LOCAL")
    again = ears.run(src, ["region", "geography_name"])
    built = pd.read_excel(paths.EARS, sheet_name="LOCAL")
    key = ["geography_name", "period_start"]
    m = again.merge(built, on=key, suffixes=("", "_b"))
    c2_diff = ~((m.c2_stat.isna() & m.c2_stat_b.isna()) | ((m.c2_stat - m.c2_stat_b).abs() < 0.011))
    return int(c2_diff.sum() + (m.ears_alarm != m.ears_alarm_b).sum())


def attach_units(local: pd.DataFrame, u: pd.DataFrame) -> pd.DataFrame:
    key = u.set_index("ml_geography_name")["unit_id"]
    local = local.assign(unit_id=local["geography_name"].map(key))
    missing = local.loc[local.unit_id.isna(), "geography_name"].unique()
    if len(missing):
        raise SystemExit(f"names not in the crosswalk: {missing}")
    return local


def matrices(local: pd.DataFrame, ids: list[str]) -> dict:
    """Unit x week arrays: c2 (NaN where not computed), alarm (bool), alarm_known (bool)."""
    weeks = pd.DatetimeIndex(sorted(local.period_start.unique()))
    def pivot(col):
        return local.pivot(index="unit_id", columns="period_start", values=col).reindex(index=ids, columns=weeks)
    c2 = pivot("c2_stat").to_numpy(dtype=float)
    label = pivot("ears_alarm")
    alarm = (~label.isin(NO_SIGNAL) & label.notna()).to_numpy()
    known = label.ne("not computed").to_numpy() & label.notna().to_numpy()
    return dict(weeks=weeks, c2=c2, alarm=alarm, known=known)


def aggregate(local: pd.DataFrame, group_of: pd.Series, level: str) -> pd.DataFrame:
    """Sum member units per group and week (complete weeks only), then DOH thresholds and EARS.

    `group_of` maps unit_id -> group key. The result is in ears.run's layout,
    with `group` as the series key.
    """
    df = local.assign(group=local.unit_id.map(group_of),
                      valid=local.value.where(local.data_quality.eq("ok")).astype(float))
    g = (df.groupby(["group", "period_start"])
           .agg(value=("valid", lambda v: v.sum() if v.notna().all() else np.nan))
           .reset_index())
    g["geographic_level"] = level
    g["value"] = g["value"].astype("Int64")
    g["data_quality"] = np.where(g.value.isna(), "missing", "ok")
    g["data_flag"] = None  # unit-level flags are diluted in a sum
    g = clean_dengue.add_doh_thresholds(g, keys=["group"])
    return ears.run(g, ["group"])


def province_key(u: pd.DataFrame) -> pd.Series:
    """Full-province grouping for the MAUP check: a province is its remainder plus its cities.

    Units without a province (the 16 NCR cities and Pateros; Zamboanga City)
    are grouped as NCR (one unit) and Zamboanga City (its own unit): 83 units.
    """
    key = u.geographic_province_id.copy()
    key[key.isna() & u.analysis_region_id.eq("ncr")] = "ncr"
    key[key.isna()] = u.unit_id[key.isna()]
    return pd.Series(key.to_numpy(), index=u.unit_id)


def alarm_episodes(alarm: np.ndarray, max_gap: int = EPISODE_MAX_GAP) -> list[tuple[int, int, int]]:
    """(unit row, start week, end week) of EARS alarm episodes.

    An episode is a run of alarm weeks; runs separated by at most max_gap
    non-alarm weeks are merged. A week that was not computed counts as
    non-alarm (it cannot alarm).
    """
    out = []
    for i, row in enumerate(alarm):
        hits = np.flatnonzero(row)
        if not len(hits):
            continue
        start = prev = hits[0]
        for t in hits[1:]:
            if t - prev - 1 > max_gap:
                out.append((i, int(start), int(prev)))
                start = t
            prev = t
        out.append((i, int(start), int(prev)))
    return out


def threshold_episodes(series: pd.DataFrame, statuses: set[str], min_weeks: int = 2) -> list[tuple[int, int]]:
    """(start, end) week positions of runs of `statuses` lasting min_weeks or more.

    Same definition as ml/qa/ears_analysis.episodes (2+ consecutive weeks).
    `series` must be one series sorted by period_start.
    """
    hit = series.doh_status.isin(statuses).to_numpy()
    out, t = [], 0
    while t < len(hit):
        if hit[t]:
            s = t
            while t < len(hit) and hit[t]:
                t += 1
            if t - s >= min_weeks:
                out.append((s, t - 1))
        else:
            t += 1
    return out
