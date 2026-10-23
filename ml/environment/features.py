"""Weather model inputs that do not depend on which source supplied them.

The only sanctioned way to turn city_weekly_weather.csv into model covariates.
Two rules keep a model's output from changing just because the source did:

1. Anomalies are computed within a source. Each geography x source series is
   compared with its own week-of-year climatology, built from that same source
   over the training window only (no look-ahead). Raw values from different
   sources are never put in one column: CCHAIN rainfall is CHIRPS and
   Open-Meteo rainfall is ERA5, so their levels differ (environment.compare).
   Anomalies are standardised (z) so variance differences cancel as well.
2. Every input row keeps its source_id. When a geography's series is spliced
   from two sources (CCHAIN to 2022, Open-Meteo after), lag windows that mix
   the two are flagged `mixed_source_window`, so they can be dropped or
   reported separately.
3. A variable that environment.compare found not_interchangeable (rainfall:
   CHIRPS vs ERA5) is never taken from a secondary source in a spliced
   series; it stays empty there. A single-source run (sources=["open_meteo"])
   is internally consistent and keeps every variable.

    from environment import features
    z = features.anomalies(weather, train_end="2019-12-28")
    x = features.model_inputs(weather, train_end="2019-12-28")
"""

import json

import numpy as np
import pandas as pd

from .paths import OUT
from .sources import WEATHER_VARIABLES

VARS = list(WEATHER_VARIABLES)
# Lag windows in weeks before the target week (docs §5.1): 0-3, 4-7, 8-12.
LAG_WINDOWS = {"w0_3": (0, 3), "w4_7": (4, 7), "w8_12": (8, 12)}
CLIMATOLOGY_SMOOTH_WEEKS = 5  # centred, circular across the year
SOURCE_PRIORITY = ["cchain", "open_meteo"]  # primary first
USABLE_FLAGS = {"ok", "rain_partial_area"}  # rows other flags are excluded from climatology


def _woy(df: pd.DataFrame) -> pd.Series:
    return df["epi_week"].clip(upper=52)  # week 53 shares week 52's climatology


def climatology(series: pd.DataFrame, train_end: str) -> pd.DataFrame:
    """Mean and SD by geography x source x week-of-year, training rows only."""
    train = series[(series["period_end"] <= pd.Timestamp(train_end)) & series["qc_flag"].isin(USABLE_FLAGS)]
    g = train.assign(woy=_woy(train)).groupby(["geography_id", "source_id", "woy"])[VARS]
    mean, sd = g.mean(), g.std()

    def smooth(t: pd.DataFrame) -> pd.DataFrame:
        k = CLIMATOLOGY_SMOOTH_WEEKS // 2
        out = []
        for key, grp in t.groupby(level=[0, 1]):
            grp = grp.droplevel([0, 1]).reindex(range(1, 53))
            wrapped = pd.concat([grp.iloc[-k:], grp, grp.iloc[:k]])
            sm = wrapped.rolling(CLIMATOLOGY_SMOOTH_WEEKS, center=True, min_periods=1).mean().iloc[k:-k]
            out.append(sm.assign(geography_id=key[0], source_id=key[1]).rename_axis("woy").reset_index())
        return pd.concat(out).set_index(["geography_id", "source_id", "woy"])

    return smooth(mean).join(smooth(sd), lsuffix="_mean", rsuffix="_sd")


def anomalies(weather: pd.DataFrame, train_end: str) -> pd.DataFrame:
    """Standardised anomaly z per variable, each source against itself."""
    clim = climatology(weather, train_end)
    df = weather.assign(woy=_woy(weather)).join(clim, on=["geography_id", "source_id", "woy"])
    out = weather[["geography_id", "source_id", "period_start", "period_end", "epi_year", "epi_week", "qc_flag"]].copy()
    for v in VARS:
        out[f"{v}_z"] = (df[v] - df[f"{v}_mean"]) / df[f"{v}_sd"].replace(0, np.nan)
    out.loc[~out["qc_flag"].isin(USABLE_FLAGS | {"provisional_era5t"}), [f"{v}_z" for v in VARS]] = np.nan
    return out


def lag_windows(z: pd.DataFrame) -> pd.DataFrame:
    """Window means of z for each target week, per geography x `series_id`.

    A window needs every one of its weeks; otherwise it is left empty.
    """
    zcols = [c for c in z.columns if c.endswith("_z")]
    parts = []
    for _, g in z.sort_values("period_start").groupby(["geography_id", "series_id"], sort=False):
        g = g.set_index("period_start")
        full = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="W-SUN"))
        res = pd.DataFrame(index=g.index)
        for name, (lo, hi) in LAG_WINDOWS.items():
            n = hi - lo + 1
            win = full[zcols].shift(lo).rolling(n, min_periods=n).mean()  # all weeks required
            res[[f"{c}_{name}" for c in zcols]] = win.reindex(g.index).values
        parts.append(g.join(res).reset_index(names="period_start"))
    return pd.concat(parts, ignore_index=True)


def not_interchangeable() -> list[str]:
    """Variables environment.compare found not substitutable across sources."""
    path = OUT / "weather_comparability.json"
    if not path.exists():
        raise SystemExit("weather_comparability.json missing; run `python -m environment.compare` first")
    verdicts = json.loads(path.read_text())["verdicts_modeling_cities"]
    return [v for v, d in verdicts.items() if d["verdict"] == "not_interchangeable"]


def model_inputs(weather: pd.DataFrame, train_end: str, sources: list[str] | None = None) -> pd.DataFrame:
    """One input row per geography x week, primary source first, with lag windows.

    For each geography and week, the first source in `sources` (default
    SOURCE_PRIORITY) that has a usable row is taken. Each row keeps source_id;
    `mixed_source_window` marks rows whose 0-12 week history spans more than
    one source. Not-interchangeable variables are left empty on rows taken
    from a secondary source.
    """
    sources = sources or SOURCE_PRIORITY
    z = anomalies(weather[weather["source_id"].isin(sources)], train_end)
    zcols = [c for c in z.columns if c.endswith("_z")]
    z = z[z[zcols].notna().any(axis=1)]
    rank = z["source_id"].map({s: i for i, s in enumerate(sources)})
    chosen = z.assign(_rank=rank).sort_values("_rank").drop_duplicates(["geography_id", "period_start"])
    chosen = chosen.drop(columns="_rank").assign(series_id="spliced")
    if len(sources) > 1:
        secondary = chosen["source_id"] != sources[0]
        for v in not_interchangeable():
            chosen.loc[secondary, f"{v}_z"] = np.nan
    out = lag_windows(chosen)

    code = out["source_id"].map({s: i for i, s in enumerate(sources)}).astype(float)
    mixed = []
    for _, g in out.assign(_code=code).sort_values("period_start").groupby("geography_id", sort=False):
        s = g.set_index("period_start")["_code"]
        s = s.reindex(pd.date_range(s.index.min(), s.index.max(), freq="W-SUN"))
        span = max(hi for _, hi in LAG_WINDOWS.values()) + 1
        m = (s.rolling(span, min_periods=1).max() != s.rolling(span, min_periods=1).min())
        mixed.append(pd.Series(m.reindex(g["period_start"]).values, index=g.index))
    out["mixed_source_window"] = pd.concat(mixed).reindex(out.index).astype(bool)
    return out.drop(columns="series_id").sort_values(["geography_id", "period_start"]).reset_index(drop=True)
