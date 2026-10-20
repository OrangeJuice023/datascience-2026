"""SIGMA location resolver: free text -> canonical geography id + PSGC code.

Implements the resolution algorithm in SIGMA_SIGNAL_SPEC.md §5:
canonicalize -> exact alias lookup -> level-prioritized de-dup -> fuzzy fallback
-> Open-Meteo Geocoding point fallback. The gazetteer is the artifact produced
by geography.build.build_geography(); no network is needed for known places.
"""
from __future__ import annotations

import difflib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from geography.ingest import geocode

DEFAULT_GAZETTEER = Path("data/processed/geography/gazetteer.csv")
DEFAULT_GEOGRAPHY = Path("data/processed/geography/geography.csv")

LEVEL_PRIORITY = {"barangay": 0, "municipal": 1, "provincial": 2, "regional": 3, "national": 4}

# Short-form expansions applied before alias lookup (complements the curated
# aliases written into the gazetteer by build.py).
ABBREVIATIONS = {
    "qc": "quezon city",
    "ncr": "national capital region",
    "mm": "metro manila",
    "ri": "rizal",
}


@dataclass
class ResolvedLocation:
    geography_id: str
    psgc_code: str | None
    geographic_level: str
    name: str | None
    confidence: str  # "high" | "medium" | "low"
    method: str      # "alias_exact" | "alias_normalized" | "fuzzy" | "geocoded" | "unresolved"


class LocationResolver:
    def __init__(self, gazetteer: Path = DEFAULT_GAZETTEER, geography: Path = DEFAULT_GEOGRAPHY):
        self.gaz = pd.read_csv(gazetteer, dtype=str).fillna("")
        self.geo = pd.read_csv(geography, dtype=str).fillna("")
        self.by_alias: dict[str, list[dict]] = {}
        for _, row in self.gaz.iterrows():
            self.by_alias.setdefault(row["alias"].lower(), []).append({
                "geography_id": row["geography_id"],
                "psgc_code": row["psgc_code"] or None,
                "level": row["level"],
            })

    @staticmethod
    def _canonicalize(text: str) -> str:
        n = text.lower().strip()
        # Drop qualifiers like ", Metro Manila" / "Metro Manila,".
        n = re.sub(r"\s*,\s*metro manila\s*$", "", n)
        n = re.sub(r"^metro manila\s*,\s*", "", n)
        # Expand abbreviation tokens.
        tokens = n.split()
        tokens = [ABBREVIATIONS.get(t, t) for t in tokens]
        n = " ".join(tokens)
        # Drop residual parenthetical qualifiers and punctuation noise.
        n = re.sub(r"\s*\(.*?\)\s*", " ", n)
        n = re.sub(r"[,\-_/]+", " ", n)
        return " ".join(n.split())

    def resolve(self, text: str) -> ResolvedLocation:
        if not text or not text.strip():
            return self._unresolved()
        canonical = self._canonicalize(text)
        for candidate in {text.lower(): None, canonical: None, text.lower().strip(): None}.keys():
            matches = self.by_alias.get(candidate, [])
            if matches:
                best = self._pick(matches)
                return ResolvedLocation(
                    geography_id=best["geography_id"],
                    psgc_code=best["psgc_code"],
                    geographic_level=best["level"],
                    name=self._name(best["geography_id"]),
                    confidence="high",
                    method="alias_exact",
                )
        # Fuzzy fallback over every alias.
        best_alias, score = _best_fuzzy(canonical, list(self.by_alias.keys()))
        if score >= 0.86 and best_alias:
            chosen = self._pick(self.by_alias[best_alias])
            return ResolvedLocation(
                geography_id=chosen["geography_id"],
                psgc_code=chosen["psgc_code"],
                geographic_level=chosen["level"],
                name=self._name(chosen["geography_id"]),
                confidence="medium",
                method="fuzzy",
            )
        # Point fallback: Open-Meteo Geocoding (no key, ~1 req/s).
        res = geocode(text)
        if res:
            return ResolvedLocation(
                geography_id="", psgc_code=None, geographic_level=None,
                name=res.get("name"), confidence="low", method="geocoded",
            )
        return self._unresolved()

    def _pick(self, matches: list[dict]) -> dict:
        # A short place name ("Manila", "Pasig") usually means the city, not a
        # barangay that happens to share the name. Prefer a non-barangay match;
        # among those, prefer the coarsest administrative level.
        non_bgy = [m for m in matches if m["level"] != "barangay"]
        pool = non_bgy or matches
        return max(pool, key=lambda m: LEVEL_PRIORITY.get(m["level"], -1))

    def _name(self, geoid: str) -> str | None:
        sub = self.geo[self.geo["id"] == geoid]
        return None if sub.empty else sub.iloc[0]["name"]

    def _unresolved(self) -> ResolvedLocation:
        return ResolvedLocation("", None, None, None, "low", "unresolved")


def _best_fuzzy(query: str, aliases: list[str]) -> tuple[str | None, float]:
    if not aliases:
        return None, 0.0
    scored = [(a, difflib.SequenceMatcher(None, query, a).ratio()) for a in aliases]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[0]


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    r = LocationResolver()
    for q in ["Quezon City", "QC", "Quezon City, Metro Manila", "Manila", "pasig"]:
        res = r.resolve(q)
        print(f"{q!r:32} -> id={res.geography_id} psgc={res.psgc_code} level={res.geographic_level} method={res.method}")
