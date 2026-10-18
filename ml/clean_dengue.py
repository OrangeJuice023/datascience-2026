"""Clean the national and local dengue datasets and combine them into one workbook.

Output: data/processed/dengue_cases_combined.xlsx, with a NATIONAL sheet and a
LOCAL sheet. Both cover the local data's date range (minus its incomplete
final week) on a complete weekly calendar; weeks with no record have a null
value. data_quality marks each week as ok / missing, and national weeks
distorted by the year-end reporting cut-off as incomplete / backlog. Anything
other than "ok" should be excluded from EARS baselines and alarms. data_flag
warns about local weeks that are "ok" but look like reporting artefacts
(possible non-reporting, one-week spike); their values are kept.
"""
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
NATIONAL_SRC = DATA / "raw" / "Database for Dengue Cases at the National Level.xlsx"
LOCAL_SRC = DATA / "raw" / "Database for Dengue Cases at the Local Level.csv"
OUT = DATA / "processed" / "dengue_cases_combined.xlsx"

LOC_FIXES = {
    "BASILIG CITY": "BISLIG CITY",
    "NUEVA VISCAYA": "NUEVA VIZCAYA",
    "SISQUIJOR": "SIQUIJOR",
}
REGION_FIXES = {
    "REGION VII-EASTERN VISAYAS": "REGION VIII-EASTERN VISAYAS",
    "REGION IVB-MIMAROPA": "REGION IV-B-MIMAROPA",
}


def clean_national() -> pd.DataFrame:
    # Rows 0-2 are a title, a description and a blank line; the header is row 3.
    df = pd.read_excel(NATIONAL_SRC, header=3)
    df = df[["geographic_level", "period_start", "value"]].dropna()
    df["period_start"] = pd.to_datetime(df["period_start"], format="%d/%m/%Y")
    df["value"] = df["value"].astype(int)
    return df.drop_duplicates().sort_values("period_start").reset_index(drop=True)


def clean_local() -> pd.DataFrame:
    # Row 1 is an HXL tag row (#adm2+name, ...), not data.
    df = pd.read_csv(LOCAL_SRC, skiprows=[1])
    df = df.drop(columns="deaths")

    df["loc"] = df["loc"].str.strip().str.upper().replace(LOC_FIXES)
    df["Region"] = df["Region"].str.strip().str.upper().replace(REGION_FIXES)
    df["date"] = pd.to_datetime(df["date"], format="%m/%d/%Y")

    df = df.rename(columns={
        "loc": "geography_name",
        "Region": "region",
        "date": "period_start",
        "cases": "value",
    })
    df.insert(0, "geographic_level", "local")
    df = df[["geographic_level", "region", "geography_name", "period_start", "value"]]

    return (df.drop_duplicates()
              .sort_values(["region", "geography_name", "period_start"])
              .reset_index(drop=True))


def flag_year_end_artefacts(national: pd.DataFrame, local: pd.DataFrame) -> None:
    """Mark national weeks distorted by the year-end reporting cut-off.

    Each year the national series tapers off before its December gap
    (late reports never added: "incomplete") and jumps in early January
    (carried-over reports dumped in: "backlog"). National normally runs at
    ~0.93x the sum of all local places, so a week in the year-end window that
    is far below or above that sum is flagged. The window is limited to
    October to mid-January so that real events elsewhere in the year (the
    2019 epidemic, the 2020 lockdown dip) are left as "ok".
    """
    # Only compare against weeks where nearly every local place reported
    # (Davao Occidental alone has scattered gaps through 2016-2018).
    complete = local.groupby("period_start")["value"].agg(
        lambda v: v.sum() if v.isna().sum() <= 5 else None)
    ratio = national["value"] / national["period_start"].map(complete)

    d = national["period_start"].dt
    year_end = (d.month >= 10) | ((d.month == 1) & (d.day <= 15))
    is_ok = national["data_quality"] == "ok"

    national.loc[is_ok & year_end & (ratio < 0.6), "data_quality"] = "incomplete"
    national.loc[is_ok & year_end & (ratio > 1.4), "data_quality"] = "backlog"


def flag_suspect_local_weeks(local: pd.DataFrame) -> None:
    """Set data_flag on local weeks whose value is probably a reporting artefact.

    The value is kept as published; the flag only warns. True counts for these
    weeks are not recoverable from the data.
    - "possible non-reporting": 4+ consecutive zero weeks in a place whose
      median non-zero week is 10+ cases (a report not received, recorded as 0)
    - "one-week spike": a week over 8x its place's 9-week rolling median, at
      least 30 cases, and at least 4x both neighbours (a backlog dumped into
      one week, or an entry error)
    """
    place = local.groupby("geography_name")["value"]
    v = local["value"].astype(float)

    typical = local["geography_name"].map(local[v > 0].groupby("geography_name")["value"].median())
    zero = v.eq(0)
    run_id = (zero != zero.groupby(local["geography_name"]).shift()).cumsum()
    run_len = zero.groupby(run_id).transform("sum").where(zero, 0)
    non_reporting = (run_len >= 4) & (typical >= 10)

    median = place.transform(lambda s: s.astype(float).rolling(9, center=True, min_periods=5).median())
    neighbour = pd.concat([place.shift(1), place.shift(-1)], axis=1).astype(float).max(axis=1)
    spike = (v > 8 * median.clip(lower=1)) & (v >= 30) & (v >= 4 * neighbour.clip(lower=1))

    local["data_flag"] = None
    local.loc[non_reporting, "data_flag"] = "possible non-reporting"
    local.loc[spike, "data_flag"] = "one-week spike"


def add_doh_thresholds(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Append DOH alert and epidemic thresholds (Eligado et al., 2026).

    A(w, y) = mean of Y(w, y-j) for j = 1..3   (same week, 3 previous years)
    E(w, y) = A(w, y) + 2 * sd of those 3 values

    Weeks are epidemiological (MMWR) weeks: Sunday to Saturday, numbered by
    the year that holds the week's Wednesday. sd is the sample sd (n - 1).

    Thresholds start in the first year with 3 prior years of data. Where the
    standard rule cannot be applied, doh_note says what was done instead:
    - a baseline year whose week is not "ok" is dropped, and the threshold
      uses the other 2 years; with fewer than 2, status is "no baseline"
    - week 53 takes week 52 from baseline years that have no week 53
    - a current week that is not "ok" keeps its thresholds but gets status
      "unreliable week", since its value cannot be compared with them
    """
    wednesday = df["period_start"] + pd.Timedelta(days=3)
    df["epi_year"] = wednesday.dt.year.astype("int64")
    df["epi_week"] = ((wednesday.dt.dayofyear - 1) // 7 + 1).astype("int64")

    cols = keys + ["epi_year", "epi_week", "data_quality", "value", "data_flag"]
    lookup = {(*k, y, w): (q, v, f)
              for *k, y, w, q, v, f in df[cols].itertuples(index=False, name=None)}
    first_year = df["epi_year"].min() + 3

    alert, epidemic, status, note = [], [], [], []
    for *k, y, w, q, v, f in df[cols].itertuples(index=False, name=None):
        if y < first_year:
            alert.append(None); epidemic.append(None)
            status.append("no baseline")
            note.append(f"thresholds start in {first_year} (need 3 prior years of data)")
            continue

        values, notes, swapped = [], [], []
        for by in (y - 1, y - 2, y - 3):
            bw = w
            if w == 53 and (*k, by, 53) not in lookup:
                bw = 52
                swapped.append(str(by))
            bq, bv, bf = lookup.get((*k, by, bw), ("missing", None, None))
            if bq == "ok":
                values.append(float(bv))
                if pd.notna(bf):
                    notes.append(f"{by} week {bw} {bf}, kept in baseline")
            else:
                notes.append(f"{by} week {bw} {bq}, excluded")
        if swapped:
            notes.insert(0, f"week 53 baseline uses week 52 of {', '.join(swapped)} (no week 53)")

        if len(values) < 2:
            alert.append(None); epidemic.append(None)
            status.append("no baseline")
            note.append("; ".join(notes + ["fewer than 2 usable baseline years"]))
            continue

        a = sum(values) / len(values)
        e = a + 2 * pd.Series(values).std()
        alert.append(round(a, 1)); epidemic.append(round(e, 1))
        if len(values) == 2:
            notes.append("threshold from 2 of 3 baseline years")

        if q != "ok":
            status.append("unreliable week")
            notes.append(f"current week {q}, not compared")
        elif v > e:
            status.append("epidemic")
        elif v > a:
            status.append("alert")
        else:
            status.append("normal")
        note.append("; ".join(notes) or None)

    df["alert_threshold"] = alert
    df["epidemic_threshold"] = epidemic
    df["doh_status"] = status
    flagged = df["data_flag"].notna()
    df["doh_note"] = pd.Series(note, index=df.index, dtype="object")
    df.loc[flagged, "doh_note"] = ("current week: " + df.loc[flagged, "data_flag"] + "; "
                                   + df.loc[flagged, "doh_note"].fillna("")).str.rstrip("; ")
    return df


def main() -> None:
    national = clean_national()
    local = clean_local()

    # Limit both to the local data's range and give every series every week,
    # leaving value null where the source has no record for that week. The
    # local data's last week (10/01/2021) is dropped: it was extracted before
    # most of its reports arrived (about half the usual count).
    weeks = pd.date_range(local["period_start"].min(),
                          local["period_start"].max() - pd.Timedelta(weeks=1),
                          freq="W-SUN", name="period_start")
    local = local[local["period_start"] <= weeks[-1]]

    national = (national.set_index("period_start")
                        .reindex(weeks)
                        .assign(geographic_level="national")
                        .reset_index()[["geographic_level", "period_start", "value"]])

    places = local[["region", "geography_name"]].drop_duplicates()
    grid = places.merge(weeks.to_frame(index=False), how="cross")
    local = (grid.merge(local, on=["region", "geography_name", "period_start"], how="left")
                 .assign(geographic_level="local")
                 [["geographic_level", "region", "geography_name", "period_start", "value"]]
                 .sort_values(["region", "geography_name", "period_start"])
                 .reset_index(drop=True))

    for df in (national, local):
        df["value"] = df["value"].astype("Int64")
        df["data_quality"] = df["value"].isna().map({True: "missing", False: "ok"})

    flag_year_end_artefacts(national, local)
    national["data_flag"] = None
    flag_suspect_local_weeks(local)

    national = add_doh_thresholds(national, keys=["geographic_level"])
    local = add_doh_thresholds(local, keys=["region", "geography_name"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUT, engine="openpyxl", datetime_format="DD/MM/YYYY") as xw:
        national.to_excel(xw, sheet_name="NATIONAL", index=False)
        local.to_excel(xw, sheet_name="LOCAL", index=False)
        for ws in xw.book.worksheets:
            ws.freeze_panes = "A2"
            for col in ws.columns:
                width = max(len(str(c.value)) for c in col[:200])
                ws.column_dimensions[col[0].column_letter].width = max(width, 10) + 2

    print(f"weeks: {weeks[0]:%d/%m/%Y} to {weeks[-1]:%d/%m/%Y} ({len(weeks)})")
    for name, df in (("national", national), ("local", local)):
        print(f"{name}: {len(df)} rows, {df['data_quality'].value_counts().to_dict()}")
        print(f"  data_flag: {df['data_flag'].value_counts().to_dict()}")
        print(f"  doh_status: {df['doh_status'].value_counts(dropna=False).to_dict()}")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
