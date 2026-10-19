"""Download raw HDX resources into data/raw/<source>/ with a manifest per source.

Raw files are never modified. The manifest records the resolved URL, the
upstream last_modified, retrieval time, byte size and SHA-256 so every
downstream table can name exactly what it was built from.

    python -m environment.fetch            # skip files already present
    python -m environment.fetch --force    # re-download everything
"""

import argparse
import json
import urllib.request
from datetime import datetime, timezone

from .paths import REPO, manifest_path, raw_dir, sha256
from .sources import HDX_API, HDX_DATASETS


def resolve_resources(dataset: str) -> dict:
    with urllib.request.urlopen(HDX_API.format(dataset=dataset), timeout=60) as r:
        pkg = json.load(r)["result"]
    return {res["name"]: res for res in pkg["resources"]}


def fetch(force: bool = False) -> None:
    for key, spec in HDX_DATASETS.items():
        out_dir = raw_dir(key)
        out_dir.mkdir(parents=True, exist_ok=True)
        mpath = manifest_path(key)
        manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
        resources = resolve_resources(spec["dataset"])

        for name in spec["resources"]:
            res = resources[name]
            path = out_dir / name
            if force or not path.exists():
                print(f"downloading {key}/{name}")
                urllib.request.urlretrieve(res["url"], path)
                retrieved = datetime.now(timezone.utc).isoformat(timespec="seconds")
            else:
                retrieved = manifest.get(name, {}).get("retrieved_at")
            manifest[name] = {
                "dataset": spec["dataset"],
                "url": res["url"],
                "upstream_last_modified": res.get("last_modified"),
                "retrieved_at": retrieved,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "license": spec["license"],
                "attribution": spec["attribution"],
            }
        mpath.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"wrote {mpath.relative_to(REPO)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    fetch(parser.parse_args().force)
