"""PSGC + place-name ingestion for the SIGMA geography track.

Loads the four PSA-derived PSGC CSVs (region / province / city-municipality /
barangay) and provides a small Open-Meteo Geocoding client for on-demand
centroid enrichment. Only depends on pandas + the standard library so it runs
in the scaffold venv (no geopandas/pyarrow/requests).
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

RAW_DIR = Path("data/raw/psgc")

JGNGO_BASE = "https://raw.githubusercontent.com/jgngo/psgc-data/master/csv"

JGNGO_FILES = {
    "region": "region.csv",
    "province": "province.csv",
    "muncity": "muncity.csv",
    "barangay": "barangay.csv",
}

# 9-digit codes are emitted by the PSA-derived mirror; the canonical PSA
# publication carries 10-digit codes. We keep the source value verbatim and
# never parse it as a number (leading zeros are significant).
NATIONAL_ROOT_ID = "ph"


@dataclass
class PsgcTables:
    region: pd.DataFrame
    province: pd.DataFrame
    muncity: pd.DataFrame
    barangay: pd.DataFrame


def fetch_psgc_csv(dest: Path = RAW_DIR) -> dict[str, Path]:
    """Download the four PSGC CSVs into data/raw/psgc if absent."""
    dest.mkdir(parents=True, exist_ok=True)
    out: dict[str, Path] = {}
    for key, fname in JGNGO_FILES.items():
        path = dest / fname
        if not path.exists() or path.stat().st_size < 100:
            url = f"{JGNGO_BASE}/{fname}"
            req = urllib.request.Request(url, headers={"User-Agent": "sigma-geography/0.1"})
            with urllib.request.urlopen(req, timeout=45) as r, open(path, "wb") as f:
                f.write(r.read())
        out[key] = path
    return out


def _read(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="latin-1", dtype=str)
    df = df.dropna(how="all")
    for c in df.columns:
        df[c] = df[c].astype(str).str.strip()
    return df


def load_tables(raw_dir: Path = RAW_DIR) -> PsgcTables:
    if not (raw_dir / "barangay.csv").exists():
        fetch_psgc_csv(raw_dir)
    return PsgcTables(
        region=_read(raw_dir / "region.csv"),
        province=_read(raw_dir / "province.csv"),
        muncity=_read(raw_dir / "muncity.csv"),
        barangay=_read(raw_dir / "barangay.csv"),
    )


GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


def geocode(name: str, country: str = "PH", lang: str = "en") -> dict | None:
    """Resolve a place name to WGS84 coords + admin levels (Open-Meteo GeoNames).

    Returns None if no match. No API key. ~1 call per second is polite.
    """
    q = f"{name}, {country}"
    url = GEOCODE_URL + "?" + urllib.parse.urlencode({"name": q, "count": "1", "language": lang, "format": "json"})
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    results = data.get("results") or []
    if not results:
        return None
    res = results[0]
    return {
        "name": res.get("name"),
        "latitude": res.get("latitude"),
        "longitude": res.get("longitude"),
        "country": res.get("country"),
        "admin1": res.get("admin1"),
        "admin2": res.get("admin2"),
        "admin3": res.get("admin3"),
        "feature_code": res.get("feature_code"),
    }
