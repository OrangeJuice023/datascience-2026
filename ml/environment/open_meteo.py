"""Fetch daily ERA5 weather from the Open-Meteo archive for each geography.

    python -m environment.open_meteo           # fetch missing year-chunks only
    python -m environment.open_meteo --force   # re-fetch everything

One request per geography x calendar year, cached as raw JSON in
data/raw/open_meteo/<geography_id>_<year>.json with a manifest entry
(request, resolved grid cell, retrieval time, SHA-256), like environment.fetch.
The query point is the geography's `latitude`/`longitude` from
data/processed/environment/geography.csv, so run environment.geography first.
Model, timezone and date range are pinned in sources.OPEN_METEO.

The free API tier is rate-limited (weighted by days x locations); on HTTP 429
the fetch waits and retries, so a full first run takes a while.
"""

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import pandas as pd

from . import geography
from .paths import REPO, manifest_path, raw_dir, sha256
from .sources import OPEN_METEO

SOURCE = "open_meteo"
RETRY_WAIT_S = 60
MAX_RETRIES = 90


def chunks() -> list[tuple[int, str, str]]:
    start, end = pd.Timestamp(OPEN_METEO["start"]), pd.Timestamp(OPEN_METEO["end"])
    return [(y, str(max(start, pd.Timestamp(y, 1, 1)).date()), str(min(end, pd.Timestamp(y, 12, 31)).date()))
            for y in range(start.year, end.year + 1)]


def request_params(lat: float, lon: float, start: str, end: str) -> dict:
    return {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "start_date": start,
        "end_date": end,
        "daily": ",".join(OPEN_METEO["variables"]),
        "models": OPEN_METEO["model"],
        "elevation": "nan",
        "timezone": OPEN_METEO["timezone"],
    }


def get(params: dict) -> bytes:
    url = OPEN_METEO["url"] + "?" + urllib.parse.urlencode(params)
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise SystemExit(f"Open-Meteo HTTP {e.code}: {e.read()[:300]!r}")
            print(f"  rate limited, waiting {RETRY_WAIT_S}s (attempt {attempt + 1})", flush=True)
            time.sleep(RETRY_WAIT_S)
    raise SystemExit("Open-Meteo still rate limiting; re-run later (cached chunks are kept)")


def fetch(force: bool = False) -> None:
    geo = geography.load()
    out_dir = raw_dir(SOURCE)
    out_dir.mkdir(parents=True, exist_ok=True)
    mpath = manifest_path(SOURCE)
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {}

    for g in geo.itertuples():
        for year, start, end in chunks():
            name = f"{g.geography_id}_{year}.json"
            params = request_params(g.latitude, g.longitude, start, end)
            entry = manifest.get(name)
            path = out_dir / name
            if not force and path.exists() and entry and entry["request"] == params:
                continue
            print(f"fetching {name}", flush=True)
            body = get(params)
            payload = json.loads(body)
            if payload.get("error"):
                raise SystemExit(f"{name}: {payload.get('reason')}")
            path.write_bytes(body)
            manifest[name] = {
                "geography_id": g.geography_id,
                "url": OPEN_METEO["url"],
                "request": params,
                "grid_latitude": payload["latitude"],
                "grid_longitude": payload["longitude"],
                "grid_elevation_m": payload["elevation"],
                "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "license": OPEN_METEO["license"],
                "attribution": OPEN_METEO["attribution"],
            }
            mpath.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
            time.sleep(1)
    print(f"{mpath.relative_to(REPO)}: {len(manifest)} chunks")


def expected_files(geo: pd.DataFrame) -> list[str]:
    return [f"{gid}_{y}.json" for gid in geo["geography_id"] for y, _, _ in chunks()]


def load_daily(geo: pd.DataFrame) -> pd.DataFrame:
    """Daily values for every geography, canonical column names.

    Call paths.verified_inputs on expected_files() first; this also checks
    each cached request still matches the geography's current coordinates.
    """
    manifest = json.loads(manifest_path(SOURCE).read_text())
    rename = {k: v["canonical"] for k, v in OPEN_METEO["variables"].items()}
    frames = []
    for g in geo.itertuples():
        for year, start, end in chunks():
            name = f"{g.geography_id}_{year}.json"
            if manifest[name]["request"] != request_params(g.latitude, g.longitude, start, end):
                raise SystemExit(f"{name} was fetched for a different point or range; "
                                 "run `python -m environment.open_meteo`")
            daily = json.loads((raw_dir(SOURCE) / name).read_text())["daily"]
            frames.append(pd.DataFrame(daily).rename(columns=rename).assign(
                geography_id=g.geography_id,
                retrieved_at=manifest[name]["retrieved_at"],
                grid_cell=f"{manifest[name]['grid_latitude']},{manifest[name]['grid_longitude']}",
            ))
    df = pd.concat(frames, ignore_index=True)
    df["date"] = pd.to_datetime(df.pop("time"))
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    fetch(parser.parse_args().force)
