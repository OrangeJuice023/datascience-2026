"""Regression tests for ml/qa/local_sums.py.

Run: python -m unittest discover -s ml/tests
"""
import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qa"))
from local_sums import complete_local_sum, excluded_weeks, national_vs_local, valid_values  # noqa: E402

W1, W2, W3 = pd.Timestamp("2016-09-04"), pd.Timestamp("2016-09-11"), pd.Timestamp("2016-09-18")


def frame(rows):
    return pd.DataFrame(rows, columns=["geography_name", "period_start", "value", "data_quality"])


class CompleteLocalSum(unittest.TestCase):
    def setUp(self):
        self.loc = frame([
            ("A", W1, 10, "ok"), ("B", W1, 20, "ok"),
            # Swap week: B's value is a death count of 0, not a zero-case week.
            ("A", W2, 12, "ok"), ("B", W2, 0, "suspect swap"),
            ("A", W3, 11, "ok"), ("B", W3, None, "missing"),
        ])

    def test_complete_week_is_summed(self):
        self.assertEqual(complete_local_sum(self.loc)[W1], 30)

    def test_swap_row_week_has_no_total_instead_of_a_dip(self):
        total = complete_local_sum(self.loc)
        self.assertTrue(pd.isna(total[W2]), "a week with a swap row must not be summed as 12")

    def test_missing_week_has_no_total(self):
        self.assertTrue(pd.isna(complete_local_sum(self.loc)[W3]))

    def test_swap_zero_is_not_a_zero_observation(self):
        valid = valid_values(self.loc)
        self.assertTrue(pd.isna(valid[3]))
        self.assertEqual(int((valid == 0).sum()), 0)

    def test_excluded_rows_are_reported_not_deleted(self):
        ex = excluded_weeks(self.loc)
        self.assertEqual(int(ex.loc[W2, "suspect swap"]), 1)
        self.assertEqual(int(ex.loc[W3, "missing"]), 1)
        self.assertEqual(len(self.loc), 6)

    def test_national_comparison_uses_complete_weeks_only(self):
        nat = pd.Series({W1: 27.0, W2: 30.0, W3: 29.0})
        stats = national_vs_local(nat, complete_local_sum(self.loc))
        self.assertEqual(stats["weeks"], 1)
        self.assertAlmostEqual(stats["ratio"], 0.9)


if __name__ == "__main__":
    unittest.main()
