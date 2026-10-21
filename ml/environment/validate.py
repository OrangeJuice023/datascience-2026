"""Validation checks on the environment outputs. Exits non-zero on any failure.

    python -m environment.validate

Run after build, crosscheck, compare and export. Checks the week convention,
geography joins, the no-zero-fill rule, source separation, coverage, the
features look-ahead guard and that the hub/web exports match the build.
"""

import json
import re
import sys

import numpy as np
import pandas as pd

from . import compare, features, geography, weeks
from .export import HUB_COLUMNS, WEB_JSON
from .paths import OUT
from .sources import OPEN_METEO, WEATHER_VARIABLES

VARS = list(WEATHER_VARIABLES)
FAILURES: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("PASS " if ok else "FAIL ") + what)
    if not ok:
        FAILURES.append(what)


def contiguous(df: pd.DataFrame, by: list[str]) -> bool:
    return bool(df.sort_values("period_start").groupby(by)["period_start"]
                .apply(lambda s: (s.diff().dropna() == pd.Timedelta(days=7)).all()).all())


def week_columns_ok(df: pd.DataFrame) -> bool:
    ew = weeks.epi_week(df["period_start"])
    return bool((df["period_start"].dt.dayofweek == 6).all()
                and (df["period_end"] - df["period_start"] == pd.Timedelta(days=6)).all()
                and (df["epi_year"] == ew["epi_year"]).all() and (df["epi_week"] == ew["epi_week"]).all())


def main() -> None:
    geo = geography.load()
    weather = compare.load()
    dengue = pd.read_csv(OUT / "city_weekly_dengue.csv", dtype={"geography_id": str},
                         parse_dates=["period_start", "period_end", "source_week_label"])
    report = json.loads((OUT / "quality_report.json").read_text())
    xcheck = json.loads((OUT / "crosscheck.json").read_text())
    ids = set(geo["geography_id"])

    print("-- geography")
    check(geo["geography_id"].map(lambda s: bool(re.fullmatch(r"PH\d{9}", s))).all(),
          "geography_id is a COD-AB pcode (PH + 9 digits)")
    check(not geo["geography_id"].duplicated().any(), "geography_id unique")
    check(geo[["latitude", "longitude"]].notna().all().all()
          and geo["latitude"].between(4.5, 21.5).all() and geo["longitude"].between(116, 127).all(),
          "every geography has a centroid inside the Philippines")
    check(set(weather["geography_id"]) <= ids and set(dengue["geography_id"]) <= ids,
          "weather and dengue geography_ids all resolve in geography.csv")

    print("-- week convention")
    check(week_columns_ok(dengue), "dengue: Sun-Sat weeks, MMWR epi_year/epi_week")
    check(week_columns_ok(weather), "weather: Sun-Sat weeks, MMWR epi_year/epi_week")
    check(bool((dengue["source_week_label"] - dengue["period_start"]
                == pd.Timedelta(days=-weeks.SOURCE_WEEK_OFFSET_DAYS["cchain_pidsr"])).all()),
          "dengue: CCHAIN Monday label = period_start + 1 d")
    check(xcheck["best_offset_days"] == weeks.SOURCE_WEEK_OFFSET_DAYS["hdx_doh_epi"],
          f"crosscheck: HDX best offset {xcheck['best_offset_days']} d matches configured offset")
    known = pd.DataFrame({"period_start": pd.to_datetime(["2008-12-28", "2009-01-04", "2014-12-28", "2015-01-04",
                                                          "2020-12-27", "2021-01-03"])})
    got = weeks.epi_week(known["period_start"]).apply(tuple, axis=1).tolist()
    check(got == [(2008, 53), (2009, 1), (2014, 53), (2015, 1), (2020, 53), (2021, 1)],
          "epi_week matches MMWR calendar on known year boundaries")

    print("-- keys, grid, no zero-fill")
    check(not dengue.duplicated(["geography_id", "period_start"]).any(), "dengue: one row per city-week")
    check(not weather.duplicated(["geography_id", "period_start", "source_id"]).any(),
          "weather: one row per city-week-source")
    check(contiguous(dengue, ["geography_id"]), "dengue: complete weekly grid per city")
    check(contiguous(weather, ["geography_id", "source_id"]), "weather: complete weekly grid per city-source")
    check(bool(dengue.loc[dengue["status"] == "absent_upstream", "cases"].isna().all()
               and dengue.loc[dengue["status"] != "absent_upstream", "cases"].notna().all()),
          "dengue: cases empty exactly where absent upstream")
    complete = weather[VARS].notna().all(axis=1)
    check(bool((weather.loc[weather[VARS].notna().any(axis=1), "days_observed"] == 7).all()),
          "weather: no weekly value built from fewer than 7 days")
    check(bool(weather.loc[~complete, "qc_flag"].str.contains("incomplete_week").all()),
          "weather: every row with a missing value is flagged incomplete_week")
    check(not weather["qc_flag"].str.contains("range_check_failed").any(),
          f"weather: no range_check_failed rows ({weather['qc_flag'].str.contains('range_check_failed').sum()})")
    check(set(weather["confidence"]) <= {"HIGH", "MEDIUM", "LOW"}, "weather: confidence in HIGH/MEDIUM/LOW")

    print("-- sources and coverage")
    check(set(weather["source_id"]) == {"cchain", "open_meteo"}, "weather: sources are cchain and open_meteo")
    per = weather.groupby("source_id").agg(first=("coverage_start", "min"), last=("coverage_end", "max"),
                                           n=("geography_id", "nunique"))
    check(per.loc["cchain", "n"] == 12 and str(per.loc["cchain", "last"].date()) == "2022-12-31",
          f"cchain covers 12 cities to 2022-12-31 (from {per.loc['cchain', 'first'].date()})")
    check(str(per.loc["open_meteo", "first"].date()) == OPEN_METEO["start"]
          and str(per.loc["open_meteo", "last"].date()) == OPEN_METEO["end"]
          and per.loc["open_meteo", "n"] == len(geo),
          f"open_meteo covers every geography {OPEN_METEO['start']}..{OPEN_METEO['end']}")
    om = weather[weather["source_id"] == "open_meteo"]
    check(om["grid_cell"].notna().all() and weather.loc[weather["source_id"] == "cchain", "grid_cell"].isna().all(),
          "grid_cell set for point source only")
    prov = om[om["qc_flag"].str.contains("provisional_era5t")]
    check(len(prov) > 0 and prov["period_start"].min() > pd.Timestamp(OPEN_METEO["end"]) - pd.Timedelta(days=120),
          f"recent Open-Meteo weeks flagged provisional_era5t ({len(prov)} rows)")
    check(len(report["dengue"]["modeling_cities"]) == 9, "9 modeling cities")

    print("-- features: source separation and no look-ahead")
    cut = "2015-12-26"
    full = features.anomalies(weather, train_end=cut)
    trunc = features.anomalies(weather[weather["period_end"] <= pd.Timestamp(cut)], train_end=cut)
    a = full[full["period_end"] <= pd.Timestamp(cut)].set_index(["geography_id", "source_id", "period_start"])
    b = trunc.set_index(["geography_id", "source_id", "period_start"]).reindex(a.index)
    zc = [c for c in a.columns if c.endswith("_z")]
    check(bool(np.allclose(a[zc].to_numpy(float), b[zc].to_numpy(float), equal_nan=True)),
          "anomalies before train_end do not change when later data is removed")
    x = features.model_inputs(weather, train_end=cut)
    check(not x.duplicated(["geography_id", "period_start"]).any(), "model_inputs: one row per city-week")
    cc_ids = set(weather.loc[weather["source_id"] == "cchain", "geography_id"])
    in_cc = x[x["geography_id"].isin(cc_ids) & (x["period_end"] <= pd.Timestamp("2022-12-31"))]
    check(bool((in_cc["source_id"] == "cchain").all()), "model_inputs: CCHAIN used wherever it has data")
    check(bool(x.loc[x["period_start"] > pd.Timestamp("2022-12-31"), "source_id"].eq("open_meteo").all()),
          "model_inputs: Open-Meteo used only after CCHAIN ends")
    check(bool(x.loc[(x["period_start"] >= pd.Timestamp("2023-01-01"))
                     & (x["period_start"] < pd.Timestamp("2023-03-26")), "mixed_source_window"].all()
               and not x.loc[x["period_start"] < pd.Timestamp("2022-12-25"), "mixed_source_window"].any()),
          "model_inputs: windows straddling the 2022/23 splice flagged mixed_source_window")

    blocked = features.not_interchangeable()
    late = x[x["period_start"] > pd.Timestamp("2022-12-31")]
    check(bool(all(late[f"{v}_z"].isna().all() for v in blocked)),
          f"model_inputs: not-interchangeable variables {blocked} empty on Open-Meteo rows of a spliced series")
    solo = features.model_inputs(weather, train_end=cut, sources=["open_meteo"])
    check(bool(solo["source_id"].eq("open_meteo").all() and solo["precipitation_mm_z"].notna().mean() > 0.99),
          "model_inputs: single-source Open-Meteo run keeps every variable")

    print("-- comparability and exports")
    comp = json.loads((OUT / "weather_comparability.json").read_text())["verdicts_modeling_cities"]
    check(set(comp) == set(VARS), "comparability verdict for every variable")
    hub = pd.read_csv(OUT / "hub_environment.csv")
    check(list(hub.columns) == HUB_COLUMNS and len(hub) == len(weather), "hub_environment.csv matches build")
    web = json.loads(WEB_JSON.read_text())
    n_web = sum(len(s["daysObserved"]) for s in web["series"])
    check(n_web == len(weather) and all(len(s["values"][v]) == len(s["daysObserved"])
                                        for s in web["series"] for v in VARS),
          f"web bundle has every weather row ({n_web})")

    print(f"\n{len(FAILURES)} failure(s)")
    sys.exit(1 if FAILURES else 0)


if __name__ == "__main__":
    main()
