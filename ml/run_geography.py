"""Run the SIGMA geography track end-to-end.

Usage (from repo root D:\\SIGMA):
    python ml/run_geography.py
    python ml/run_geography.py --geocode-capitals     # also enrich region/province centroids

Produces:
    data/processed/geography/geography.csv
    data/processed/geography/gazetteer.csv
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import argparse  # noqa: E402

from geography.build import build_geography  # noqa: E402
from geography.resolver import LocationResolver  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--geocode-capitals", action="store_true")
    args = ap.parse_args()

    geog_path, gaz_path = build_geography(enrich_capitals=args.geocode_capitals)

    resolver = LocationResolver(gaz_path, geog_path)
    _report(geog_path, gaz_path, resolver)

    examples = ["Quezon City", "QC", "Quezon City, Metro Manila", "Manila", "Makati", "Pasig"]
    print("\n=== Location resolution demo ===")
    for q in examples:
        r = resolver.resolve(q)
        print(f"{q!r:32} -> id={r.geography_id:18} psgc={r.psgc_code or '-':<10} "
              f"level={str(r.geographic_level):8} method={r.method}")
    return 0


def _report(geog_path, gaz_path, resolver):
    import pandas as pd
    g = pd.read_csv(geog_path, dtype=str).fillna("")
    print("=== SIGMA geography foundation ===")
    print(f"geography.csv : {geog_path} ({g.shape[0]} entities)")
    print(f"gazetteer.csv : {gaz_path} ({pd.read_csv(gaz_path, dtype=str).shape[0]} alias rows)")
    print("\nEntities by level:")
    print(g["level"].value_counts().to_string())
    print("\nQuezon City entity:")
    print(g[g["name"].str.contains("quezon city", case=False, na=False)].to_string(index=False))


if __name__ == "__main__":
    raise SystemExit(main())
