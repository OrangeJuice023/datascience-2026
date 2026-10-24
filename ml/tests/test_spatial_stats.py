"""Tests for ml/spatial (statistics, weights, episodes). No data files needed.

Run: python -m unittest discover -s ml/tests
"""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from spatial import stats, weights  # noqa: E402
from spatial.panel import alarm_episodes, threshold_episodes  # noqa: E402


def grid(side: int) -> np.ndarray:
    """Rook contiguity on a side x side grid."""
    n = side * side
    w = np.zeros((n, n))
    for r in range(side):
        for c in range(side):
            i = r * side + c
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= r + dr < side and 0 <= c + dc < side:
                    w[i, (r + dr) * side + c + dc] = 1
    return w


class FDR(unittest.TestCase):
    def test_bh_matches_hand_calculation(self):
        q = stats.bh_fdr(np.array([0.01, 0.04, 0.03, 0.005, np.nan]))
        np.testing.assert_allclose(q[:4], [0.02, 0.04, 0.04, 0.02])
        self.assertTrue(np.isnan(q[4]))


class Moran(unittest.TestCase):
    def setUp(self):
        self.rng = np.random.default_rng(1)
        self.w = grid(8)

    def test_value_matches_formula(self):
        x = self.rng.normal(size=64)
        z = x - x.mean()
        wr = self.w / self.w.sum(1, keepdims=True)
        expected = (64 / wr.sum()) * (z @ wr @ z) / (z @ z)
        i, _ = stats.moran_global(x, self.w, 99, self.rng)
        self.assertAlmostEqual(i, expected)

    def test_clustered_pattern_is_significant(self):
        x = np.repeat([0.0, 5.0], 32) + self.rng.normal(scale=0.1, size=64)  # top half vs bottom half
        i, p = stats.moran_global(x, self.w, 999, self.rng)
        self.assertGreater(i, 0.8)
        self.assertLess(p, 0.01)

    def test_checkerboard_is_not_clustered(self):
        x = np.array([(r + c) % 2 for r in range(8) for c in range(8)], dtype=float)
        i, p = stats.moran_global(x, self.w, 999, self.rng)
        self.assertLess(i, -0.9)
        self.assertGreater(p, 0.9)


class Local(unittest.TestCase):
    def setUp(self):
        self.rng = np.random.default_rng(2)
        self.w = grid(10)
        self.x = self.rng.normal(size=100)
        self.block = [r * 10 + c for r in range(3) for c in range(3)]
        self.x[self.block] += 6

    def test_mean_local_moran_is_global_moran(self):
        r = stats.local_stats(self.x, self.w, 99, self.rng)
        i, _ = stats.moran_global(self.x, self.w, 99, self.rng)
        self.assertAlmostEqual(np.nanmean(r["lisa"]), i)

    def test_gi_star_matches_formula(self):
        r = stats.local_stats(self.x, self.w, 99, self.rng)
        i = 55
        nb = np.flatnonzero(self.w[i])
        wi = len(nb) + 1
        s = np.sqrt((self.x ** 2).mean() - self.x.mean() ** 2)
        expected = ((self.x[i] + self.x[nb].sum()) - self.x.mean() * wi) / (s * np.sqrt((100 * wi - wi ** 2) / 99))
        self.assertAlmostEqual(r["gi"][i], expected)

    def test_planted_block_is_found(self):
        r = stats.local_stats(self.x, self.w, 999, self.rng)
        q = stats.bh_fdr(r["p_gi"])
        self.assertTrue((q[[11]] <= 0.05).all())  # centre of the block
        self.assertLessEqual(int((q <= 0.05).sum()) - len(self.block), 3)
        self.assertGreater(r["lisa"][11], 0)

    def test_unit_without_neighbours_is_nan(self):
        w = self.w.copy()
        w[99, :] = 0
        w[:, 99] = 0
        r = stats.local_stats(self.x, w, 99, self.rng)
        self.assertTrue(np.isnan(r["lisa"][99]) and np.isnan(r["p_lisa"][99]) and np.isnan(r["gi"][99]))


class Knox(unittest.TestCase):
    def test_counts_close_pairs_in_different_units(self):
        close = np.array([[0, 1, 0], [1, 0, 0], [0, 0, 0]], bool)
        units = np.array([0, 1, 1, 2, 0])
        times = np.array([10, 11, 30, 10, 12])
        r = stats.knox(units, times, close, 2, 9, np.random.default_rng(0))
        # pairs (0,1): |10-11|=1 yes; (1,4): |11-12| yes; (0,2),(2,4): far; same-unit and unit-2 pairs excluded
        self.assertEqual(r["observed"], 2)

    def test_planted_space_time_interaction(self):
        rng = np.random.default_rng(3)
        close = grid(6).astype(bool)
        units = np.concatenate([np.arange(36), np.array([0, 1, 6, 7, 2, 8])])
        times = np.concatenate([rng.integers(0, 200, 36), np.array([50, 50, 51, 51, 52, 50])])
        r = stats.knox(units, times, close, 2, 999, rng)
        self.assertGreater(r["ratio"], 2)
        self.assertLess(r["p"], 0.01)


class Weights(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(4)
        self.dist = weights.haversine_km(rng.uniform(5, 20, 40), rng.uniform(117, 127, 40))

    def test_knn_has_k_neighbours_and_no_self(self):
        w = weights.knn(self.dist, 5)
        self.assertTrue((w.sum(1) == 5).all())
        self.assertEqual(np.trace(w), 0)

    def test_distance_band_leaves_no_unit_isolated(self):
        w, band = weights.distance_band(self.dist)
        self.assertTrue((w.sum(1) > 0).all())
        self.assertEqual(np.trace(w), 0)
        self.assertTrue((w == w.T).all())

    def test_haversine_manila_to_cebu(self):
        d = weights.haversine_km(np.array([14.5995, 10.3157]), np.array([120.9842, 123.8854]))
        self.assertAlmostEqual(d[0, 1], 571, delta=5)


class Episodes(unittest.TestCase):
    def test_one_week_gap_is_merged(self):
        a = np.array([[0, 1, 1, 0, 1, 0, 0, 1, 0]], bool)
        self.assertEqual(alarm_episodes(a, max_gap=1), [(0, 1, 4), (0, 7, 7)])

    def test_threshold_runs_need_two_weeks(self):
        s = pd.DataFrame({"doh_status": ["normal", "epidemic", "normal", "alert", "epidemic", "epidemic", "normal"]})
        self.assertEqual(threshold_episodes(s, {"epidemic"}), [(4, 5)])
        self.assertEqual(threshold_episodes(s, {"alert", "epidemic"}), [(3, 5)])


if __name__ == "__main__":
    unittest.main()
