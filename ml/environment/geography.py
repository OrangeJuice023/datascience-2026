"""Build the city geography table every environment output is keyed on.

    python -m environment.geography   # -> data/processed/environment/geography.csv

geography_id is the canonical SIGMA geography id from the geography track
(e.g. "davao-city"; data/reference/geo/geography_hub_rows.csv). CCHAIN keys
its files on 2016 COD-AB adm3 pcodes ("PH" + 9 digits), kept here as
cchain_adm3_pcode and translated to geography_id on read. Decision and
caveats: docs/environmental-covariates.md §4.6.

Rows come from ml/environment/geography_crosswalk.csv (tracked, hand-curated):
  - CCHAIN cities: ids, codes and HDX units are copied from the geography
    track's data/reference/geo/cchain_city_crosswalk.csv and checked against it
    on every build. latitude/longitude are left blank there and computed here as
    the WorldPop-2020 population-weighted mean of barangay polygon centroids
    (CCHAIN brgy_geography). This is the point Open-Meteo is queried at.
  - LGUs outside CCHAIN: add a row with the canonical id, name and a centroid taken
    from a named, verified source (`coordinate_source`). Nothing is geocoded
    from a name automatically.
The HDX DOH-Epi location names used by environment.crosscheck live in the same
file, so one table holds every cross-source join.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from .paths import OUT, REPO, raw_dir, verified_inputs

RAW = raw_dir("cchain")
CROSSWALK = Path(__file__).with_name("geography_crosswalk.csv")
GEO_REFERENCE = REPO / "data" / "reference" / "geo"
POPULATION_YEAR = 2020


def polygon_centroid(wkt: str) -> tuple[float, float]:
    """Area-weighted centroid (lon, lat) of a WKT POLYGON's outer ring."""
    if not wkt.startswith("POLYGON (("):
        raise ValueError(f"unsupported geometry {wkt[:20]!r}")
    ring = wkt[len("POLYGON (("):].split(")")[0]
    xy = np.array([[float(v) for v in p.split()] for p in ring.split(",")])
    x, y = xy[:, 0], xy[:, 1]
    cross = x[:-1] * y[1:] - x[1:] * y[:-1]
    area = cross.sum() / 2
    return (float(((x[:-1] + x[1:]) * cross).sum() / (6 * area)),
            float(((y[:-1] + y[1:]) * cross).sum() / (6 * area)))


def load_crosswalk() -> pd.DataFrame:
    xw = pd.read_csv(CROSSWALK, dtype=str)
    if xw["geography_id"].duplicated().any():
        raise SystemExit(f"duplicate geography_id in {CROSSWALK.name}")
    return xw


def cchain_ids() -> pd.Series:
    """CCHAIN adm3 pcode -> geography_id, for reading CCHAIN files."""
    xw = load_crosswalk().dropna(subset=["cchain_adm3_pcode"])
    return xw.set_index("cchain_adm3_pcode")["geography_id"]


def check_reference(xw: pd.DataFrame) -> None:
    """Fail if the crosswalk drifts from the geography track's reference tables."""
    ref = pd.read_csv(GEO_REFERENCE / "cchain_city_crosswalk.csv", dtype=str).set_index("cchain_adm3_pcode")
    hub = pd.read_csv(GEO_REFERENCE / "geography_hub_rows.csv", dtype=str).set_index("geography_id")
    cc = xw.dropna(subset=["cchain_adm3_pcode"]).set_index("cchain_adm3_pcode")
    if set(cc.index) != set(ref.index):
        raise SystemExit(f"CCHAIN cities in {CROSSWALK.name} differ from cchain_city_crosswalk.csv")
    pairs = {"cod_ab_adm3_pcode": "cod_ab_adm3_pcode", "psgc_code": "psa_psgc_code",
             "hdx_unit_id": "hdx_unit_id", "hdx_unit_relation": "relation"}
    for ours, theirs in pairs.items():
        bad = cc.index[cc[ours] != ref.loc[cc.index, theirs]]
        if len(bad):
            raise SystemExit(f"{ours} disagrees with cchain_city_crosswalk.csv for {sorted(bad)}")
    same = cc[cc["hdx_unit_relation"] == "same_area"]
    if (same["geography_id"] != same["hdx_unit_id"]).any():
        raise SystemExit("same_area cities must use their HDX unit id as geography_id")
    in_hub = xw[xw["geography_id"].isin(hub.index)]
    if (in_hub["psgc_code"] != hub.loc[in_hub["geography_id"], "psgc_code"].values).any():
        raise SystemExit("psgc_code disagrees with geography_hub_rows.csv")


def build() -> pd.DataFrame:
    loc = pd.read_csv(RAW / "location.csv")
    geo = pd.read_csv(RAW / "brgy_geography.csv", usecols=["adm4_pcode", "geometry"])
    pop = pd.read_csv(RAW / "worldpop_population.csv", usecols=["adm4_pcode", "date", "pop_count_total"])
    pop = pop[pd.to_datetime(pop["date"]).dt.year == POPULATION_YEAR]

    cent = geo.set_index("adm4_pcode")["geometry"].map(polygon_centroid)
    brgy = loc.assign(
        lon=loc["adm4_pcode"].map(cent.str[0]),
        lat=loc["adm4_pcode"].map(cent.str[1]),
    ).merge(pop[["adm4_pcode", "pop_count_total"]], on="adm4_pcode", how="left")
    if brgy[["lon", "lat"]].isna().any().any():
        raise SystemExit("barangay without geometry in brgy_geography.csv")

    w = brgy.dropna(subset=["pop_count_total"])
    city = w.groupby("adm3_pcode").apply(lambda g: pd.Series({
        "latitude": np.average(g["lat"], weights=g["pop_count_total"]),
        "longitude": np.average(g["lon"], weights=g["pop_count_total"]),
        "population_2020": g["pop_count_total"].sum(),
    }), include_groups=False)
    names = brgy.drop_duplicates("adm3_pcode").set_index("adm3_pcode")
    xw = load_crosswalk()
    check_reference(xw)
    ids = cchain_ids()
    missing = set(names.index) - set(ids.index)
    if missing:
        raise SystemExit(f"CCHAIN cities {sorted(missing)} missing from {CROSSWALK.name}")
    cchain = pd.DataFrame({
        "geography_id": ids[names.index].values,
        "geography_name": names["adm3_en"].values,
        "geographic_level": "municipal",
        "cchain_adm3_pcode": names.index,
        "province_name": names["adm2_en"].values,
        "region_name": names["adm1_en"].values,
        "in_cchain": True,
        "barangays": brgy.groupby("adm3_pcode").size().reindex(names.index).values,
        "population_2020": city["population_2020"].reindex(names.index).round().astype(int).values,
        "latitude": city["latitude"].reindex(names.index).round(4).values,
        "longitude": city["longitude"].reindex(names.index).round(4).values,
        "coordinate_method": f"population_weighted_barangay_centroid (WorldPop {POPULATION_YEAR})",
    })

    unknown = set(xw.loc[xw["latitude"].isna(), "geography_id"]) - set(cchain["geography_id"])
    if unknown:
        raise SystemExit(f"{sorted(unknown)} are not CCHAIN cities and have no coordinates in {CROSSWALK.name}")
    links = ["psgc_code", "hdx_unit_id", "hdx_unit_relation", "hdx_doh_epi_loc", "hdx_doh_epi_province", "notes"]
    out = cchain.merge(xw[["geography_id", *links]], on="geography_id", how="left")

    extra = xw[xw["latitude"].notna()]
    if len(extra):
        if extra["coordinate_source"].isna().any():
            raise SystemExit(f"rows with coordinates need coordinate_source in {CROSSWALK.name}")
        out = pd.concat([out, pd.DataFrame({
            "geography_id": extra["geography_id"],
            "geography_name": extra["geography_name"],
            "geographic_level": "municipal",
            "in_cchain": False,
            "latitude": extra["latitude"].astype(float),
            "longitude": extra["longitude"].astype(float),
            "coordinate_method": "point: " + extra["coordinate_source"],
            **{c: extra[c] for c in links},
        })], ignore_index=True)
    return out.sort_values("geography_id").reset_index(drop=True)


def load() -> pd.DataFrame:
    """Read the built table; fail clearly if `geography` has not been run."""
    path = OUT / "geography.csv"
    if not path.exists():
        raise SystemExit("data/processed/environment/geography.csv missing; run `python -m environment.geography`")
    return pd.read_csv(path, dtype={"geography_id": str, "cchain_adm3_pcode": str, "psgc_code": str})


def main() -> None:
    verified_inputs("cchain", ["location.csv", "brgy_geography.csv", "worldpop_population.csv"])
    OUT.mkdir(parents=True, exist_ok=True)
    out = build()
    out.to_csv(OUT / "geography.csv", index=False)
    print(out[["geography_id", "geography_name", "barangays", "latitude", "longitude"]].to_string(index=False))


if __name__ == "__main__":
    main()
