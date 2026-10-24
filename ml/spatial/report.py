"""Write docs/geo/spatial-analysis-report.md and its figures from data/processed/spatial/.

    cd ml && python -m spatial.run && python -m spatial.report

The report holds numbers and tables only; what they mean for SIGMA is written
by hand in docs/geo/spatial-assessment-and-method.md §6.2, so a rebuild can
never leave stale conclusions in generated text.
"""

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.collections import PolyCollection  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

from . import paths  # noqa: E402
from .run import CLASSES  # noqa: E402

# Reference dataviz palette (validated: categorical slots 1-2 pass CVD and contrast on the surface).
SURFACE, INK, INK2, MUTED, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#e1e0d9"
BLUE, ORANGE, NEUTRAL = "#2a78d6", "#eb6834", "#e1e0d9"
SEASON_2019 = ("2019-06-01", "2019-09-30")
FIG_MORAN = "spatial-moran-weekly.png"
FIG_MAP = "spatial-clusters-2019.png"


def _style(ax):
    ax.set_facecolor(SURFACE)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#c3c2b7")
    ax.tick_params(colors=INK2, labelsize=9)
    ax.grid(axis="y", color=GRID, linewidth=0.6)


def fig_moran(g: pd.DataFrame) -> None:
    d = g[(g.variant == "primary") & (g.level == "unit") & (g.weights == "W1") & (g["transform"] == "raw")]
    d = d.assign(week=pd.to_datetime(d.week)).sort_values("week")
    fig, ax = plt.subplots(figsize=(10, 3.6), dpi=150, facecolor=SURFACE)
    _style(ax)
    ax.axvspan(pd.Timestamp("2019-06-01"), pd.Timestamp("2019-11-30"), color=GRID, alpha=0.6, lw=0)
    ax.text(pd.Timestamp("2019-06-08"), 0.97, "2019 season", transform=ax.get_xaxis_transform(),
            color=INK2, fontsize=8, va="top")
    for day, label in (("2019-07-15", "DOH alert"), ("2019-08-06", "epidemic declared")):
        ax.axvline(pd.Timestamp(day), color=MUTED, lw=0.8, ls="--")
    ax.axhline(0, color="#c3c2b7", lw=0.8)
    ax.plot(d.week, d.moran_i, color=BLUE, lw=1.4)
    sig = d[d.q <= 0.05]
    ns = d[(d.q > 0.05) & d.moran_i.notna()]
    ax.scatter(sig.week, sig.moran_i, s=12, color=BLUE, zorder=3, label="significant (FDR q ≤ 0.05)")
    ax.scatter(ns.week, ns.moran_i, s=12, facecolor=SURFACE, edgecolor=BLUE, lw=0.8, zorder=3,
               label="not significant")
    ax.set_ylabel("Moran's I of EARS C2", color=INK2, fontsize=9)
    ax.set_title("Weekly spatial clustering of EARS C2 across the 126 reporting units (W1, k = 5)",
                 loc="left", color=INK, fontsize=10)
    ax.legend(frameon=False, fontsize=8, loc="upper left", labelcolor=INK2)
    fig.text(0.01, 0.01, "Gaps: weeks where fewer than 80% of units have C2 (series start, swap blocks, 2019-01-06). "
             "Dashed: DOH national alert 15/07/2019, epidemic declaration 06/08/2019.", color=MUTED, fontsize=7)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(paths.FIGURES / FIG_MORAN, facecolor=SURFACE)
    plt.close(fig)


def season_classes(local: pd.DataFrame) -> pd.Series:
    d = local[(local.variant == "primary") & (local.weights == "W1")]
    d = d[(d.week >= SEASON_2019[0]) & (d.week <= SEASON_2019[1])]
    weeks = d.week.nunique()
    by = d.groupby("unit_id")
    cls = pd.Series("neither", index=by.size().index)
    cls[by.cluster_class.apply(lambda s: (s == CLASSES[1]).any())] = "isolated high signal only"
    cls[by.cluster_class.apply(lambda s: (s == CLASSES[0]).any())] = "high-signal cluster, 1+ weeks"
    cls[by.size() < weeks / 2] = "evaluated in under half the weeks"
    return cls


def fig_map(cls: pd.Series) -> dict:
    gj = json.loads(paths.UNITS_GEOJSON.read_text(encoding="utf-8"))
    colours = {"high-signal cluster, 1+ weeks": ORANGE, "isolated high signal only": BLUE, "neither": NEUTRAL}
    fig, ax = plt.subplots(figsize=(6, 8), dpi=150, facecolor=SURFACE)
    ax.set_facecolor(SURFACE)
    for state in [*colours, "evaluated in under half the weeks", None]:
        polys = []
        for f in gj["features"]:
            if cls.get(f["properties"]["id"]) != state:
                continue
            geom = f["geometry"]
            for poly in [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]:
                polys.append(np.asarray(poly[0]))
        if not polys:
            continue
        if state in colours:
            pc = PolyCollection(polys, facecolor=colours[state], edgecolor=SURFACE, linewidth=0.3)
        else:
            pc = PolyCollection(polys, facecolor=SURFACE, edgecolor=MUTED, linewidth=0.3, hatch="////")
        ax.add_collection(pc)
    ax.autoscale_view()
    ax.set_aspect(1 / np.cos(np.radians(12)))
    ax.axis("off")
    counts = cls.value_counts()
    handles = [Patch(facecolor=c, edgecolor=SURFACE, label=f"{k} ({counts.get(k, 0)})") for k, c in colours.items()]
    handles.append(Patch(facecolor=SURFACE, edgecolor=MUTED, hatch="////",
                         label=f"evaluated in under half the weeks ({counts.get('evaluated in under half the weeks', 0)})"))
    ax.legend(handles=handles, frameon=False, fontsize=7.5, loc="upper right", labelcolor=INK2)
    ax.set_title("Local Moran class of EARS C2, June–September 2019 (W1)", loc="left", color=INK, fontsize=9.5)
    fig.text(0.02, 0.02, "Signal status relative to each area's own history — not a measure of local risk or incidence.\n"
             "Polygons: geoBoundaries (Runfola et al. 2020), CC BY 3.0 IGO. Dengue: Cirrolytix / DOH-EB via HDX, CC BY.",
             color=MUTED, fontsize=6.5)
    fig.savefig(paths.FIGURES / FIG_MAP, facecolor=SURFACE, bbox_inches="tight")
    plt.close(fig)
    return counts.to_dict()


def table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    lines = ["| " + " | ".join(cols) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    for row in df.itertuples(index=False):
        lines.append("| " + " | ".join("" if pd.isna(v) else str(v) for v in row) + " |")
    return "\n".join(lines)


def pct(x) -> str:
    return "–" if x is None else f"{100 * x:.0f}%"


def main() -> None:
    s = json.loads((paths.OUT / "summary.json").read_text(encoding="utf-8"))
    g = pd.read_csv(paths.OUT / "global_moran.csv")
    local = pd.read_csv(paths.OUT / "local_clusters.csv")
    knox = pd.read_csv(paths.OUT / "knox.csv")
    paths.FIGURES.mkdir(parents=True, exist_ok=True)
    fig_moran(g)
    map_counts = fig_map(season_classes(local))

    st, w = s["settings"], s["weights"]
    gl = s["global"]
    prim = gl["primary|unit|W1|raw"]

    rows = []
    for key, label in (("primary|unit|W1|raw", "Units, W1 (primary)"), ("primary|unit|W2|raw", "Units, W2"),
                       ("primary|unit|W3|raw", "Units, W3"), ("primary|unit|W1|rank", "Units, W1, ranks of C2"),
                       ("swapped_back|unit|W1|raw", "Units, W1, swap rows swapped back"),
                       ("no_2016|unit|W1|raw", "Units, W1, 2016 excluded"),
                       ("primary|province|W1|raw", "83 full provinces, W1"), ("primary|province|W2|raw", "83 full provinces, W2"),
                       ("primary|province|W3|raw", "83 full provinces, W3")):
        d = gl[key]
        rows.append(dict(analysis=label, weeks=d["all"]["weeks"],
                         significant=f"{d['all']['significant']} ({pct(d['all']['share_significant'])})",
                         **{"2016–2018": pct(d["2016-2018"]["share_significant"]),
                            "2019–2021": pct(d["2019-2021"]["share_significant"]),
                            "2019 season": pct(d["2019 season"]["share_significant"]),
                            "other seasons": pct(d["other seasons"]["share_significant"]),
                            "median I": d["all"]["median_i"]}))
    global_table = table(pd.DataFrame(rows))

    lrows = []
    for key, label in (("primary|W1", "W1 (primary)"), ("primary|W2", "W2"), ("primary|W3", "W3"),
                       ("swapped_back|W1", "W1, swap rows swapped back"), ("no_2016|W1", "W1, 2016 excluded")):
        for period in ("2016-2018", "2019-2021"):
            d = s["local"][key][period]
            lrows.append({"analysis": label, "period": period.replace("-", "–"), "unit-weeks": d["unit_weeks"],
                          "high-signal cluster": d[CLASSES[0]], "isolated high": d[CLASSES[1]],
                          "Gi* hot spots": d["gi_hot_spots"], "…also high cluster": d["hot_spots_also_high_cluster"],
                          "weeks with a cluster": d["weeks_with_any_cluster"]})
    local_table = table(pd.DataFrame(lrows))
    agree = s["local_weights_agreement"]

    k = knox.assign(pairs_close=knox.space_close_pairs, ratio=knox.ratio.round(2), expected=knox.expected.round(0).astype(int))
    k = k[["variant", "weights", "period", "null", "events", "observed", "expected", "ratio", "p"]]
    knox_main = table(k[(k.variant == "primary") & k.weights.isin(["W1", "W2", "W3"])])
    knox_checks = table(k[(k.variant != "primary") | k.weights.str.startswith("province")])

    lt = s["lead_times"]
    lrows = []
    for key in ("primary|epidemic", "primary|alert or epidemic", "swapped_back|epidemic", "no_2016|epidemic"):
        d = lt[key]
        variant, threshold = key.split("|")
        for rule, label in (("aggregate", "regional series itself"), ("local1", "any member unit"),
                            ("local2", "2+ member units same week"), ("local_cal", "calibrated count of units")):
            r = d[rule]
            lrows.append({"variant": variant, "threshold": threshold, "episodes": d["episodes"], "rule": label,
                          "found": r["found"], "median lead (wk)": r["median_lead"],
                          "fires in quiet windows": pct(r["background_hit"]),
                          "earlier / same / later than regional": "" if rule == "aggregate"
                          else f"{r['earlier']} / {r['same']} / {r['later']}",
                          "only local found": "" if rule == "aggregate" else r["only_local"]})
    lead_table = table(pd.DataFrame(lrows))
    nat = pd.DataFrame([r for r in lt["national"] if r["onset_observed"]])
    nat = nat.rename(columns={"aggregate_first": "national series first alarm", "local_cal_first": "units over calibrated count",
                              "aggregate_lead": "national lead (wk)", "local_cal_lead": "local lead (wk)"})
    nat_table = table(nat[["variant", "threshold", "onset", "k_cal", "national series first alarm",
                           "units over calibrated count", "national lead (wk)", "local lead (wk)"]])

    nc = s["negative_control"]
    pl = s["plausibility"]
    pl_regions = table(pd.DataFrame(pl["regions"]).rename(columns={"news": "DOH 15/07/2019 class"}))
    pl_places = table(pd.DataFrame(pl["places"]))
    ga = s["global_agreement"]
    pw = s["province_weights"]

    md = f"""# Spatial analysis of EARS signals: results

> **Generated** by `ml/spatial/report.py` from `data/processed/spatial/` (`python -m spatial.run`);
> do not edit by hand. Method: [spatial-assessment-and-method.md](spatial-assessment-and-method.md) §4.2–4.4;
> what the results mean for SIGMA: §6.2 of that document. Hackathon prototype, not a validated
> public-health claim.

## In plain language

This report checks whether dengue warning signals (EARS C2, each place measured against its own
recent weeks) occur close together on the map more often than chance would give, whether alarms
in neighbouring places start at about the same time, and whether watching the 126 places one by
one warns earlier than watching the regional and national totals. Every test is repeated with
three definitions of "neighbour", with the data problems handled three ways, at province level,
and with the places' locations shuffled, which should make any real pattern vanish.

## 1. Setup

- Statistic: EARS C2 per reporting unit and week (`ml/ears.py`); raw counts are never compared
  across units. Re-running EARS on `dengue_cases_combined.xlsx` reproduces `dengue_ears.xlsx`
  with **{s['reproduces_ears']}** differences.
- A week is analysed when at least {pct(st['min_coverage'])} of units have C2; a unit whose
  neighbours all lack C2 that week is left out, and missing neighbours are not replaced.
- {st['perms']} permutations per test (seed {st['seed']}); Benjamini–Hochberg FDR at
  q ≤ {st['alpha']} over weeks (global) or over units within a week (local).
- "High-signal cluster" and "isolated high signal" also need the unit's own C2 > {st['high_c2']}.
- Episodes: runs of EARS alarm weeks, gaps of up to {st['episode_max_gap']} week merged.

| Weights | Definition | Neighbours (min / median / max) |
| --- | --- | --- |
| W1 (primary) | {st['k']} nearest representative points | {w['W1_neighbours']['min']} / {w['W1_neighbours']['median']:g} / {w['W1_neighbours']['max']} |
| W2 | within {w['band_km']} km (smallest band leaving no unit isolated) | {w['W2_neighbours']['min']} / {w['W2_neighbours']['median']:g} / {w['W2_neighbours']['max']} |
| W3 | shared border in the reporting-unit polygons; {w['cities_linked_to_remainder']} city linked to its enclosing remainder; {len(w['linked_to_nearest'])} units with no land neighbour linked to the nearest ({', '.join(w['linked_to_nearest'])}) | {w['W3_neighbours']['min']} / {w['W3_neighbours']['median']:g} / {w['W3_neighbours']['max']} |

Province level (MAUP check): {pw['units']} units (81 provinces, each with its cities; NCR as one
unit; Zamboanga City on its own), distance band {pw['band_km']} km.

## 2. Global clustering by week (step 4)

![Weekly Moran's I](figures/{FIG_MORAN})

{global_table}

Seasons are June–November. Correlation of the weekly Moran's I series: W1 vs W2
{ga['corr_W1_W2']}, W1 vs W3 {ga['corr_W1_W3']}, units vs provinces (W1) {ga['corr_unit_province_W1']}
over {ga['common_weeks']} common weeks. National epidemic declaration week (2019-08-04): Moran's I
{pl['national_declaration_week']['moran_i']}, q = {pl['national_declaration_week']['q']}.

## 3. Local clusters (step 5)

{local_table}

Agreement of the three-way class between weights (unit-weeks evaluated under both):
W1 vs W2 κ = {agree['W1_vs_W2']['kappa']} ({agree['W1_vs_W2']['high_cluster_both']} unit-weeks are a
high-signal cluster under both; {agree['W1_vs_W2']['high_cluster_W1']} under W1, {agree['W1_vs_W2']['high_cluster_other']} under W2);
W1 vs W3 κ = {agree['W1_vs_W3']['kappa']} ({agree['W1_vs_W3']['high_cluster_both']} both;
{agree['W1_vs_W3']['high_cluster_W1']} W1, {agree['W1_vs_W3']['high_cluster_other']} W3).

![Local clusters June–September 2019](figures/{FIG_MAP})

Units by class, June–September 2019 (W1): {', '.join(f'{k} {v}' for k, v in map_counts.items())}.

## 4. Space-time clustering of alarm starts (step 6, Knox)

Pairs of EARS episode starts in neighbouring units (W, symmetrised) and within
{st['knox_max_dt']} weeks of each other, against {st['perms']} permutations of start weeks across
all weeks, or only within the same epi year (removes year-to-year differences).

{knox_main}

## 5. Local versus aggregate lead time (step 7)

For each regional DOH-threshold episode (2+ consecutive weeks; onset counted only when the week
before was evaluated and below the threshold), the first EARS alarm in the {st['lookback']} weeks
before onset through the episode's end: on the regional series itself, and from its member units
under three rules. "Calibrated count": more units alarming in the same week than in 95% of
off-season (December–May) weeks of 2016–2018 (median {lt['primary|epidemic']['k_cal_median']:g} for
regions). "Fires in quiet windows": share of {st['lookback'] + 1}-week windows in 2019–2021 that
touch no episode in which the rule fires anyway.

{lead_table}

National (sum of all 126 units, complete weeks only). Its own DOH-threshold episode starts in the
first week thresholds exist, so its onset is censored; the DOH announcements are used instead, with
the window starting 2019-03-03.

{nat_table}

## 6. Validation

**Weights and MAUP**: tables in §2–§4 (W2, W3, province rows).

**Data quality.** Swap rows swapped back and 2016 excluded:

{knox_checks}

**Negative control.** Unit locations shuffled {nc['shuffles']} times (each series kept intact),
{nc['perms']} permutations each: weekly Moran's I significant after FDR in {pct(nc['share_q05']['mean'])}
of weeks on average (max {pct(nc['share_q05']['max'])}); raw p ≤ 0.05 in {pct(nc['share_p05']['mean'])}
(max {pct(nc['share_p05']['max'])}). Knox ratio {nc['knox_ratio_all_weeks']['mean']}
(range {nc['knox_ratio_all_weeks']['min']}–{nc['knox_ratio_all_weeks']['max']}); within-year Knox
p ≤ 0.05 in {nc['knox_p_within_epi_year_below_05']} of {nc['shuffles']} shuffles.

**Out of time.** No parameter was tuned; every table splits 2016–2018 from 2019–2021. The lead-time
calibration uses 2016–2018 only.

**External plausibility** (qualitative; there are no outbreak labels). Units in a high-signal
cluster at least once, {pl['window']} (W1), by the region's class in the DOH announcement of
15/07/2019:

{pl_regions}

Places named in news reports (8 weeks up to the event):

{pl_places}

## 7. Reproduce

```bash
cd ml
python ears.py                 # if dengue_ears.xlsx is missing (after clean_dengue.py)
python -m spatial.run          # about 1.5 minutes
python -m spatial.report
python -m unittest discover -s tests
```

Inputs: `data/processed/dengue_cases_combined.xlsx`, `data/processed/dengue_ears.xlsx`,
`data/reference/geo/hdx_dengue_crosswalk.csv`, `web/public/geo/hdx-reporting-units.geojson`,
and for the swapped-back check the raw HDX file (hash-checked against `scripts/geo/sources.json`).
"""
    paths.REPORT.write_text(md, encoding="utf-8")
    print(f"-> {paths.REPORT.relative_to(paths.REPO)}, {FIG_MORAN}, {FIG_MAP}")


if __name__ == "__main__":
    main()
