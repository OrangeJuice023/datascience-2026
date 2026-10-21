"""Export the local (reporting-unit) dengue results for the web map's SIGMA mode.

Input:  data/processed/dengue_cases_combined.xlsx (ml/clean_dengue.py)
        data/processed/dengue_ears.xlsx           (ml/ears.py)
        data/reference/geo/hdx_dengue_crosswalk.csv (scripts/geo/build-geo.mjs)
Output: web/public/data/sigma/hdx-dengue-sigma.json (generated; do not edit by hand)

One record per HDX reporting unit, joined on the crosswalk's ml_geography_name
and keyed by the canonical unit id that the map's boundaries use. Each series
is an array over the same weekly calendar (meta.weeks), stored column-wise with
small integer codes (meta.codes) to keep the file small. Unit names, types and
label points come from the crosswalk, so the map needs only this file and the
boundaries from scripts/geo/build-boundaries.mjs. Weeks whose
data_quality is not "ok" keep a null value: missing and suspect-swap weeks are
never sent as zero. National rows are not exported (the map's Disease mode
already shows the national series).
"""
import json
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
COMBINED = REPO / "data" / "processed" / "dengue_cases_combined.xlsx"
EARS = REPO / "data" / "processed" / "dengue_ears.xlsx"
CROSSWALK = REPO / "data" / "reference" / "geo" / "hdx_dengue_crosswalk.csv"
OUT = REPO / "web" / "public" / "data" / "sigma" / "hdx-dengue-sigma.json"

QUALITY = ["ok", "missing", "suspect swap"]
DOH = ["no baseline", "normal", "alert", "epidemic", "unreliable week"]
EARS_RESULT = ["not computed", "none", "C1", "C2", "C3", "C1+C2", "C1+C3", "C2+C3", "C1+C2+C3"]
FLAG = ["possible non-reporting", "one-week spike"]


def coded(series: pd.Series, codes: list[str]) -> list:
    unknown = set(series.dropna()) - set(codes)
    if unknown:
        raise ValueError(f"unexpected values {sorted(unknown)}; extend the code list")
    return [None if pd.isna(v) else codes.index(v) for v in series]


def numbers(series: pd.Series, decimals: int) -> list:
    return [None if pd.isna(v) else (round(float(v), decimals) if decimals else int(v)) for v in series]


def main() -> None:
    keys = ["region", "geography_name", "period_start"]
    combined = pd.read_excel(COMBINED, sheet_name="LOCAL")
    ears = pd.read_excel(EARS, sheet_name="LOCAL")[keys + ["c1_stat", "c2_stat", "c3_stat", "ears_alarm"]]
    df = combined.merge(ears, on=keys, how="left", validate="one_to_one")

    xw = pd.read_csv(CROSSWALK, dtype=str, keep_default_na=False)
    unit_of = dict(zip(xw["ml_geography_name"], xw["unit_id"]))
    meta_of = xw.set_index("unit_id")
    missing = sorted(set(df["geography_name"]) - set(unit_of))
    if missing:
        raise ValueError(f"no crosswalk unit for {missing}")
    df["unit_id"] = df["geography_name"].map(unit_of)

    weeks = sorted(df["period_start"].unique())
    # A value is only shown for "ok" weeks; anything else is no data, never zero.
    df.loc[df["data_quality"] != "ok", "value"] = None

    units = []
    for unit_id, g in df.groupby("unit_id", sort=True):
        g = g.set_index("period_start").reindex(weeks)
        if g["geography_name"].isna().any():
            raise ValueError(f"{unit_id} does not cover every week")
        computed = ~g["ears_alarm"].isin(["not computed"])
        m = meta_of.loc[unit_id]
        units.append({
            "id": unit_id,
            "name": m["unit_name"],
            "unitType": m["unit_type"],
            "regionId": m["analysis_region_id"],
            "region": g["region"].iloc[0],
            "excludes": [x for x in m["excluded_unit_ids"].split(";") if x],
            "point": [float(m["rep_lon"]), float(m["rep_lat"])],
            "mlName": g["geography_name"].iloc[0],
            "value": numbers(g["value"], 0),
            "quality": coded(g["data_quality"], QUALITY),
            "flag": coded(g["data_flag"], FLAG),
            "doh": coded(g["doh_status"], DOH),
            "alert": numbers(g["alert_threshold"], 1),
            "epidemic": numbers(g["epidemic_threshold"], 1),
            "ears": coded(g["ears_alarm"], EARS_RESULT),
            # EARS statistics only where a result was computed, to explain it.
            "c1": numbers(g["c1_stat"].where(computed), 1),
            "c2": numbers(g["c2_stat"].where(computed), 1),
            "c3": numbers(g["c3_stat"].where(computed), 1),
        })

    out = {
        "meta": {
            "description": "Weekly dengue cases, DOH thresholds and EARS results per HDX reporting unit "
                           "(2016-2021). Retrospective prototype output, not a validated public-health claim.",
            "generator": "ml/export_sigma_web.py",
            "inputs": ["ml/clean_dengue.py", "ml/ears.py", "data/reference/geo/hdx_dengue_crosswalk.csv"],
            "source": "HDX - Philippine Dengue Cases and Deaths (Cirrolytix; DOH Epidemiology Bureau data), CC BY",
            "isSample": False,
            "weeks": [pd.Timestamp(w).strftime("%Y-%m-%d") for w in weeks],
            "weekNote": "Week = the HDX `date` value, taken as the week start. Its meaning is unconfirmed; "
                        "it lines up best with OpenDengue shifted 1-2 weeks earlier.",
            "codes": {"quality": QUALITY, "doh": DOH, "ears": EARS_RESULT, "flag": FLAG},
            "ears": {"c1c2Threshold": 3.0, "c3Threshold": 2.0, "minCount": 5, "baselineWeeks": 7, "minBaseline": 5},
            "doh": "Alert = mean of the same epi week in the 3 previous years; epidemic = alert + 2 SD. From 2019.",
            "assumptions": [
                "Province rows are assumed to exclude their separately reported cities (supported, not proven).",
                "Counts are assumed to be by place of residence (unconfirmed).",
                "Suspected cases/deaths swap rows (Sep-Oct 2016, 2017, 2020) and missing weeks are no data.",
            ],
        },
        "units": units,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(units)} units x {len(weeks)} weeks -> {OUT.relative_to(REPO)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
