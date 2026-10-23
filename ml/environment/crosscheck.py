"""Cross-check CCHAIN PIDSR city-weekly dengue against HDX DOH-Epi 2016-2021.

The two files are independent extracts of DOH surveillance. Comparing them on
the cities they share tells us (a) which week label offset lines them up and
(b) whether a CCHAIN "city" series really covers that city.

Output: data/processed/environment/crosscheck.json

    python -m environment.crosscheck
"""

import json

import pandas as pd

from . import weeks
from .geography import load_crosswalk
from .paths import OUT, raw_dir, verified_inputs

RAW = raw_dir("cchain")
HDX_NAME = "DOH-Epi Dengue Data 2016-2021.csv"
HDX = raw_dir("hdx_dengue") / HDX_NAME

# Both series are compared on canonical Sun-Sat weeks (environment.weeks).
# CCHAIN moves by its fixed label offset; HDX is tried at each offset below and
# the best one is checked against weeks.SOURCE_WEEK_OFFSET_DAYS["hdx_doh_epi"].
OFFSETS_DAYS = [-28, -21, -14, -7, 0, 7]  # HDX Sunday + offset -> canonical Sunday


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    pidsr = pd.read_csv(RAW / "disease_pidsr_totals.csv")
    pidsr = pidsr[pidsr["disease_common_name"] == "DENGUE FEVER"]
    pidsr = pidsr.assign(date=weeks.from_source_label(pidsr["date"], "cchain_pidsr"))
    hdx = pd.read_csv(HDX, skiprows=[1])  # row 2 is HXL tags
    hdx = hdx.assign(loc=hdx["loc"].str.strip(), date=pd.to_datetime(hdx["date"], format="%m/%d/%Y"))
    return pidsr, hdx


def compare(a: pd.Series, b: pd.Series, offset: int) -> dict:
    b = b.copy()
    b.index = b.index + pd.Timedelta(days=offset)
    j = pd.concat([a.rename("cchain"), b.rename("hdx")], axis=1, join="inner").dropna()
    return {
        "weeks": len(j),
        "exact_match_share": round(float((j["cchain"] == j["hdx"]).mean()), 3),
        "pearson_r": round(float(j["cchain"].corr(j["hdx"])), 3),
        "volume_ratio_cchain_over_hdx": round(float(j["cchain"].sum() / j["hdx"].sum()), 3),
    }


def main() -> None:
    inputs = verified_inputs("cchain", ["disease_pidsr_totals.csv"])
    inputs |= verified_inputs("hdx_dengue", [HDX_NAME])
    pidsr, hdx = load()
    xw = load_crosswalk()
    city = xw.dropna(subset=["hdx_doh_epi_loc"]).set_index("geography_name")
    a_of = {c: pidsr[pidsr["adm3_pcode"] == code].set_index("date")["case_total"]
            for c, code in city["cchain_adm3_pcode"].items()}
    b_of = lambda loc: hdx[hdx["loc"] == loc].set_index("date")["cases"]

    by_offset = {}
    for off in OFFSETS_DAYS:
        rows = {c: compare(a_of[c], b_of(h), off) for c, h in city["hdx_doh_epi_loc"].items()}
        by_offset[off] = {
            "mean_pearson_r": round(sum(r["pearson_r"] for r in rows.values()) / len(rows), 3),
            "cities": rows,
        }
    best = max(by_offset, key=lambda o: by_offset[o]["mean_pearson_r"])
    province = {c: compare(a_of[c], b_of(p), best) | {"hdx_province": p}
                for c, p in city["hdx_doh_epi_province"].dropna().items()}

    report = {
        "inputs": inputs,
        "week_convention": "canonical Sun-Sat; CCHAIN label offset "
                           f"{weeks.SOURCE_WEEK_OFFSET_DAYS['cchain_pidsr']} d",
        "hdx_weekday": sorted(hdx["date"].dt.day_name().unique().tolist()),
        "best_offset_days": best,
        "configured_offset_days": weeks.SOURCE_WEEK_OFFSET_DAYS["hdx_doh_epi"],
        "by_offset": by_offset,
        "city_vs_province_at_best_offset": province,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "crosscheck.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"best offset {best} d; mean r by offset:",
          {o: v["mean_pearson_r"] for o, v in by_offset.items()})
    for c, p in province.items():
        print(f"{c}: vs city {by_offset[best]['cities'][c]} | vs province {p}")
    if best != weeks.SOURCE_WEEK_OFFSET_DAYS["hdx_doh_epi"]:
        raise SystemExit(f"best HDX offset {best} d differs from weeks.SOURCE_WEEK_OFFSET_DAYS; review it")


if __name__ == "__main__":
    main()
