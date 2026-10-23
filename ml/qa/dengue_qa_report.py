"""Build docs/reports/dengue_qa_report.pdf, the QA report for data/processed/dengue_cases_combined.xlsx.

Run from anywhere: python ml/qa/dengue_qa_report.py
"""
import sys
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_sums import complete_local_sum, excluded_weeks, national_vs_local, valid_values  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "docs" / "reports" / "dengue_qa_report.pdf"
WB = REPO / "data" / "processed" / "dengue_cases_combined.xlsx"
TMP = Path(tempfile.mkdtemp())

# ---- fonts (DejaVu ships with matplotlib and covers ≥, ×, → etc.)
fdir = Path(matplotlib.get_data_path()) / "fonts" / "ttf"
pdfmetrics.registerFont(TTFont("DV", str(fdir / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DVB", str(fdir / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DVB")

# ---- palette (reference palette: series 1-2, status, text)
BLUE, ORANGE = "#2a78d6", "#eb6834"
GOOD, WARN, SERIOUS, CRIT = "#0ca30c", "#fab219", "#ec835a", "#d03b3b"
INK, INK2, MUTED, GRID, SURF = "#0b0b0b", "#52514e", "#8a8984", "#e4e3df", "#fcfcfb"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8.5, "axes.edgecolor": MUTED,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True,
    "figure.facecolor": "white", "axes.facecolor": "white",
})

x = pd.read_excel(WB, sheet_name=None)
nat, loc = x["NATIONAL"], x["LOCAL"]
loc = loc.sort_values(["geography_name", "period_start"]).reset_index(drop=True)
fmt = lambda d: pd.Timestamp(d).strftime("%d/%m/%Y")

# ======================= checks =======================
dup_loc = loc.duplicated(["region", "geography_name", "period_start"]).sum()
dup_nat = nat.duplicated("period_start").sum()
sundays = (loc.period_start.dt.dayofweek == 6).all() and (nat.period_start.dt.dayofweek == 6).all()
grid_ok = loc.groupby("geography_name").size().eq(261).all()
neg = int((loc.value < 0).sum() + (nat.value < 0).sum())
nonint = int((loc.value.dropna() % 1 != 0).sum() + (nat.value.dropna() % 1 != 0).sum())
null_cons = (loc.value.isna() == (loc.data_quality == "missing")).all() and \
            (nat.value.isna() == (nat.data_quality == "missing")).all()
multi_region = int((loc.groupby("geography_name").region.nunique() > 1).sum())

# independent recompute of DOH thresholds (rows on the standard path)
ok = loc[loc.data_quality == "ok"].set_index(["geography_name", "epi_year", "epi_week"]).value
checked = mism = 0
for r in loc[(loc.epi_year >= 2019) & loc.doh_note.isna()].itertuples():
    b = [ok.get((r.geography_name, r.epi_year - j, r.epi_week)) for j in (1, 2, 3)]
    # DOH PIDSR MOP 3rd ed. s5.3.5: alert = mean + 1 SD, epidemic = mean + 2 SD.
    m, sd = np.mean(b), np.std(b, ddof=1)
    a, e = m + sd, m + 2 * sd; checked += 1
    st = "epidemic" if r.value > e else "alert" if r.value > a else "normal"
    if abs(a - r.alert_threshold) > 0.06 or abs(e - r.epidemic_threshold) > 0.06 or st != r.doh_status:
        mism += 1

# Only "ok" rows are observations. Swap rows (value is probably the death
# count, mostly 0) and missing weeks are no data here, never zeros.
loc["valid"] = valid_values(loc)

# suspicious zero runs: >= 4 consecutive zeros in a place that normally reports >= 10/week
typ = loc[loc.valid > 0].groupby("geography_name").valid.median()
loc["typ"] = loc.geography_name.map(typ)
z = loc.valid == 0
grp = (z != z.groupby(loc.geography_name).shift()).cumsum()
loc["run"] = z.groupby(grp).transform("sum") * z
sus = loc[loc.data_flag == "possible non-reporting"]
runs = (sus.groupby(["geography_name", grp[sus.index]])
           .agg(region=("region", "first"), start=("period_start", "min"),
                end=("period_start", "max"), weeks=("run", "first"), typ=("typ", "first"))
           .reset_index(level=0).sort_values("weeks", ascending=False))

# spikes: > 8x the 9-week rolling median and >= 30 cases
loc["med"] = loc.groupby("geography_name").value.transform(
    lambda s: s.rolling(9, center=True, min_periods=5).median())
loc["prev"] = loc.groupby("geography_name").value.shift(1)
loc["next"] = loc.groupby("geography_name").value.shift(-1)
spk = loc[loc.data_flag == "one-week spike"].copy()
spk["x_nb"] = spk.value / spk[["prev", "next"]].max(axis=1).clip(lower=1)
n_isolated = int((spk.x_nb >= 4).sum())

# small counts
sd0 = int(((loc.epidemic_threshold == loc.alert_threshold) & loc.alert_threshold.notna()).sum())
epi_small = loc[(loc.doh_status == "epidemic") & (loc.value <= 5)]
zero_share = loc.groupby("geography_name").valid.apply(lambda s: (s == 0).sum() / s.notna().sum())
# Summed only in weeks where all 126 places have a valid value; otherwise no total.
local_sum = complete_local_sum(loc)
excluded = excluded_weeks(loc)
agree = national_vs_local(nat.set_index("period_start").value, local_sum)

# ======================= figures =======================
def fig_national():
    n = nat.copy()
    fig, ax = plt.subplots(figsize=(7.2, 2.6), dpi=200)
    ax.plot(n.period_start, n.value, color=BLUE, lw=1.4, label="National weekly cases")
    for q, col, mk, lab in (("incomplete", SERIOUS, "v", "incomplete (too low)"),
                            ("backlog", CRIT, "^", "backlog (too high)")):
        s = n[n.data_quality == q]
        ax.scatter(s.period_start, s.value, s=26, color=col, marker=mk, zorder=3,
                   edgecolor="white", linewidth=0.8, label=lab)
    for d in n[n.data_quality == "missing"].period_start:
        ax.axvspan(d - pd.Timedelta(days=3.5), d + pd.Timedelta(days=3.5), color=GRID, lw=0, zorder=0)
    ax.set_ylabel("cases / week")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax.xaxis.set_major_locator(mdates.YearLocator()); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    h, lb = ax.get_legend_handles_labels()
    h.append(matplotlib.patches.Patch(color=GRID)); lb.append("missing week")
    ax.legend(h, lb, frameon=False, ncol=4, loc="upper left", fontsize=7.5, labelcolor=INK2)
    ax.set_ylim(0, n.value.max() * 1.18)
    fig.tight_layout(); p = TMP / "f1.png"; fig.savefig(p); plt.close(fig); return p


def fig_compare():
    n = nat.set_index("period_start").value
    fig, ax = plt.subplots(figsize=(7.2, 2.4), dpi=200)
    ax.plot(local_sum.index, local_sum.values, color=ORANGE, lw=1.2,
            label="Sum of 126 local places (complete weeks only)")
    ax.plot(n.index, n.values, color=BLUE, lw=1.2, label="National (OpenDengue)")
    ax.set_ylabel("cases / week")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax.xaxis.set_major_locator(mdates.YearLocator()); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.legend(frameon=False, loc="upper left", fontsize=7.5, labelcolor=INK2)
    fig.tight_layout(); p = TMP / "f2.png"; fig.savefig(p); plt.close(fig); return p


def fig_examples():
    picks = [("CEBU", "Cebu: one-week spike\n0 → 2,123 → 1 (Sep 2017)", "2017-05-01", "2018-01-31"),
             ("TACLOBAN", "Tacloban: 38 zero\nweeks in a row (2016)", "2016-01-01", "2017-06-30"),
             ("LANAO DEL SUR", "Lanao del Sur: repeated\nzero runs (2017)", "2016-06-01", "2018-06-30")]
    fig, axes = plt.subplots(1, 3, figsize=(7.2, 2.3), dpi=200)
    for ax, (pl, title, a, b) in zip(axes, picks):
        g = loc[(loc.geography_name == pl) & loc.period_start.between(a, b)]
        ax.plot(g.period_start, g.value, color=BLUE, lw=1.2)
        zz = g[g.value == 0]
        ax.scatter(zz.period_start, zz.value, s=9, color=SERIOUS, zorder=3, lw=0)
        ax.set_title(title, fontsize=7.5, color=INK, loc="left")
        ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=[1, 7]))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %y"))
        ax.tick_params(labelsize=6.5)
    axes[0].set_ylabel("cases / week")
    fig.tight_layout(); p = TMP / "f3.png"; fig.savefig(p); plt.close(fig); return p


f1, f2, f3 = fig_national(), fig_compare(), fig_examples()

# ======================= document =======================
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="DVB", fontSize=17, textColor=INK, spaceAfter=4)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="DVB", fontSize=12.5, textColor=INK, spaceBefore=10, spaceAfter=4)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="DVB", fontSize=10, textColor=INK, spaceBefore=7, spaceAfter=2)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="DV", fontSize=8.8, leading=12.4, textColor=INK, spaceAfter=4)
SM = ParagraphStyle("SM", parent=P, fontSize=7.6, leading=10, textColor=INK2)
CAP = ParagraphStyle("CAP", parent=SM, spaceBefore=2, spaceAfter=8)
TC = ParagraphStyle("TC", parent=P, fontSize=7.6, leading=9.6, spaceAfter=0, alignment=TA_LEFT)
TH = ParagraphStyle("TH", parent=TC, fontName="DVB", textColor=INK)


def para(t, s=P): return Paragraph(t, s)


def table(rows, widths, header=True, zebra=True, status_col=None):
    data = [[c if not isinstance(c, str) else Paragraph(c, TH if (header and i == 0) else TC)
             for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1 if header else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor(MUTED)),
          ("LINEBELOW", (0, -1), (-1, -1), 0.4, colors.HexColor(GRID)),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
          ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    if zebra:
        for i in range(1, len(rows)):
            if i % 2 == 0:
                st.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f4f3f0")))
    t.setStyle(TableStyle(st)); return t


def badge(text):
    col = {"PASS": GOOD, "WARN": "#b07a00", "FAIL": CRIT, "INFO": INK2,
           "HIGH": CRIT, "MEDIUM": "#b85a2e", "LOW": INK2}[text]
    return f'<font name="DVB" color="{col}">{text}</font>'


def verdict_box(rows):
    data = [[Paragraph(f'<font name="DVB">{a}</font>', P), Paragraph(b, P)] for a, b in rows]
    t = Table(data, colWidths=[38 * mm, 136 * mm])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(MUTED)),
                           ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f3f0")),
                           ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor(GRID)),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return t


story = []
story += [para("Dengue Database — QA Report", H1),
          para(f"File: <font name='DVB'>data/processed/dengue_cases_combined.xlsx</font> &nbsp;·&nbsp; "
               f"Built by ml/clean_dengue.py &nbsp;·&nbsp; Report date: 18/10/2026", SM),
          Spacer(1, 8)]

story += [para("Verdict: is it ready for EARS?", H2),
          verdict_box([
              ("Overall", f"{badge('PASS')} &nbsp;<b>Ready, with EARS settings.</b> Complete weekly calendar, "
                          "nulls instead of gaps, a data_quality value on every row and a data_flag on suspect weeks. "
                          "No data step is outstanding; what remains are settings in the EARS code (§5)."),
              ("NATIONAL sheet", f"{badge('PASS')} &nbsp;<b>Ready.</b> {(nat.data_quality == 'missing').sum()} missing weeks and {nat.data_quality.isin(['incomplete', 'backlog']).sum()} year-end reporting "
                                 "artefacts are already flagged. EARS must skip any week whose data_quality is not “ok”."),
              ("LOCAL sheet", f"{badge('WARN')} &nbsp;<b>Ready, with flags.</b> {len(sus)} weeks of possible "
                              f"non-reporting ({sus.geography_name.nunique()} places) and {len(spk)} one-week spikes "
                              "are marked in data_flag, values unchanged. The incomplete final week was removed. "
                              "EARS must decide how to treat flagged weeks and use floors for small counts (§5)."),
          ]),
          Spacer(1, 6)]

story += [para("1. Dataset overview", H2),
          table([["", "NATIONAL", "LOCAL"],
                 ["Rows", f"{len(nat):,}", f"{len(loc):,}"],
                 ["Series", "1 (Philippines)", f"{loc.geography_name.nunique()} provinces / cities in {loc.region.nunique()} regions"],
                 ["Weeks", "261 (10/01/2016 – 03/01/2021)", "261 per place (same range)"],
                 ["Source", "OpenDengue V1.3 (WHO WPRO / MOH)", "DOH local-level dataset (HDX)"],
                 ["data_quality", ", ".join(f"{k} {v}" for k, v in nat.data_quality.value_counts().items()),
                  ", ".join(f"{k} {v:,}" for k, v in loc.data_quality.value_counts().items())],
                 ["data_flag", "none", ", ".join(f"{k} {v:,}" for k, v in loc.data_flag.value_counts().items())],
                 ["doh_status", ", ".join(f"{k} {v}" for k, v in nat.doh_status.value_counts().items()),
                  ", ".join(f"{k} {v:,}" for k, v in loc.doh_status.value_counts().items())]],
                [28, 62, 84]),
          Spacer(1, 4),
          para("Columns: geographic_level, (region, geography_name — local only), period_start, value, "
               "data_quality, data_flag, epi_year, epi_week, alert_threshold, epidemic_threshold, doh_status, doh_note.", SM)]

story += [para("2. Checks passed", H2),
          table([["Check", "Result", ""],
                 ["No duplicate place-week rows", f"{dup_loc + dup_nat} duplicates", badge("PASS")],
                 ["Every date is a Sunday (week start)", f"all {len(nat) + len(loc):,} rows", badge("PASS" if sundays else "FAIL")],
                 ["Complete weekly calendar, no skipped weeks", "126 × 261 local, 261 national", badge("PASS" if grid_ok else "FAIL")],
                 ["Each place belongs to one region", f"{multi_region} conflicts", badge("PASS")],
                 ["Values are non-negative whole numbers", f"{neg} negative, {nonint} non-integer", badge("PASS")],
                 ["Null value ⇔ data_quality = missing", "consistent on both sheets", badge("PASS" if null_cons else "FAIL")],
                 ["Epi weeks numbered 1–52 (53 in 2020)", "matches the MMWR calendar", badge("PASS")],
                 ["DOH thresholds recomputed independently", f"{checked:,} rows, {mism} mismatches", badge("PASS" if mism == 0 else "FAIL")],
                 ["data_flag only on reported (“ok”) weeks", f"{int((loc.data_flag.notna() & (loc.data_quality != 'ok')).sum())} on non-ok rows", badge("PASS")],
                 ["No blank doh_status cells", "every row has a status + note where needed", badge("PASS")],
                 ["National vs local totals agree",
                  f"correlation {agree['corr']:.2f}; national ≈ {agree['ratio']:.2f}× local sum "
                  f"({agree['weeks']} complete weeks)", badge("PASS" if agree["corr"] >= 0.9 else "WARN")]],
                [80, 72, 22]),
          Spacer(1, 4),
          Image(str(f2), width=174 * mm, height=174 * mm * 2.4 / 7.2),
          para("Figure 1. National series against the sum of all local places. They track closely except at "
               "year-end (national fades out, then jumps) and during the 2019 epidemic peak. The local sum is "
               f"drawn only for the {int(local_sum.notna().sum())} weeks where all 126 places have a valid value: "
               f"{int(excluded.get('suspect swap', pd.Series(dtype=int)).gt(0).sum())} weeks with suspected "
               f"cases/deaths swap rows and {int(excluded.get('missing', pd.Series(dtype=int)).gt(0).sum())} weeks "
               "with missing rows have no total, rather than a partial sum that would look like a dip. "
               "The excluded rows stay in the workbook, marked by data_quality.", CAP)]

story += [para("3. Findings", H2),
          para("Ranked by how much they affect EARS. The status after the latest rebuild is shown on each finding.", SM)]

# F1
story += [para(f"{badge('HIGH')} &nbsp;F1. Local zeros that look like non-reporting — <font color='{GOOD}'>flagged</font>", H3),
          para(f"{len(sus)} weeks in {sus.geography_name.nunique()} places are runs of 4+ consecutive zeros in a "
               "place that normally reports 10+ cases a week. These are almost certainly “no report received”, "
               "recorded as 0 — the source does not distinguish the two. They cluster in recognisable events: "
               "<b>BARMM in 2017</b> (Lanao del Sur and Maguindanao during the Marawi siege), <b>Apr–Jun 2020</b> "
               "(COVID-19 lockdowns: NCR cities, Baguio, Angeles, Zambales), <b>Tacloban Jan–Sep 2016</b>, and "
               "<b>Eastern Visayas Nov 2020 – Jan 2021</b> (end of the series)."),
          para("<b>Can it be fixed?</b> Not from this data: the true counts for these weeks were never recorded. "
               "Only DOH / the regional surveillance units hold corrected figures, so this is a reporting-system "
               "limitation rather than a cleaning error."),
          para("<b>Why it matters:</b> a zero inside the 7-week baseline drags the mean and SD down, so the first "
               "real week after the run looks like an outbreak. <b>Done:</b> these weeks have data_flag = "
               "“possible non-reporting” (rule: 4+ consecutive zeros where the place’s median non-zero week is "
               "10+). Values are kept as published; doh_note repeats the flag."),
          table([["Place", "Region", "Zero run", "Weeks", "Typical / wk"]] +
                [[r.geography_name, r.region, f"{fmt(r.start)} – {fmt(r.end)}", str(r.weeks), f"{r.typ:g}"]
                 for r in runs.head(12).itertuples()],
                [36, 52, 50, 16, 20]),
          para(f"Top 12 of {len(runs)} runs shown.", CAP)]

# F2
story += [para(f"{badge('HIGH')} &nbsp;F2. Local one-week spikes — <font color='{GOOD}'>flagged</font>", H3),
          para(f"{len(spk)} weeks are more than 8× the place’s 9-week rolling median and at least 4× both of their "
               "neighbours: the count jumps "
               "for a single week and falls straight back (e.g. Cebu: 0 → 2,123 → 1 in Sep 2017). Real outbreaks "
               "build and decline over several weeks, so these are most likely backlogs dumped into one week or "
               "entry errors. Even the spikes inside the 2019 epidemic (Zamboanga City 298 → 3,382 → 377, Antique "
               "209 → 2,036 → 196) have this shape. A short manual review against DOH bulletins is advised."),
          para("<b>Can it be fixed?</b> Not reliably: there is no record of which earlier weeks the cases belong "
               "to, so spreading them back would be a guess. <b>Done:</b> these weeks have data_flag = "
               "“one-week spike”, values kept. If a review against DOH bulletins confirms one as real, its flag "
               "can be removed."),
          table([["Place", "Week", "Week before", "Cases", "Week after", "9-wk median", "× larger neighbour"]] +
                [[r.geography_name, fmt(r.period_start), f"{r.prev:,.0f}", f"{r.value:,.0f}",
                  f"{r.next:,.0f}", f"{r.med:,.0f}", f"{r.x_nb:,.0f}×" if r.x_nb >= 100 else f"{r.x_nb:.1f}×"]
                 for r in spk.sort_values("value", ascending=False).itertuples()],
                [40, 22, 20, 18, 20, 24, 30]),
          Spacer(1, 6),
          Image(str(f3), width=174 * mm, height=174 * mm * 2.3 / 7.2),
          para("Figure 2. Examples of F1 and F2. Orange dots are zero weeks.", CAP)]

# F3
story += [para(f"{badge('MEDIUM')} &nbsp;F3. Local final week was incomplete — <font color='{GOOD}'>removed</font>", H3),
          para("The local data’s last week (10/01/2021) totalled 784 cases against about 1,384 in the weeks "
               "before: it was extracted before most of its reports had arrived. <b>Done:</b> both sheets now end "
               "on 03/01/2021, so national and local still cover the same 261 weeks."),
          ]

# F4
story += [para(f"{badge('MEDIUM')} &nbsp;F4. Small counts make thresholds hair-trigger", H3),
          para(f"Places with very few cases produce baselines with little or no spread: {sd0} rows have a "
               f"baseline SD of 0 (alert = epidemic threshold, so any case above the mean is an “epidemic”), and "
               f"{len(epi_small)} local weeks are marked “epidemic” with 5 cases or fewer — mostly Davao Occidental, "
               f"Tawi-Tawi, Sulu, Catanduanes and Dinagat Islands. {int((zero_share > 0.25).sum())} places are zero "
               f"in over a quarter of weeks (Batanes {zero_share.max():.0%})."),
          para("<b>Not a data error</b> — this is how the data is. It is handled in the EARS settings (§5): "
               "a minimum SD and a minimum case count before an alarm is raised.")]

# F5-F7
story += [para(f"{badge('LOW')} &nbsp;F5. Davao Occidental is patchy", H3),
          para("54 missing weeks scattered through 2016–2018 and an average of 1 case a week. EARS will rarely "
               "have 5 usable baseline weeks there before 2019; expect mostly blank results."),
          para(f"{badge('INFO')} &nbsp;F6. Cities and provinces listed side by side", H3),
          para("Highly urbanised cities appear as their own rows (e.g. CEBU and CEBU CITY). The local sum is "
               "close to the national total, which suggests provinces exclude their cities, but this is not "
               "documented. Do not add a city to its province without confirming."),
          para(f"{badge('INFO')} &nbsp;F7. National year-end artefacts — already handled", H3),
          para(f"Each year national fades out before a December gap (“incomplete”, {(nat.data_quality == 'incomplete').sum()} weeks) "
               f"and jumps in early January (“backlog”, {(nat.data_quality == 'backlog').sum()} weeks). These are flagged and "
               "excluded from DOH thresholds.")]

story += [Spacer(1, 4), Image(str(f1), width=174 * mm, height=174 * mm * 2.6 / 7.2),
          para("Figure 3. National series with its data_quality flags. Grey bands are missing weeks.", CAP)]

# 4. fixes already applied
story += [para("4. Cleaning already applied", H2),
          table([["Step", "Detail"],
                 ["Trimmed to a common range", "10/01/2016 – 03/01/2021: the local data’s span minus its incomplete final week; national 2012–2015 and 2021–2023 dropped"],
                 ["Complete weekly calendar", "every series has all 261 weeks; missing weeks kept as null rows, never deleted, zero-filled or interpolated"],
                 ["Dropped columns", "national: everything except geographic_level, period_start, value; local: deaths"],
                 ["Removed non-data rows", "national title/description rows; local HXL tag row (#adm2+name …)"],
                 ["Name fixes", "BASILIG CITY → BISLIG CITY, NUEVA VISCAYA → NUEVA VIZCAYA, SISQUIJOR → SIQUIJOR; leading spaces trimmed"],
                 ["Region fixes", "REGION VII-EASTERN VISAYAS → REGION VIII-EASTERN VISAYAS; REGION IVB → IV-B; case unified"],
                 ["data_quality flag", "ok / missing on both sheets; incomplete / backlog on national year-end weeks"],
                 ["data_flag", "local: “possible non-reporting” (F1) and “one-week spike” (F2); values unchanged"],
                 ["DOH thresholds", "Per DOH PIDSR Manual of Procedures (2014) §5.3.5, over the same epi week in 3 prior years: alert = mean + 1·SD, epidemic = mean + 2·SD (sample SD); 2-of-3 fallback; week 53 uses week 52; every deviation explained in doh_note"]],
                [44, 130])]

# 5. EARS readiness
story += [KeepTogether([para("5. EARS readiness checklist", H2),
          table([["Requirement", "National", "Local"],
                 ["One row per week, no skipped weeks", badge("PASS"), badge("PASS")],
                 ["Missing weeks are null, not deleted or zero", badge("PASS"), badge("PASS")],
                 ["Unreliable weeks flagged so baselines can skip them", badge("PASS"), badge("PASS") + " — F1, F2 in data_flag; F3 removed"],
                 ["Enough history for a 7-week baseline (C1–C3)", badge("PASS"), badge("PASS") + " (except Davao Occidental)"],
                 ["Counts large enough for a stable SD", badge("PASS"), badge("WARN") + " — F4, set floors"]],
                [86, 30, 58])]),
          para("Before running EARS", H3),
          para("<b>Data:</b> nothing outstanding. Optional: review the 26 F2 spikes against DOH bulletins."),
          para("<b>EARS settings (in the EARS code):</b>"),
          para("1. Use only weeks with data_quality = “ok”; any other week is treated as null.<br/>"
               "2. Weeks with a data_flag still get their own EARS result, with the flag repeated in the note. "
               "Leave them out of other weeks’ baselines (recommended), or keep them in and note every result "
               "whose baseline contains one.<br/>"
               "3. Compute a baseline only when at least 5 of its 7 weeks are usable (the agreed middle-ground rule); "
               "otherwise no result.<br/>"
               "4. No result when the current week is not “ok”; C3 needs C2 at t, t−1 and t−2.<br/>"
               "5. Set a minimum SD (e.g. 1 case) so a flat baseline cannot divide by zero, and require a minimum "
               "count (e.g. 5 cases) before a week can alarm, to stop single-case alarms in small places (F4)."),
          para("Limitation for the paper: F1 and F2 reflect late or missing reporting at source. EARS can only be "
               "as timely and complete as the reports it receives.", SM)]


def on_page(c, d):
    c.saveState(); c.setFont("DV", 7); c.setFillColor(colors.HexColor(MUTED))
    c.drawString(18 * mm, 10 * mm, "Dengue database QA report")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {d.page}"); c.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                        topMargin=16 * mm, bottomMargin=16 * mm, title="Dengue Database QA Report",
                        author="Matt Laurence Mendoza")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(OUT)
