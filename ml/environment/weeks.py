"""Canonical week convention for every SIGMA weekly table.

Decision (2026-10-20, Physics 3; docs/environmental-covariates.md §4.2):

  A week runs Sunday to Saturday. It is keyed by `period_start` (the Sunday)
  and `period_end` (the Saturday), and numbered with the MMWR rule: the epi
  year is the calendar year of the week's Wednesday, so week 1 is the first
  week with at least four days in January.

This is the convention already used by the hub (HEALTH_OBSERVATIONS starts
2012-12-30 → 2013-01-05) and by the HDX DOH-Epi Sunday dates. Weather is daily,
so it is aggregated straight onto these weeks. Weekly dengue sources carry
their own labels and are moved onto the canonical week with a fixed, documented
offset per source (SOURCE_WEEK_OFFSET_DAYS). What an upstream label means
(onset, consultation or report week) is undocumented for both sources, so the
week is uncertain by about ±1 and models use lag windows, not single lags.
"""

import pandas as pd

# Upstream week label + offset = canonical period_start (a Sunday).
SOURCE_WEEK_OFFSET_DAYS = {
    # CCHAIN PIDSR dates are Mondays. The Sun-Sat week starting the day before
    # shares 6 of its 7 days with a Mon-Sun week.
    "cchain_pidsr": -1,
    # HDX DOH-Epi dates are Sundays. -14 d is the empirical best alignment with
    # CCHAIN (environment.crosscheck: HDX - 13 d = CCHAIN Monday, mean r 0.834,
    # re-measured 2026-10-24 with swap rows excluded). UNCONFIRMED: the meaning of the
    # HDX date is undocumented, and the SIGMA map uses the date as-is (0 d).
    # Used only to cross-check against CCHAIN here; the climate model's outcome
    # is CCHAIN PIDSR, not HDX. See docs/dengue-pipeline.md, "HDX week convention".
    "hdx_doh_epi": -14,
}


def period_start(dates: pd.Series) -> pd.Series:
    """Sunday that starts the canonical week containing each date."""
    dates = pd.to_datetime(dates)
    return (dates - pd.to_timedelta((dates.dt.dayofweek + 1) % 7, unit="D")).dt.normalize()


def from_source_label(labels: pd.Series, source: str) -> pd.Series:
    """Map an upstream weekly label onto the canonical period_start."""
    starts = pd.to_datetime(labels) + pd.Timedelta(days=SOURCE_WEEK_OFFSET_DAYS[source])
    if not (starts.dt.dayofweek == 6).all():
        raise ValueError(f"{source} labels do not map onto Sundays; check the offset")
    return starts


def epi_week(starts: pd.Series) -> pd.DataFrame:
    """MMWR epi year and week number for canonical period_start dates."""
    wednesday = pd.to_datetime(starts) + pd.Timedelta(days=3)
    return pd.DataFrame({
        "epi_year": wednesday.dt.year,
        "epi_week": (wednesday.dt.dayofyear - 1) // 7 + 1,
    }, index=starts.index)


def add_week_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add period_end, epi_year and epi_week next to an existing period_start."""
    df = df.copy()
    df["period_end"] = df["period_start"] + pd.Timedelta(days=6)
    return df.join(epi_week(df["period_start"]))
