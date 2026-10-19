"""Shared paths and manifest checks for the environment pipeline.

Layout (one manifest per source, written by environment.fetch):

    data/raw/<source>/<resource files>
    data/raw/<source>/manifest.json
    data/processed/environment/

`<source>` is a key of sources.HDX_DATASETS.
"""

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RAW_ROOT = REPO / "data" / "raw"
OUT = REPO / "data" / "processed" / "environment"


def raw_dir(source: str) -> Path:
    return RAW_ROOT / source


def manifest_path(source: str) -> Path:
    return raw_dir(source) / "manifest.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verified_inputs(source: str, names: list[str]) -> dict:
    """Check that each raw file matches its manifest entry; return provenance.

    Fails before any output is written if fetch has not been run or a raw file
    changed after it was fetched.
    """
    path = manifest_path(source)
    if not path.exists():
        raise SystemExit(f"{path.relative_to(REPO)} missing; run `python -m environment.fetch` first")
    manifest = json.loads(path.read_text())
    inputs = {}
    for name in names:
        entry = manifest.get(name)
        if entry is None:
            raise SystemExit(f"{name} not in {path.relative_to(REPO)}; run `python -m environment.fetch`")
        if sha256(raw_dir(source) / name) != entry["sha256"]:
            raise SystemExit(f"{source}/{name} does not match its manifest sha256; "
                             "run `python -m environment.fetch --force`")
        inputs[f"{source}/{name}"] = {
            k: entry[k] for k in ("sha256", "retrieved_at", "upstream_last_modified", "url")
        }
    return inputs
