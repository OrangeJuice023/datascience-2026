"""Build the city geography table every environment output is keyed on.

    python -m environment.geography   # -> data/processed/environment/geography.csv

geography_id is the OCHA COD-AB adm3 pcode ("PH" + 9-digit PSGC as of the
2016 COD-AB release), which is what CCHAIN uses. Decision and caveats:
docs/environmental-covariates.md §4.6.

Rows come from ml/environment/geography_crosswalk.csv (tracked, hand-curated):
  - CCHAIN cities: latitude/longitude are left blank there and computed here as
    the WorldPop-2020 population-weighted mean of barangay polygon centroids
    (CCHAIN brgy_geography). This is the point Open-Meteo is queried at.
  - LGUs outside CCHAIN: add a row with the pcode, name and a centroid taken
    from a named, verified source (`coordinate_source`). Nothing is geocoded
    from a name automatically.
The HDX DOH-Epi location names used by environment.crosscheck live in the same
file, so one table holds every cross-source join.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from .paths import OUT, raw_dir, verified_inputs

RAW = raw_dir("cchain")
CROSSWALK = Path(__file__).with_name("geography_crosswalk.csv")
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
    cchain = pd.DataFrame({
        "geography_id": names.index,
        "geography_name": names["adm3_en"].values,
        "geographic_level": "municipal",
        "province_id": names["adm2_pcode"].values,
        "province_name": names["adm2_en"].values,
        "region_id": names["adm1_pcode"].values,
        "region_name": names["adm1_en"].values,
        "in_cchain": True,
        "barangays": brgy.groupby("adm3_pcode").size().reindex(names.index).values,
        "population_2020": city["population_2020"].reindex(names.index).round().astype(int).values,
        "latitude": city["latitude"].reindex(names.index).round(4).values,
        "longitude": city["longitude"].reindex(names.index).round(4).values,
        "coordinate_method": f"population_weighted_barangay_centroid (WorldPop {POPULATION_YEAR})",
    })

    xw = load_crosswalk()
    unknown = set(xw.loc[xw["latitude"].isna(), "geography_id"]) - set(cchain["geography_id"])
    if unknown:
        raise SystemExit(f"{sorted(unknown)} are not CCHAIN cities and have no coordinates in {CROSSWALK.name}")
    missing = set(cchain["geography_id"]) - set(xw["geography_id"])
    if missing:
        raise SystemExit(f"CCHAIN cities {sorted(missing)} missing from {CROSSWALK.name}")
    out = cchain.merge(xw[["geography_id", "hdx_doh_epi_loc", "hdx_doh_epi_province", "notes"]],
                       on="geography_id", how="left")

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
            "hdx_doh_epi_loc": extra["hdx_doh_epi_loc"],
            "hdx_doh_epi_province": extra["hdx_doh_epi_province"],
            "notes": extra["notes"],
        })], ignore_index=True)
    return out.sort_values("geography_id").reset_index(drop=True)


def load() -> pd.DataFrame:
    """Read the built table; fail clearly if `geography` has not been run."""
    path = OUT / "geography.csv"
    if not path.exists():
        raise SystemExit("data/processed/environment/geography.csv missing; run `python -m environment.geography`")
    return pd.read_csv(path, dtype={"geography_id": str})


def main() -> None:
    verified_inputs("cchain", ["location.csv", "brgy_geography.csv", "worldpop_population.csv"])
    OUT.mkdir(parents=True, exist_ok=True)
    out = build()
    out.to_csv(OUT / "geography.csv", index=False)
    print(out[["geography_id", "geography_name", "barangays", "latitude", "longitude"]].to_string(index=False))


if __name__ == "__main__":
    main()
