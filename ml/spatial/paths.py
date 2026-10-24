"""Paths and input checks for the spatial analysis."""

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data" / "processed"
COMBINED = PROCESSED / "dengue_cases_combined.xlsx"
EARS = PROCESSED / "dengue_ears.xlsx"
CROSSWALK = REPO / "data" / "reference" / "geo" / "hdx_dengue_crosswalk.csv"
UNITS_GEOJSON = REPO / "web" / "public" / "geo" / "hdx-reporting-units.geojson"
GEO_SOURCES = REPO / "scripts" / "geo" / "sources.json"
OUT = PROCESSED / "spatial"
REPORT = REPO / "docs" / "geo" / "spatial-analysis-report.md"
FIGURES = REPO / "docs" / "geo" / "figures"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def hdx_raw() -> Path:
    """The raw HDX file, checked against the hash pinned by the geography track."""
    src = next(s for s in json.loads(GEO_SOURCES.read_text(encoding="utf-8"))["sources"]
               if s["id"] == "hdx-doh-epi-dengue")
    path = REPO / "data" / "raw" / src["dir"] / src["file"]
    if not path.exists():
        raise SystemExit(f"{path.relative_to(REPO)} missing; run node scripts/geo/fetch-sources.mjs")
    if sha256(path) != src["sha256"]:
        raise SystemExit(f"{path.relative_to(REPO)} does not match the hash in "
                         f"{GEO_SOURCES.relative_to(REPO)}: the upstream file changed; report it")
    return path


def require(*paths: Path) -> None:
    for path in paths:
        if not path.exists():
            raise SystemExit(f"{path.relative_to(REPO)} missing; run ml/clean_dengue.py and ml/ears.py first")
