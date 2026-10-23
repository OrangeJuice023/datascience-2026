"""Regression tests for environment week alignment, HDX swap exclusion and input pins.

Run: python -m unittest discover -s ml/tests
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))

from environment import paths, weeks  # noqa: E402
from environment.crosscheck import prepare_hdx  # noqa: E402


class WeekConversion(unittest.TestCase):
    def test_cchain_monday_maps_to_the_sunday_before(self):
        out = weeks.from_source_label(pd.Series(["2019-07-29"]), "cchain_pidsr")
        self.assertEqual(out.iloc[0], pd.Timestamp("2019-07-28"))

    def test_hdx_offset_lands_on_a_sunday(self):
        out = weeks.from_source_label(pd.Series(["2019-07-28"]), "hdx_doh_epi")
        self.assertEqual(out.iloc[0].dayofweek, 6)
        self.assertEqual((pd.Timestamp("2019-07-28") - out.iloc[0]).days, -weeks.SOURCE_WEEK_OFFSET_DAYS["hdx_doh_epi"])

    def test_a_label_that_is_not_a_week_start_is_refused(self):
        with self.assertRaises(ValueError):
            weeks.from_source_label(pd.Series(["2019-07-30"]), "hdx_doh_epi")

    def test_period_start_and_mmwr_week(self):
        self.assertEqual(weeks.period_start(pd.Series(["2019-07-31"])).iloc[0], pd.Timestamp("2019-07-28"))
        ew = weeks.epi_week(pd.Series([pd.Timestamp("2019-12-29"), pd.Timestamp("2020-12-27")]))
        self.assertEqual(ew.epi_year.tolist(), [2020, 2020])
        self.assertEqual(ew.epi_week.tolist(), [1, 53])


class HdxSwapExclusion(unittest.TestCase):
    def test_swap_rows_become_no_data_not_zero(self):
        # 10 places, each with a row appended out of date order in the same week:
        # the swap-block rule (>= 10 places) marks them.
        rows = []
        for i in range(10):
            loc = f"PLACE {i}"
            rows += [(loc, 20, 0, "09/04/2016"), (loc, 25, 0, "09/18/2016"), (loc, 0, 22, "09/11/2016")]
        rows.append(("OTHER", 5, 0, "09/11/2016"))
        raw = pd.DataFrame(rows, columns=["loc", "cases", "deaths", "date"])
        hdx = prepare_hdx(raw)
        swapped = hdx[hdx["suspect_swap"]]
        self.assertEqual(len(swapped), 10)
        self.assertTrue(swapped["cases"].isna().all())
        self.assertEqual(hdx.loc[hdx["loc"] == "OTHER", "cases"].iloc[0], 5)
        self.assertEqual(len(hdx), len(raw), "rows are kept as evidence, not deleted")


class InputPins(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self._saved = (paths.PINS, paths.RAW_ROOT, paths.REPO)
        paths.PINS = root / "input_pins.json"
        paths.RAW_ROOT = root / "raw"
        paths.REPO = root
        (paths.RAW_ROOT / "src").mkdir(parents=True)
        self.file = paths.RAW_ROOT / "src" / "a.csv"
        self.file.write_text("x\n1\n")
        digest = paths.sha256(self.file)
        paths.manifest_path("src").write_text(json.dumps({"a.csv": {"sha256": digest}}))
        self.digest = digest

    def tearDown(self):
        paths.PINS, paths.RAW_ROOT, paths.REPO = self._saved
        self.tmp.cleanup()

    def test_unpinned_input_is_reported(self):
        inputs = paths.verified_inputs("src", ["a.csv"])
        self.assertFalse(inputs["src/a.csv"]["pinned"])

    def test_pinned_input_matches(self):
        paths.record_pin("src", "a.csv", self.digest, reason="test")
        self.assertTrue(paths.verified_inputs("src", ["a.csv"])["src/a.csv"]["pinned"])

    def test_changed_input_is_refused(self):
        paths.record_pin("src", "a.csv", "0" * 64, reason="test")
        with self.assertRaises(SystemExit):
            paths.verified_inputs("src", ["a.csv"])

    def test_changed_download_needs_explicit_acceptance(self):
        manifest = {"a.csv": {"sha256": self.digest}}
        with self.assertRaises(SystemExit):
            paths.accept_download("src", "a.csv", "f" * 64, manifest, accept_changed=False)
        paths.accept_download("src", "a.csv", "f" * 64, manifest, accept_changed=True)

    def test_replacing_a_pin_keeps_the_old_hash(self):
        paths.record_pin("src", "a.csv", "1" * 64, reason="first")
        paths.record_pin("src", "a.csv", "2" * 64, reason="upstream revised")
        pin = paths.load_pins()["src/a.csv"]
        self.assertEqual(pin["sha256"], "2" * 64)
        self.assertEqual(pin["previous"][0]["sha256"], "1" * 64)
        self.assertEqual(pin["previous"][0]["reason"], "upstream revised")


if __name__ == "__main__":
    unittest.main()
