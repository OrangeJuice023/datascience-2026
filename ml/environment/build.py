"""Build aligned city-week tables from the raw CCHAIN and Open-Meteo files.

    python -m environment.build

Outputs (data/processed/environment/):
  city_weekly_dengue.csv   PIDSR dengue counts on a complete canonical-week
                           grid, 2008-2022, with an explicit status per week
  city_weekly_weather.csv  one row per geography x week x weather source
                           (ENVIRONMENT tab structure), with coverage and
                           quality flags
  quality_report.json      coverage, gaps and flag counts

Run environment.fetch, environment.geography and environment.open_meteo first.

Rules (see docs/environmental-covariates.md, "Alignment"):
  - Canonical weeks are Sunday-Saturday (environment.weeks). CCHAIN PIDSR
    Monday labels move to the Sunday before; the upstream label is kept in
    `source_week_label`.
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
  - Each source keeps its own rows. Values from different sources are never
    merged into one row or one column; harmonisation happens only in
    environment.features.
  - A weekly value needs all 7 daily values; otherwise it is left empty and
    the row is flagged incomplete_week.
"""

import hashlib
import json

import numpy as np
import pandas as pd

from . import geography, open_meteo, weeks
from .paths import OUT, manifest_path, raw_dir, verified_inputs
from .sources import CLIMATE_VARIABLES, HDX_DATASETS, OPEN_METEO, WEATHER_VARIABLES

RAW = raw_dir("cchain")

ZERO_RUN_WEEKS = 4
LOW_COUNT_MEDIAN = 3  # median weekly cases (2008-2019) below this => low_count
COVID_START = pd.Timestamp("2020-03-15")  # canonical week of the Luzon ECQ (2020-03-16)
POPULATION_YEAR = 2020

# Found by environment.crosscheck against HDX DOH-Epi 2016-2020.
SPATIAL_MISMATCH = {
    "iloilo-city": "Iloilo City PIDSR series tracks DOH-Epi Iloilo province "
                   "(r=0.99, volume ratio 0.99) not Iloilo City (ratio 5.4); "
                   "climate covers city barangays only",
}

# Per-source metadata written onto every weather row.
WEATHER_SOURCES = {
    "cchain": {
        "upstream_product": "ERA5 (temperature, humidity); CHIRPS v2 (precipitation)",
        "aggregation_method": f"population_weighted_mean_of_barangays (WorldPop {POPULATION_YEAR})",
        "source_url": "https://data.humdata.org/dataset/project-cchain",
    },
    "open_meteo": {
        "upstream_product": "ERA5 (all variables), via Open-Meteo archive API",
        "aggregation_method": "single_grid_cell_at_population_weighted_centroid",
        "source_url": "https://open-meteo.com/en/docs/historical-weather-api",
    },
}
VARS = list(WEATHER_VARIABLES)

# Plausibility bounds for weekly values in the Philippines; outside => flagged.
RANGE = {
    "precipitation_mm": (0, 1500),
    "temperature_mean_c": (10, 40),
    "temperature_min_c": (5, 40),
    "temperature_max_c": (10, 45),
    "humidity_mean_pct": (20, 100),
}


def build_dengue(names: pd.Series) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_csv(RAW / "disease_pidsr_totals.csv")
    raw = raw[raw["disease_common_name"] == "DENGUE FEVER"].copy()
    raw["geography_id"] = raw["adm3_pcode"].map(geography.cchain_ids())
    assert raw["geography_id"].notna().all(), "PIDSR city missing from geography crosswalk"
    raw["source_week_label"] = pd.to_datetime(raw["date"])
    assert (raw["source_week_label"].dt.dayofweek == 0).all(), "PIDSR dates are not all Mondays"
    raw["period_start"] = weeks.from_source_label(raw["source_week_label"], "cchain_pidsr")
    assert not raw.duplicated(["geography_id", "period_start"]).any(), "duplicate city-weeks"

    grid = pd.MultiIndex.from_product(
        [sorted(raw["geography_id"].unique()),
         pd.date_range(raw["period_start"].min(), raw["period_start"].max(), freq="W-SUN")],
        names=["geography_id", "period_start"],
    )
    df = (
        raw.rename(columns={"case_total": "cases", "uuid": "upstream_id"})
        .set_index(["geography_id", "period_start"])[["cases", "upstream_id"]]
        .reindex(grid)
        .reset_index()
    )
    df["source_week_label"] = df["period_start"] + pd.Timedelta(days=-weeks.SOURCE_WEEK_OFFSET_DAYS["cchain_pidsr"])
    df["geography_name"] = df["geography_id"].map(names)
    df["status"] = np.where(df["cases"].isna(), "absent_upstream", "reported")

    pre = df[(df["period_start"] < COVID_START) & df["cases"].notna()]
    medians = pre.groupby("geography_id")["cases"].median()
    low_count = sorted(medians[medians < LOW_COUNT_MEDIAN].index)

    for gid, g in df.groupby("geography_id"):
        if gid in low_count:
            continue
        zero = g["cases"].eq(0)
        run_id = (zero != zero.shift()).cumsum()
        run_len = zero.groupby(run_id).transform("sum")
        flag = zero & (run_len >= ZERO_RUN_WEEKS)
        df.loc[g.index[flag], "status"] = "suspected_reporting_gap"

    df["period"] = np.where(df["period_start"] >= COVID_START, "covid_disruption", "pre_covid")
    df = weeks.add_week_columns(df)

    modeling = [g for g in sorted(medians.index) if g not in low_count and g not in SPATIAL_MISMATCH]
    report = {
        "rows": len(df),
        "cities": int(df["geography_id"].nunique()),
        "week_convention": "Sun-Sat; CCHAIN Monday label - 1 day",
        "first_week": str(df["period_start"].min().date()),
        "last_week": str(df["period_start"].max().date()),
        "status_counts": df["status"].value_counts().to_dict(),
        "absent_weeks": sorted({str(d.date()) for d in df.loc[df["status"] == "absent_upstream", "period_start"]}),
        "low_count_cities": {g: str(names[g]) for g in low_count},
        "spatial_mismatch_cities": {str(names[g]): why for g, why in SPATIAL_MISMATCH.items()},
        "modeling_cities": {g: str(names[g]) for g in modeling},
        "median_weekly_cases_pre_covid": {str(names[g]): float(m) for g, m in medians.items()},
        "suspected_gap_weeks_by_city": (
            df[df["status"] == "suspected_reporting_gap"].groupby("geography_name").size().to_dict()
        ),
    }
    cols = ["geography_id", "geography_name", "period_start", "period_end", "epi_year", "epi_week",
            "source_week_label", "cases", "status", "period", "upstream_id"]
    return df[cols], report


def cchain_daily() -> tuple[pd.DataFrame, dict]:
    """Population-weighted city means of CCHAIN daily barangay climate."""
    cities = pd.read_csv(RAW / "location.csv")[["adm3_pcode", "adm4_pcode"]]
    pop = pd.read_csv(RAW / "worldpop_population.csv", usecols=["adm4_pcode", "date", "pop_count_total"])
    pop = pop[pd.to_datetime(pop["date"]).dt.year == POPULATION_YEAR]
    weights = cities.merge(pop[["adm4_pcode", "pop_count_total"]], on="adm4_pcode", how="left")
    missing_weight = int(weights["pop_count_total"].isna().sum())
    weights = weights.dropna(subset=["pop_count_total"]).set_index("adm4_pcode")
    weights["geography_id"] = weights["adm3_pcode"].map(geography.cchain_ids())
    assert weights["geography_id"].notna().all(), "CCHAIN city missing from geography crosswalk"

    variables = list(CLIMATE_VARIABLES)
    parts = []
    for chunk in pd.read_csv(RAW / "climate_atmosphere.csv",
                             usecols=["adm4_pcode", "date", "freq", *variables],
                             chunksize=2_000_000):
        chunk = chunk[(chunk["freq"] == "D") & chunk["adm4_pcode"].isin(weights.index)]
        chunk["geography_id"] = chunk["adm4_pcode"].map(weights["geography_id"])
        w = chunk["adm4_pcode"].map(weights["pop_count_total"])
        agg = {}
        for v in variables:
            has = chunk[v].notna()
            agg[f"{v}_wsum"] = (chunk[v] * w).where(has, 0.0)
            agg[f"{v}_w"] = w.where(has, 0.0)
        agg["pr_brgy"] = chunk["pr"].notna().astype(int)
        agg["brgy"] = 1
        parts.append(pd.DataFrame(agg).assign(geography_id=chunk["geography_id"], date=chunk["date"])
                     .groupby(["geography_id", "date"]).sum())
    daily = pd.concat(parts).groupby(level=[0, 1]).sum().reset_index()
    for v, spec in CLIMATE_VARIABLES.items():
        daily[spec["canonical"]] = daily[f"{v}_wsum"] / daily[f"{v}_w"].replace(0, np.nan)
    daily["date"] = pd.to_datetime(daily["date"])
    daily["rain_partial_area"] = daily["pr_brgy"] < daily["brgy"]
    return daily[["geography_id", "date", *VARS, "rain_partial_area"]], {
        "barangays_without_population_weight": missing_weight,
        "population_weight_year": POPULATION_YEAR,
    }


def weekly_from_daily(daily: pd.DataFrame, end: pd.Timestamp) -> pd.DataFrame:
    """Daily -> canonical weeks, keeping only weeks fully inside the source range."""
    daily = daily.assign(period_start=weeks.period_start(daily["date"]))
    first = daily["period_start"].min()
    if daily["date"].min() > first:
        first += pd.Timedelta(days=7)
    last = weeks.period_start(pd.Series([end])).iloc[0]
    if last + pd.Timedelta(days=6) > end:
        last -= pd.Timedelta(days=7)
    daily = daily[daily["period_start"].between(first, last)]

    wk = daily.groupby(["geography_id", "period_start"])
    weekly = pd.DataFrame({
        "precipitation_mm": wk["precipitation_mm"].sum(min_count=1),
        **{v: wk[v].mean() for v in VARS if v != "precipitation_mm"},
    })
    counts = wk[VARS].count()
    weekly = weekly.where(counts == 7)
    weekly["days_observed"] = counts.min(axis=1)
    extra = [c for c in ("rain_partial_area", "retrieved_at", "grid_cell") if c in daily]
    for c in extra:
        weekly[c] = wk[c].max()
    grid = pd.MultiIndex.from_product(
        [sorted(daily["geography_id"].unique()), pd.date_range(first, last, freq="W-SUN")],
        names=["geography_id", "period_start"],
    )
    weekly = weekly.reindex(grid)
    weekly["days_observed"] = weekly["days_observed"].fillna(0).astype(int)
    return weekly.reset_index()


def qc(weekly: pd.DataFrame) -> pd.Series:
    flags = pd.DataFrame(index=weekly.index)
    flags["incomplete_week"] = weekly["days_observed"] < 7
    out_of_range = pd.Series(False, index=weekly.index)
    for v, (lo, hi) in RANGE.items():
        out_of_range |= weekly[v].notna() & ~weekly[v].between(lo, hi)
    order = (weekly["temperature_min_c"] <= weekly["temperature_mean_c"]) & \
            (weekly["temperature_mean_c"] <= weekly["temperature_max_c"])
    flags["range_check_failed"] = out_of_range | (weekly["temperature_mean_c"].notna() & ~order)
    if "rain_partial_area" in weekly:
        flags["rain_partial_area"] = weekly["rain_partial_area"].fillna(False).astype(bool)
    if "provisional" in weekly:
        flags["provisional_era5t"] = weekly["provisional"].fillna(False).astype(bool)
    joined = flags.apply(lambda r: ";".join(c for c in flags.columns if r[c]), axis=1)
    return joined.replace("", "ok")


def build_weather(geo: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    cchain, creport = cchain_daily()
    cweekly = weekly_from_daily(cchain, cchain["date"].max())
    cweekly["source_id"] = "cchain"
    cweekly["retrieved_at"] = json.loads(manifest_path("cchain").read_text())["climate_atmosphere.csv"]["retrieved_at"]

    om = open_meteo.load_daily(geo)
    oweekly = weekly_from_daily(om, pd.Timestamp(OPEN_METEO["end"]))
    oweekly["source_id"] = "open_meteo"
    retrieved = pd.to_datetime(oweekly["retrieved_at"]).dt.tz_localize(None)
    oweekly["provisional"] = (retrieved - (oweekly["period_start"] + pd.Timedelta(days=6))).dt.days \
        < OPEN_METEO["provisional_days"]

    df = pd.concat([cweekly, oweekly], ignore_index=True)
    df["qc_flag"] = qc(df)
    df["confidence"] = np.select(
        [df["qc_flag"].str.contains("incomplete_week|range_check_failed"),
         df["source_id"].eq("cchain") & df["qc_flag"].eq("ok"),
         df["qc_flag"].str.contains("provisional_era5t")],
        ["LOW", "HIGH", "LOW"], default="MEDIUM",
    )
    for sid, meta in WEATHER_SOURCES.items():
        for k, v in meta.items():
            df.loc[df["source_id"] == sid, k] = v

    has = df[VARS].notna().any(axis=1)
    cov = df[has].groupby(["geography_id", "source_id"])["period_start"].agg(["min", "max"])
    df = df.join(cov, on=["geography_id", "source_id"])
    df["coverage_start"] = df.pop("min")
    df["coverage_end"] = df.pop("max") + pd.Timedelta(days=6)

    names = geo.set_index("geography_id")
    df["geography_name"] = df["geography_id"].map(names["geography_name"])
    df["geographic_level"] = df["geography_id"].map(names["geographic_level"])
    df["temporal_resolution"] = "weekly"
    df["evidence_type"] = "FORMAL_OBSERVATION"
    df["is_sample"] = False
    df = weeks.add_week_columns(df)
    cols = ["geography_id", "geography_name", "geographic_level", "period_start", "period_end",
            "epi_year", "epi_week", "temporal_resolution", "source_id", "upstream_product",
            "aggregation_method", *VARS, "days_observed", "qc_flag", "confidence",
            "coverage_start", "coverage_end", "grid_cell", "source_url", "retrieved_at",
            "evidence_type", "is_sample"]
    df = df[cols].sort_values(["geography_id", "source_id", "period_start"]).reset_index(drop=True)
    assert not df.duplicated(["geography_id", "period_start", "source_id"]).any()

    by_source = {}
    for sid, g in df.groupby("source_id"):
        by_source[sid] = {
            "rows": len(g),
            "geographies": int(g["geography_id"].nunique()),
            "first_week": str(g["period_start"].min().date()),
            "last_week": str(g["period_start"].max().date()),
            "qc_flag_counts": g["qc_flag"].value_counts().to_dict(),
            "confidence_counts": g["confidence"].value_counts().to_dict(),
            "missing_values": {v: int(g[v].isna().sum()) for v in VARS},
            "aggregation_method": WEATHER_SOURCES[sid]["aggregation_method"],
        }
    report = {"week_convention": "Sun-Sat (environment.weeks)", "variables": WEATHER_VARIABLES,
              "by_source": by_source, "cchain": creport}
    return df, report


def main() -> None:
    inputs = verified_inputs("cchain", HDX_DATASETS["cchain"]["resources"])
    geo = geography.load()
    inputs |= verified_inputs("open_meteo", open_meteo.expected_files(geo))
    OUT.mkdir(parents=True, exist_ok=True)
    names = geo.set_index("geography_id")["geography_name"]
    dengue, dq = build_dengue(names)
    weather, wq = build_weather(geo)
    dengue.to_csv(OUT / "city_weekly_dengue.csv", index=False, date_format="%Y-%m-%d")
    weather.to_csv(OUT / "city_weekly_weather.csv", index=False, date_format="%Y-%m-%d", float_format="%.3f")
    report = {
        # Open-Meteo has one input per geography x year; list them compactly.
        "inputs": {k: v for k, v in inputs.items() if not k.startswith("open_meteo/")} | {
            "open_meteo": {"files": sum(k.startswith("open_meteo/") for k in inputs),
                           "sha256_of_manifest_hashes": _digest(
                               [v["sha256"] for k, v in sorted(inputs.items()) if k.startswith("open_meteo/")]),
                           "request": {k: OPEN_METEO[k] for k in ("model", "timezone", "start", "end")}},
        },
        "dengue": dq,
        "weather": wq,
    }
    (OUT / "quality_report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "inputs"}, indent=2, default=str))


def _digest(hashes: list[str]) -> str:
    return hashlib.sha256("".join(hashes).encode()).hexdigest()


if __name__ == "__main__":
    main()
