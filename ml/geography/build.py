"""Build the canonical SIGMA geography table + alias gazetteer from PSGC.

Emits two CSVs under data/processed/:
  - geography.csv   (one row per GeographicEntity, mirroring data.ts)
  - gazetteer.csv   (alias -> geography id + psgc code + level)

Only pandas + stdlib. Parentage is derived from the PSGC foreign-key ids;
NCR highly-urbanized cities (whose `province_id` equals the NCR region_id) are
attached to the region, since NCR has no province rows.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from geography.ingest import NATIONAL_ROOT_ID, load_tables

OUT_DIR = Path("data/processed/geography")
LEVELS = {"region": "regional", "province": "provincial", "muncity": "municipal", "barangay": "barangay"}
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _prov(method: str, upstream_version: str, source_ids: list[str], sample: bool = False) -> dict:
    return {
        "sourceIds": source_ids,
        "method": method,
        "upstreamVersion": upstream_version,
        "retrievedAt": NOW,
        "recordedAt": NOW,
        "isSample": sample,
    }


def _entity(geoid: str, name: str, level: str, parent: str | None, psgc: str | None, source_ids=("psa-psgc",), sample=False) -> dict:
    return {
        "id": geoid,
        "name": name,
        "level": level,
        "parent_id": parent if parent is not None else "",
        "psgc_code": psgc if psgc is not None else "",
        "centroid_lat": "",
        "centroid_lon": "",
        "provenance": json.dumps(_prov("ingested", "PSA-PSGC as-of-2017-12-31 (mirror jgngo/psgc-data)", list(source_ids), sample)),
    }


GEOGRAPHY_COLUMNS = ["id", "name", "level", "parent_id", "psgc_code", "centroid_lat", "centroid_lon", "provenance"]


def _aliases(name: str, geoid: str, level: str) -> list[str]:
    """Generate lowercased search aliases for a geography name."""
    n = name.lower().strip()
    aliases = [n]
    # Strip common prefixes/suffixes that people drop in free text.
    for strip in ("city of ", "municipality of ", " municipality", " city", " (pob.)", " (pob)", " city of the "):
        cand = n.replace(strip, " ").strip()
        cand = " ".join(cand.split())
        if cand and cand != n:
            aliases.append(cand)
    # "X (Pob.)" -> "x"
    if "(" in n:
        cand = n.split("(")[0].strip()
        if cand:
            aliases.append(cand)
    # Drop duplicates, keep order.
    seen, out = set(), []
    for a in aliases:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out


EXPLICIT_ALIASES = {
    "quezon city": "psgc:137404000",
    "qc": "psgc:137404000",
    "national capital region": "psgc:130000000",
    "ncr": "psgc:130000000",
    "metro manila": "psgc:130000000",
    "manila": "psgc:133900000",
    "makati": "psgc:137602000",
    "pasig": "psgc:137403000",
    "caloocan": "psgc:137501000",
    "taguig": "psgc:137607000",
}


def build_geography(raw_dir: Path = None, out_dir: Path = OUT_DIR, enrich_capitals: bool = False) -> tuple[Path, Path]:
    raw_dir = Path(raw_dir) if raw_dir else Path("data/raw/psgc")
    tables = load_tables(raw_dir)
    reg, pro, mun, bgy = tables.region, tables.province, tables.muncity, tables.barangay

    region_id_to_code = dict(zip(reg["region_id"].astype(str), reg["code"].astype(str)))
    province_id_to_code = dict(zip(pro["province_id"].astype(str), pro["code"].astype(str)))
    muncity_id_to_code = dict(zip(mun["muncity_id"].astype(str), mun["code"].astype(str)))

    rows: list[dict] = [_entity(NATIONAL_ROOT_ID, "Philippines", "national", None, None, ("sigma",), sample=False)]
    gaz: list[dict] = []

    def add(name: str, code: str, level_key: str, parent_id: str, psgc: str | None, sample: bool = False):
        geoid = f"psgc:{code}"
        rows.append(_entity(geoid, name, LEVELS[level_key], parent_id, psgc, ("psa-psgc",), sample))
        for alias in _aliases(name, geoid, LEVELS[level_key]):
            gaz.append({"alias": alias, "geography_id": geoid, "psgc_code": psgc or "", "level": LEVELS[level_key]})
        return geoid

    # Regions -> parent = national
    region_ids: dict[str, str] = {}
    for _, r in reg.iterrows():
        rid = add(r["description"], r["code"], "region", NATIONAL_ROOT_ID, r["code"])
        region_ids[str(r["region_id"])] = rid

    # NCR region id (the only region whose code starts with "13"); NCR has no
    # provinces, so its HUCs attach straight to this region.
    ncr_region = reg[reg["code"].astype(str).str.startswith("13")]
    ncr_geoid = (
        region_ids.get(str(ncr_region.iloc[0]["region_id"]))
        if len(ncr_region) else NATIONAL_ROOT_ID
    )

    # jgngo mirrors independent cities / HUCs into province.csv as well as into
    # muncity.csv. A province code can never equal a city/municipality code, so
    # any province.csv row whose code already exists in muncity.csv is a city
    # duplicate and is emitted only as municipal below. This removes all 36
    # city-as-province duplicates (incl. the 16 NCR HUCs) and leaves the 81
    # genuine provinces.
    muncity_codes = set(mun["code"].astype(str))

    # Provinces -> parent = region (skip city/HUC duplicates).
    province_ids: dict[str, str] = {}
    for _, r in pro.iterrows():
        code = str(r["code"])
        if code in muncity_codes:
            continue
        rid = region_ids.get(str(r["region_id"]), NATIONAL_ROOT_ID)
        pid = add(r["description"], code, "province", rid, code)
        province_ids[str(r["province_id"])] = pid

    # Cities / municipalities (incl. NCR HUCs) -> parent = province, else NCR region.
    muncity_ids: dict[str, str] = {}
    for _, r in mun.iterrows():
        code = str(r["code"])
        if code.startswith("13"):
            parent = ncr_geoid  # NCR HUC: code prefix 13 == NCR region
        else:
            parent = province_ids.get(str(r["province_id"]), NATIONAL_ROOT_ID)
        mid = add(r["description"], code, "muncity", parent, code)
        muncity_ids[str(r["muncity_id"])] = mid

    # Barangays -> parent = city/municipality
    for _, r in bgy.iterrows():
        mid = muncity_ids.get(str(r["muncity_id"]), NATIONAL_ROOT_ID)
        add(r["description"], r["code"], "barangay", mid, r["code"])

    # Curated short-form aliases (e.g. "QC" -> Quezon City).
    for alias, geoid in EXPLICIT_ALIASES.items():
        gaz.append({"alias": alias, "geography_id": geoid, "psgc_code": geoid.split(":", 1)[1], "level": _level_of(geoid, rows)})

    geog_df = pd.DataFrame(rows, columns=GEOGRAPHY_COLUMNS)
    gaz_df = pd.DataFrame(gaz).drop_duplicates(subset=["alias", "geography_id"]).sort_values(["level", "geography_id", "alias"])

    if enrich_capitals:
        _enrich_capital_centroids(geog_df, gaz_df)

    out_dir.mkdir(parents=True, exist_ok=True)
    geog_path = out_dir / "geography.csv"
    gaz_path = out_dir / "gazetteer.csv"
    geog_df.to_csv(geog_path, index=False, quoting=1)
    gaz_df.to_csv(gaz_path, index=False, quoting=1)
    return geog_path, gaz_path


def _level_of(geoid: str, rows: list[dict]) -> str:
    for r in rows:
        if r["id"] == geoid:
            return r["level"]
    return "barangay"


def _enrich_capital_centroids(geog_df: pd.DataFrame, gaz_df: pd.DataFrame) -> None:
    """Optional: fetch centroids for regions+provinces via Open-Meteo. Mutates in place."""
    from geography.ingest import geocode
    candidates = geog_df[geog_df["level"].isin(["regional", "provincial"])]["name"].tolist()
    for name in candidates:
        res = geocode(name)
        if not res:
            continue
        mask = geog_df["name"] == name
        geog_df.loc[mask, "centroid_lat"] = res["latitude"]
        geog_df.loc[mask, "centroid_lon"] = res["longitude"]
        time.sleep(1.1)


if __name__ == "__main__":
    geog, gaz = build_geography()
    print(f"wrote {geog} and {gaz}")
    g = pd.read_csv(geog)
    print(g["level"].value_counts().to_string())
    print("Quezon City row:")
    print(g[g["name"].str.contains("Quezon City", case=False, na=False)].to_string(index=False))
