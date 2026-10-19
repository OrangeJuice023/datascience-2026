"""Build aligned city-week tables from the raw CCHAIN files.

Outputs (data/processed/environment/):
  city_weekly_dengue.csv   PIDSR dengue counts on a complete Monday-week grid,
                           2008-2022, with an explicit status per week
  city_weekly_climate.csv  population-weighted city climate, 2003-2022
  quality_report.json      coverage, gaps and flag counts

Rules (see docs/environmental-covariates.md, "Alignment"):
  - Weeks start on Monday, matching the CCHAIN PIDSR `date` column. Whether
    upstream means "week starting" is not documented; see the doc.
  - Weeks absent upstream stay absent (cases empty, status absent_upstream).
    Nothing is zero-filled or interpolated.
  - A run of >= ZERO_RUN_WEEKS consecutive zero weeks in a city whose typical
    week is not near zero is flagged suspected_reporting_gap. The published
    table has no missing values at all, and a CCHAIN prototype notebook
    zero-fills Zamboanga cases (fillna(0)), so a zero may mean "not reported".
    Whether the published table was built that way is not documented.
  - Cities whose typical week is near zero cannot be checked that way and are
    marked low_count in the quality report; they are excluded from modeling.
  - Cities in SPATIAL_MISMATCH have case counts that cover a different area
    than their climate barangays; they are excluded from modeling.
  - Weekly rainfall needs all 7 daily values; otherwise it is left empty.
"""

import json

import numpy as np
import pandas as pd

from .paths import OUT, raw_dir, verified_inputs
from .sources import CLIMATE_VARIABLES, HDX_DATASETS

RAW = raw_dir("cchain")

ZERO_RUN_WEEKS = 4
LOW_COUNT_MEDIAN = 3  # median weekly cases (2008-2019) below this => low_count
COVID_START = pd.Timestamp("2020-03-16")  # Luzon enhanced community quarantine
POPULATION_YEAR = 2020

# Found by environment.crosscheck against HDX DOH-Epi 2016-2020.
SPATIAL_MISMATCH = {
    "PH063022000": "Iloilo City PIDSR series tracks DOH-Epi Iloilo province "
                   "(r=0.99, volume ratio 0.99) not Iloilo City (ratio 5.4); "
                   "climate covers city barangays only",
}


def load_cities() -> pd.DataFrame:
    loc = pd.read_csv(RAW / "location.csv")
    return loc[["adm3_pcode", "adm3_en", "adm4_pcode"]]


def build_dengue(cities: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_csv(RAW / "disease_pidsr_totals.csv")
    raw = raw[raw["disease_common_name"] == "DENGUE FEVER"].copy()
    raw["week_start"] = pd.to_datetime(raw["date"])
    assert (raw["week_start"].dt.dayofweek == 0).all(), "PIDSR dates are not all Mondays"
    assert not raw.duplicated(["adm3_pcode", "week_start"]).any(), "duplicate city-weeks"

    names = cities.drop_duplicates("adm3_pcode").set_index("adm3_pcode")["adm3_en"]
    grid = pd.MultiIndex.from_product(
        [sorted(raw["adm3_pcode"].unique()),
         pd.date_range(raw["week_start"].min(), raw["week_start"].max(), freq="W-MON")],
        names=["city_pcode", "week_start"],
    )
    df = (
        raw.rename(columns={"adm3_pcode": "city_pcode", "case_total": "cases"})
        .set_index(["city_pcode", "week_start"])[["cases", "uuid"]]
        .reindex(grid)
        .reset_index()
    )
    df["city_name"] = df["city_pcode"].map(names)
    df["status"] = np.where(df["cases"].isna(), "absent_upstream", "reported")

    pre = df[(df["week_start"] < COVID_START) & df["cases"].notna()]
    medians = pre.groupby("city_pcode")["cases"].median()
    low_count = sorted(medians[medians < LOW_COUNT_MEDIAN].index)

    for pcode, g in df.groupby("city_pcode"):
        if pcode in low_count:
            continue
        zero = g["cases"].eq(0)
        run_id = (zero != zero.shift()).cumsum()
        run_len = zero.groupby(run_id).transform("sum")
        flag = zero & (run_len >= ZERO_RUN_WEEKS)
        df.loc[g.index[flag], "status"] = "suspected_reporting_gap"

    df["period"] = np.where(df["week_start"] >= COVID_START, "covid_disruption", "pre_covid")
    df["week_end"] = df["week_start"] + pd.Timedelta(days=6)
    df = df.rename(columns={"uuid": "upstream_id"})

    report = {
        "rows": len(df),
        "cities": int(df["city_pcode"].nunique()),
        "first_week": str(df["week_start"].min().date()),
        "last_week": str(df["week_start"].max().date()),
        "status_counts": df["status"].value_counts().to_dict(),
        "absent_weeks": sorted({str(d.date()) for d in df.loc[df["status"] == "absent_upstream", "week_start"]}),
        "low_count_cities": {p: str(names[p]) for p in low_count},
        "spatial_mismatch_cities": {str(names[p]): why for p, why in SPATIAL_MISMATCH.items()},
        "modeling_cities": {
            p: str(names[p]) for p in sorted(medians.index)
            if p not in low_count and p not in SPATIAL_MISMATCH
        },
        "median_weekly_cases_pre_covid": {str(names[p]): float(m) for p, m in medians.items()},
        "suspected_gap_weeks_by_city": (
            df[df["status"] == "suspected_reporting_gap"].groupby("city_name").size().to_dict()
        ),
    }
    cols = ["city_pcode", "city_name", "week_start", "week_end", "cases", "status", "period", "upstream_id"]
    return df[cols], report


def build_climate(cities: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    pop = pd.read_csv(RAW / "worldpop_population.csv", usecols=["adm4_pcode", "date", "pop_count_total"])
    pop = pop[pd.to_datetime(pop["date"]).dt.year == POPULATION_YEAR]
    weights = cities.merge(pop[["adm4_pcode", "pop_count_total"]], on="adm4_pcode", how="left")
    missing_weight = int(weights["pop_count_total"].isna().sum())
    weights = weights.dropna(subset=["pop_count_total"]).set_index("adm4_pcode")

    variables = list(CLIMATE_VARIABLES)
    parts = []
    for chunk in pd.read_csv(RAW / "climate_atmosphere.csv",
                             usecols=["adm4_pcode", "date", "freq", *variables],
                             chunksize=2_000_000):
        chunk = chunk[(chunk["freq"] == "D") & chunk["adm4_pcode"].isin(weights.index)]
        chunk["city_pcode"] = chunk["adm4_pcode"].map(weights["adm3_pcode"])
        w = chunk["adm4_pcode"].map(weights["pop_count_total"])
        agg = {}
        for v in variables:
            has = chunk[v].notna()
            agg[f"{v}_wsum"] = (chunk[v] * w).where(has, 0.0)
            agg[f"{v}_w"] = w.where(has, 0.0)
        agg["pr_brgy"] = chunk["pr"].notna().astype(int)
        agg["brgy"] = 1
        parts.append(pd.DataFrame(agg).assign(city_pcode=chunk["city_pcode"], date=chunk["date"])
                     .groupby(["city_pcode", "date"]).sum())
    daily = pd.concat(parts).groupby(level=[0, 1]).sum().reset_index()
    for v in variables:
        daily[v] = daily[f"{v}_wsum"] / daily[f"{v}_w"].replace(0, np.nan)
    daily["date"] = pd.to_datetime(daily["date"])
    daily["week_start"] = daily["date"] - pd.to_timedelta(daily["date"].dt.dayofweek, unit="D")

    wk = daily.groupby(["city_pcode", "week_start"])
    weekly = pd.DataFrame({
        "days": wk.size(),
        "pr_days": wk["pr"].count(),
        "pr_mm": wk["pr"].sum(min_count=1),
        **{f"{v}": wk[v].mean() for v in variables if v != "pr"},
        "min_brgy_with_pr": wk["pr_brgy"].min(),
        "brgy": wk["brgy"].max(),
    }).reset_index()
    weekly.loc[weekly["pr_days"] < 7, "pr_mm"] = np.nan
    weekly = weekly[weekly["days"] == 7].drop(columns=["days", "pr_days"])
    weekly = weekly.rename(columns={"tave": "tave_c", "tmin": "tmin_c", "tmax": "tmax_c", "rh": "rh_pct"})

    report = {
        "rows": len(weekly),
        "first_week": str(weekly["week_start"].min().date()),
        "last_week": str(weekly["week_start"].max().date()),
        "barangays_without_population_weight": missing_weight,
        "weeks_missing_rainfall": int(weekly["pr_mm"].isna().sum()),
        "population_weight_year": POPULATION_YEAR,
        "variables": CLIMATE_VARIABLES,
    }
    return weekly, report


def main() -> None:
    inputs = verified_inputs("cchain", HDX_DATASETS["cchain"]["resources"])
    OUT.mkdir(parents=True, exist_ok=True)
    cities = load_cities()
    dengue, dq = build_dengue(cities)
    climate, cq = build_climate(cities)
    dengue.to_csv(OUT / "city_weekly_dengue.csv", index=False, date_format="%Y-%m-%d")
    climate.to_csv(OUT / "city_weekly_climate.csv", index=False, date_format="%Y-%m-%d", float_format="%.3f")
    report = {
        "inputs": inputs,
        "dengue": dq,
        "climate": cq,
    }
    (OUT / "quality_report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
