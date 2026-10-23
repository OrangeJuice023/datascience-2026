"""Shared paths and manifest checks for the environment pipeline.

Layout (one manifest per source, written by environment.fetch):

    data/raw/<source>/<resource files>
    data/raw/<source>/manifest.json
    data/processed/environment/

`<source>` is a key of sources.HDX_DATASETS.

The manifests are git-ignored with the raw files. The identity of every input
(its SHA-256) is also pinned in ml/environment/input_pins.json, which IS
committed, so a fresh clone can tell whether its downloads are the files the
committed outputs were built from. A changed input is refused until it is
accepted explicitly (`fetch --accept-changed`), and the replaced hash is kept
in the pin's `previous` list rather than overwritten.
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RAW_ROOT = REPO / "data" / "raw"
OUT = REPO / "data" / "processed" / "environment"
PINS = Path(__file__).resolve().parent / "input_pins.json"


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
        digest = sha256(raw_dir(source) / name)
        if digest != entry["sha256"]:
            raise SystemExit(f"{source}/{name} does not match its manifest sha256; "
                             "run `python -m environment.fetch --force`")
        status = pin_status(source, name, digest)
        if status == "changed":
            raise SystemExit(f"{source}/{name} differs from its committed pin in "
                             f"{PINS.relative_to(REPO)}; the outputs were built from another file. "
                             "Re-fetch, or accept it with `--accept-changed` and commit the pin.")
        if status == "unpinned":
            print(f"warning: {source}/{name} has no committed pin; run `python -m environment.fetch --record-pins`")
        inputs[f"{source}/{name}"] = {
            k: entry.get(k) for k in ("sha256", "retrieved_at", "upstream_last_modified", "url")
        } | {"pinned": status == "match"}
    return inputs


def load_pins() -> dict:
    return json.loads(PINS.read_text()) if PINS.exists() else {}


def save_pins(pins: dict) -> None:
    PINS.write_text(json.dumps(dict(sorted(pins.items())), indent=2) + "\n")


def pin_status(source: str, name: str, digest: str) -> str:
    """"match", "changed" (differs from the committed pin) or "unpinned"."""
    pin = load_pins().get(f"{source}/{name}")
    if pin is None:
        return "unpinned"
    return "match" if pin["sha256"] == digest else "changed"


def record_pin(source: str, name: str, digest: str, reason: str) -> None:
    """Pin a file's hash. A different existing pin is moved to `previous`, never dropped."""
    pins = load_pins()
    key = f"{source}/{name}"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    old = pins.get(key)
    if old and old["sha256"] == digest:
        return
    previous = list(old.get("previous", [])) if old else []
    if old:
        previous.append({"sha256": old["sha256"], "pinned_at": old.get("pinned_at"),
                         "replaced_at": now, "reason": reason})
    pins[key] = {"sha256": digest, "pinned_at": now, "previous": previous}
    save_pins(pins)


def accept_download(source: str, name: str, new_digest: str, manifest: dict, accept_changed: bool) -> None:
    """Refuse a download whose hash differs from the manifest or the pin, unless accepted.

    On acceptance the manifest entry being replaced is kept under the new
    entry's `previous` (the caller writes it), and the pin keeps its history.
    """
    old = manifest.get(name)
    changed_manifest = bool(old) and old["sha256"] != new_digest
    changed_pin = pin_status(source, name, new_digest) == "changed"
    if (changed_manifest or changed_pin) and not accept_changed:
        raise SystemExit(f"{source}/{name}: the upstream file changed (new sha256 {new_digest[:12]}…). "
                         "The old file was kept. Re-run with --accept-changed to replace it; "
                         "the old hash is kept in the manifest and pin history.")
