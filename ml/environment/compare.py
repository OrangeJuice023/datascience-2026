"""Are CCHAIN and Open-Meteo weather interchangeable? Compare them where both exist.

    python -m environment.compare

For each CCHAIN city, the two sources overlap 2008-2022. This compares them
three ways, because a model sees the data only through environment.features:
  raw      weekly values: bias, ratio, SD ratio, Pearson r, RMSE
  z        standardised anomalies, each source against its own climatology
  windows  lag-window means of z (0-3, 4-7, 8-12 weeks): the actual model inputs
`disagreement_sd` is the SD of (Open-Meteo - CCHAIN) window z. A model term
beta per SD of a window therefore moves log expected cases by about
beta x disagreement_sd just from switching source.

Verdicts per variable use the thresholds in GATE (project choices, not
published standards; docs/environmental-covariates.md §4.7):
  raw_interchangeable      raw values may stand in for each other
  anomaly_interchangeable  only within-source anomalies may stand in
  not_interchangeable      do not substitute; model the source explicitly

Output: data/processed/environment/weather_comparability.{json,csv}
"""

import json

import numpy as np
import pandas as pd

from . import features
from .paths import OUT
from .sources import WEATHER_VARIABLES

VARS = list(WEATHER_VARIABLES)
GATE = {
    # raw: every modeling city within tolerance and r >= RAW_MIN_R
    "raw_tolerance": {"precipitation_mm": ("ratio", 0.9, 1.1),
                      "temperature_mean_c": ("bias", -0.5, 0.5),
                      "temperature_min_c": ("bias", -0.5, 0.5),
                      "temperature_max_c": ("bias", -0.5, 0.5),
                      "humidity_mean_pct": ("bias", -3.0, 3.0)},
    "raw_min_r": 0.95,
    # anomaly: 0-3 week window z correlation
    "window_min_r_any_city": 0.8,
    "window_median_r": 0.9,
}


def load(path=OUT / "city_weekly_weather.csv") -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["period_start", "period_end", "coverage_start", "coverage_end"],
                     dtype={"geography_id": str})
    return df


def overlap_pairs(weather: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Raw and window-z values for both sources on their shared weeks."""
    cc = weather[weather["source_id"] == "cchain"]
    end = cc["coverage_end"].max()
    both = weather[weather["geography_id"].isin(cc["geography_id"]) & (weather["period_end"] <= end)]
    z = features.anomalies(both, train_end=str(end.date()))
    win = features.lag_windows(z.assign(series_id=z["source_id"]))
    key = ["geography_id", "period_start"]
    raw = both.pivot_table(index=key, columns="source_id", values=VARS)
    wz = win.pivot_table(index=key, columns="source_id",
                         values=[c for c in win.columns if c.endswith(("_z", *features.LAG_WINDOWS))])
    return raw, wz


def metrics(a: pd.Series, b: pd.Series) -> dict:
    j = pd.concat([a.rename("cc"), b.rename("om")], axis=1).dropna()
    if len(j) < 52:
        return {"weeks": len(j)}
    d = j["om"] - j["cc"]
    return {
        "weeks": len(j),
        "mean_cchain": j["cc"].mean(),
        "mean_open_meteo": j["om"].mean(),
        "bias": d.mean(),
        "ratio": j["om"].sum() / j["cc"].sum() if j["cc"].sum() else np.nan,
        "sd_ratio": j["om"].std() / j["cc"].std(),
        "r": j["cc"].corr(j["om"]),
        "spearman_r": j["cc"].corr(j["om"], method="spearman"),
        "rmse": float(np.sqrt((d ** 2).mean())),
    }


def compare(weather: pd.DataFrame, modeling: list[str]) -> tuple[pd.DataFrame, dict]:
    raw, wz = overlap_pairs(weather)
    rows = []
    for gid in sorted(raw.index.get_level_values(0).unique()):
        r_g, w_g = raw.loc[gid], wz.loc[gid]
        for v in VARS:
            row = {"geography_id": gid, "variable": v, "modeling_city": gid in modeling}
            row |= {f"raw_{k}": x for k, x in metrics(r_g[(v, "cchain")], r_g[(v, "open_meteo")]).items()}
            row["z_r"] = metrics(w_g[(f"{v}_z", "cchain")], w_g[(f"{v}_z", "open_meteo")]).get("r")
            for name in features.LAG_WINDOWS:
                c = f"{v}_z_{name}"
                m = metrics(w_g[(c, "cchain")], w_g[(c, "open_meteo")])
                row[f"{name}_r"] = m.get("r")
                row[f"{name}_disagreement_sd"] = (
                    float((w_g[(c, "open_meteo")] - w_g[(c, "cchain")]).std()) if m.get("weeks", 0) >= 52 else None)
            rows.append(row)
    table = pd.DataFrame(rows)

    verdicts = {}
    m = table[table["modeling_city"]]
    for v in VARS:
        t = m[m["variable"] == v]
        kind, lo, hi = GATE["raw_tolerance"][v]
        stat = t[f"raw_{kind}"]
        raw_ok = bool(stat.between(lo, hi).all() and (t["raw_r"] >= GATE["raw_min_r"]).all())
        anom_ok = bool((t["w0_3_r"] >= GATE["window_min_r_any_city"]).all()
                       and t["w0_3_r"].median() >= GATE["window_median_r"])
        verdicts[v] = {
            "verdict": "raw_interchangeable" if raw_ok and anom_ok
            else "anomaly_interchangeable" if anom_ok else "not_interchangeable",
            f"raw_{kind}_range": [round(float(stat.min()), 3), round(float(stat.max()), 3)],
            "raw_r_range": [round(float(t["raw_r"].min()), 3), round(float(t["raw_r"].max()), 3)],
            "w0_3_r_median": round(float(t["w0_3_r"].median()), 3),
            "w0_3_r_min": round(float(t["w0_3_r"].min()), 3),
            "w0_3_disagreement_sd_median": round(float(t["w0_3_disagreement_sd"].median()), 3),
            "w8_12_r_median": round(float(t["w8_12_r"].median()), 3),
        }
    return table, verdicts


def main() -> None:
    weather = load()
    report = json.loads((OUT / "quality_report.json").read_text())
    modeling = list(report["dengue"]["modeling_cities"])
    table, verdicts = compare(weather, modeling)
    table.to_csv(OUT / "weather_comparability.csv", index=False, float_format="%.4f")
    out = {
        "overlap": "CCHAIN cities, canonical weeks 2007-12-30 .. 2022-12-31, rows usable in both sources",
        "gate": GATE,
        "verdicts_modeling_cities": verdicts,
    }
    (OUT / "weather_comparability.json").write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(verdicts, indent=2))
    cols = ["geography_id", "variable", "raw_bias", "raw_ratio", "raw_sd_ratio", "raw_r", "z_r", "w0_3_r",
            "w0_3_disagreement_sd"]
    print(table[cols].round(3).to_string(index=False))


if __name__ == "__main__":
    main()
