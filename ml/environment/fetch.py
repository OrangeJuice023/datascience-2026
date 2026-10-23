"""Download raw HDX resources into data/raw/<source>/ with a manifest per source.

Raw files are never modified. The manifest records the resolved URL, the
upstream last_modified, retrieval time, byte size and SHA-256 so every
downstream table can name exactly what it was built from.

    python -m environment.fetch                  # skip files already present
    python -m environment.fetch --force          # re-download; refuses a changed file
    python -m environment.fetch --force --accept-changed
                                                 # replace a changed file, keeping its old hash
    python -m environment.fetch --record-pins    # pin present files in input_pins.json (commit it)

A re-download whose SHA-256 differs from the manifest or the committed pin is
refused and the old file is kept. With --accept-changed it replaces the old
file, and the old hash stays in the manifest entry's `previous` list and in
the pin history (paths.record_pin), so the change is never silent.
"""

import argparse
import json
import urllib.request
from datetime import datetime, timezone

from .paths import REPO, accept_download, manifest_path, raw_dir, record_pin, sha256
from .sources import HDX_API, HDX_DATASETS


def resolve_resources(dataset: str) -> dict:
    with urllib.request.urlopen(HDX_API.format(dataset=dataset), timeout=60) as r:
        pkg = json.load(r)["result"]
    return {res["name"]: res for res in pkg["resources"]}


def fetch(force: bool = False, accept_changed: bool = False, record_pins: bool = False) -> None:
    for key, spec in HDX_DATASETS.items():
        out_dir = raw_dir(key)
        out_dir.mkdir(parents=True, exist_ok=True)
        mpath = manifest_path(key)
        manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
        resources = resolve_resources(spec["dataset"])

        for name in spec["resources"]:
            res = resources[name]
            path = out_dir / name
            previous = list(manifest.get(name, {}).get("previous", []))
            if force or not path.exists():
                print(f"downloading {key}/{name}")
                tmp = path.with_name(path.name + ".download")
                urllib.request.urlretrieve(res["url"], tmp)
                try:
                    accept_download(key, name, sha256(tmp), manifest, accept_changed)
                except SystemExit:
                    tmp.unlink()
                    raise
                old = manifest.get(name)
                if old and old["sha256"] != sha256(tmp):
                    previous.append({k: old.get(k) for k in ("sha256", "retrieved_at", "upstream_last_modified")})
                tmp.replace(path)
                retrieved = datetime.now(timezone.utc).isoformat(timespec="seconds")
                record_pin(key, name, sha256(path), reason="re-downloaded with --accept-changed")
            else:
                entry = manifest.get(name)
                if entry and entry["sha256"] != sha256(path):
                    raise SystemExit(f"{key}/{name} changed since it was fetched; "
                                     "use --force to re-download")
                retrieved = entry["retrieved_at"] if entry else None
            manifest[name] = {
                "dataset": spec["dataset"],
                "url": res["url"],
                "upstream_last_modified": res.get("last_modified"),
                "retrieved_at": retrieved,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "license": spec["license"],
                "attribution": spec["attribution"],
                "previous": previous,
            }
            if record_pins:
                record_pin(key, name, manifest[name]["sha256"], reason="recorded with --record-pins")
        mpath.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"wrote {mpath.relative_to(REPO)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--accept-changed", action="store_true")
    parser.add_argument("--record-pins", action="store_true")
    args = parser.parse_args()
    fetch(args.force, args.accept_changed, args.record_pins)
