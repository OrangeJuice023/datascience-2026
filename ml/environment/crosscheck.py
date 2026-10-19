"""Cross-check CCHAIN PIDSR city-weekly dengue against HDX DOH-Epi 2016-2021.

The two files are independent extracts of DOH surveillance. Comparing them on
the cities they share tells us (a) which week label offset lines them up and
(b) whether a CCHAIN "city" series really covers that city.

Output: data/processed/environment/crosscheck.json

    python -m environment.crosscheck
"""

import json

import pandas as pd

from .paths import OUT, raw_dir, verified_inputs

RAW = raw_dir("cchain")
HDX_NAME = "DOH-Epi Dengue Data 2016-2021.csv"
HDX = raw_dir("hdx_dengue") / HDX_NAME

# CCHAIN adm3_en -> HDX `loc` (after stripping whitespace).
CITY_TO_HDX = {
    "Cagayan de Oro City": "CAGAYAN DE ORO CITY",
    "City of Mandaluyong": "MANDALUYONG CITY",
    "City of Muntinlupa": "MUNTINLUPA CITY",
    "City of Navotas": "NAVOTAS CITY",
    "Dagupan City": "DAGUPAN CITY",
    "Davao City": "DAVAO CITY",
    "Iloilo City": "ILOILO CITY",
    "Mandaue City": "MANDAUE CITY",
    "Tacloban City": "TACLOBAN",
    "Zamboanga City": "ZAMBOANGA CITY",
}
# Province-level HDX series to test against, in case a city series is really
# its province.
CITY_TO_PROVINCE = {"Iloilo City": "ILOILO", "Tacloban City": "LEYTE"}
OFFSETS_DAYS = [-27, -20, -13, -6, 1, 8]  # HDX Sunday + offset -> CCHAIN Monday


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    pidsr = pd.read_csv(RAW / "disease_pidsr_totals.csv")
    pidsr = pidsr[pidsr["disease_common_name"] == "DENGUE FEVER"]
    names = pd.read_csv(RAW / "location.csv").drop_duplicates("adm3_pcode").set_index("adm3_pcode")["adm3_en"]
    pidsr = pidsr.assign(city=pidsr["adm3_pcode"].map(names), date=pd.to_datetime(pidsr["date"]))
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
    inputs = verified_inputs("cchain", ["disease_pidsr_totals.csv", "location.csv"])
    inputs |= verified_inputs("hdx_dengue", [HDX_NAME])
    pidsr, hdx = load()
    a_of = {c: pidsr[pidsr["city"] == c].set_index("date")["case_total"] for c in CITY_TO_HDX}
    b_of = lambda loc: hdx[hdx["loc"] == loc].set_index("date")["cases"]

    by_offset = {}
    for off in OFFSETS_DAYS:
        rows = {c: compare(a_of[c], b_of(h), off) for c, h in CITY_TO_HDX.items()}
        by_offset[off] = {
            "mean_pearson_r": round(sum(r["pearson_r"] for r in rows.values()) / len(rows), 3),
            "cities": rows,
        }
    best = max(by_offset, key=lambda o: by_offset[o]["mean_pearson_r"])
    province = {c: compare(a_of[c], b_of(p), best) | {"hdx_province": p} for c, p in CITY_TO_PROVINCE.items()}

    report = {
        "inputs": inputs,
        "hdx_weekday": sorted(hdx["date"].dt.day_name().unique().tolist()),
        "best_offset_days": best,
        "by_offset": by_offset,
        "city_vs_province_at_best_offset": province,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "crosscheck.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"best offset {best} d; mean r by offset:",
          {o: v["mean_pearson_r"] for o, v in by_offset.items()})
    for c, p in province.items():
        print(f"{c}: vs city {by_offset[best]['cities'][c]} | vs province {p}")


if __name__ == "__main__":
    main()
