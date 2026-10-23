"""Sums over the 126 HDX local places that never count bad rows as data.

A sum across places is only a total when every place has a valid value that
week. Rows that are not "ok" (missing weeks and the 665 suspected
cases/deaths swap rows, whose value is probably the week's death count) are
left out of every calculation, and a week where any place lacks a valid value
has no total (NaN), rather than a partial sum that looks like a dip. The rows
themselves stay in the workbook, marked by data_quality, as evidence.
"""
import pandas as pd

VALID = "ok"


def valid_values(loc: pd.DataFrame) -> pd.Series:
    """`value` where data_quality is "ok", NaN elsewhere (a swap row's 0 is not a zero-case week)."""
    return loc["value"].where(loc["data_quality"].eq(VALID)).astype("float")


def complete_local_sum(loc: pd.DataFrame) -> pd.Series:
    """Weekly sum of valid values, NaN for any week where a place has no valid value."""
    valid = valid_values(loc)
    by_week = valid.groupby(loc["period_start"])
    places = loc.groupby("period_start")["geography_name"].nunique()
    return by_week.sum(min_count=1).where(by_week.count() == places)


def excluded_weeks(loc: pd.DataFrame) -> pd.DataFrame:
    """Per week, how many places were left out and why (for the report's exclusion note)."""
    bad = loc[~loc["data_quality"].eq(VALID)]
    return (bad.groupby(["period_start", "data_quality"]).size()
               .unstack(fill_value=0)
               .sort_index())


def national_vs_local(national: pd.Series, local_sum: pd.Series) -> dict:
    """Correlation and median ratio over weeks where both totals exist."""
    both = pd.concat([national.astype("float"), local_sum], axis=1, keys=["nat", "loc"]).dropna()
    return {
        "weeks": len(both),
        "corr": float(both["nat"].corr(both["loc"])),
        "ratio": float((both["nat"] / both["loc"]).median()),
    }
