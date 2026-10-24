"""Spatial weights for the reporting units and the full-province (MAUP) level.

Method doc §4.2 step 3, all reproducible from committed files:
- W1 k-nearest neighbours (k = 5) on the crosswalk's representative points
  (primary). Not symmetric; it is used row-standardised.
- W2 distance band: neighbours within d km, d the smallest distance that
  leaves no unit isolated.
- W3 contiguity: units sharing a border edge in the committed reporting-unit
  polygons (scripts/geo/build-boundaries.mjs keeps shared arcs identical, so
  shared edges are exact). A city is always linked to the province remainder
  that encloses it; a unit with no land neighbour is linked to its nearest one.

Distances are great-circle (haversine) between representative points; they
approximate, not measure, how far apart irregular units are.
"""

import json

import numpy as np
import pandas as pd

from .paths import UNITS_GEOJSON

K = 5
EARTH_KM = 6371.0088


def haversine_km(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    la, lo = np.radians(lat), np.radians(lon)
    dla = la[:, None] - la[None, :]
    dlo = lo[:, None] - lo[None, :]
    h = np.sin(dla / 2) ** 2 + np.cos(la)[:, None] * np.cos(la)[None, :] * np.sin(dlo / 2) ** 2
    return 2 * EARTH_KM * np.arcsin(np.sqrt(h))


def knn(dist: np.ndarray, k: int = K) -> np.ndarray:
    d = dist.copy()
    np.fill_diagonal(d, np.inf)
    w = np.zeros_like(d)
    # Stable sort with the unit order as tie-break, so ties are deterministic.
    nearest = np.argsort(d, axis=1, kind="stable")[:, :k]
    np.put_along_axis(w, nearest, 1.0, axis=1)
    return w


def distance_band(dist: np.ndarray) -> tuple[np.ndarray, float]:
    d = dist.copy()
    np.fill_diagonal(d, np.inf)
    band = float(d.min(axis=1).max())
    w = (d <= band).astype(float)
    return w, band


def _link_isolated(w: np.ndarray, dist: np.ndarray) -> list[int]:
    d = dist.copy()
    np.fill_diagonal(d, np.inf)
    isolated = [i for i in range(len(w)) if w[i].sum() == 0]
    for i in isolated:
        j = int(np.argmin(d[i]))
        w[i, j] = w[j, i] = 1.0
    return isolated


def unit_contiguity(ids: list[str], dist: np.ndarray, enclosing: dict[str, str]) -> tuple[np.ndarray, dict]:
    """Shared-edge contiguity from the reporting-unit GeoJSON."""
    gj = json.loads(UNITS_GEOJSON.read_text(encoding="utf-8"))
    pos = {u: i for i, u in enumerate(ids)}
    owners: dict[tuple, set] = {}
    for f in gj["features"]:
        geom = f["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        for poly in polys:
            for ring in poly:
                for p, q in zip(ring[:-1], ring[1:]):
                    edge = (tuple(p), tuple(q)) if tuple(p) <= tuple(q) else (tuple(q), tuple(p))
                    owners.setdefault(edge, set()).add(f["properties"]["id"])
    w = np.zeros((len(ids), len(ids)))
    for units in owners.values():
        for a in units:
            for b in units:
                if a != b:
                    w[pos[a], pos[b]] = 1.0
    added_enclosing = 0
    for city, remainder in enclosing.items():
        i, j = pos[city], pos[remainder]
        added_enclosing += int(w[i, j] == 0)
        w[i, j] = w[j, i] = 1.0
    isolated = _link_isolated(w, dist)
    return w, dict(cities_linked_to_remainder=added_enclosing,
                   linked_to_nearest=[ids[i] for i in isolated])


def unit_weights(units: pd.DataFrame) -> dict:
    """W1-W3 for the 126 reporting units (rows of `units`, in order)."""
    ids = units["unit_id"].tolist()
    dist = haversine_km(units["rep_lat"].to_numpy(), units["rep_lon"].to_numpy())
    w2, band = distance_band(dist)
    remainders = units[units.unit_type == "province_remainder"].set_index("geographic_province_id")["unit_id"]
    cities = units[units.unit_type.str.startswith("city") & units.geographic_province_id.isin(remainders.index)]
    enclosing = dict(zip(cities.unit_id, cities.geographic_province_id.map(remainders)))
    w3, info = unit_contiguity(ids, dist, enclosing)
    return dict(ids=ids, dist=dist, W1=knn(dist), W2=w2, W3=w3,
                info=dict(band_km=round(band, 1), **info))


def province_weights(units: pd.DataFrame, w_unit: np.ndarray, groups: pd.Series) -> dict:
    """W1-W3 for the full-province level (`groups` maps unit row -> province key).

    A province's point is the area-weighted mean of its units' representative
    points; it can fall outside the province (e.g. a curved coastline) and is
    used only to rank distances. Two provinces are contiguous when any of their
    units are (W3 at unit level).
    """
    keys = sorted(groups.unique())
    pos = {g: i for i, g in enumerate(keys)}
    gi = groups.map(pos).to_numpy()
    a = units["area_sqkm"].to_numpy()
    lat = np.bincount(gi, a * units["rep_lat"].to_numpy()) / np.bincount(gi, a)
    lon = np.bincount(gi, a * units["rep_lon"].to_numpy()) / np.bincount(gi, a)
    dist = haversine_km(lat, lon)
    w2, band = distance_band(dist)
    w3 = np.zeros((len(keys), len(keys)))
    ui, uj = np.nonzero(w_unit)
    for i, j in zip(gi[ui], gi[uj]):
        if i != j:
            w3[i, j] = 1.0
    isolated = _link_isolated(w3, dist)
    return dict(ids=keys, dist=dist, W1=knn(dist), W2=w2, W3=w3,
                info=dict(band_km=round(band, 1), linked_to_nearest=[keys[i] for i in isolated]))


def symmetric(w: np.ndarray) -> np.ndarray:
    """Boolean neighbour relation in either direction (for the Knox test)."""
    return (w > 0) | (w.T > 0)
