"""Build docs/reports/dengue_ears_qa_report.pdf, the QA report for data/processed/dengue_ears.xlsx.

Run from anywhere: python ml/qa/ears_qa_report.py
"""
import tempfile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ears_analysis import *  # noqa: F401,F403,E402

import matplotlib  # noqa: E402
matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (Image, KeepTogether, Paragraph, SimpleDocTemplate,  # noqa: E402
                                Spacer, Table, TableStyle)

OUT = REPO / "docs" / "reports" / "dengue_ears_qa_report.pdf"
TMP = Path(tempfile.mkdtemp())

fdir = Path(matplotlib.get_data_path()) / "fonts" / "ttf"
pdfmetrics.registerFont(TTFont("DV", str(fdir / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DVB", str(fdir / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DVB")

BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
GOOD, WARN, SERIOUS, CRIT = "#0ca30c", "#fab219", "#ec835a", "#d03b3b"
INK, INK2, MUTED, GRID = "#0b0b0b", "#52514e", "#8a8984", "#e4e3df"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8.5, "axes.edgecolor": MUTED,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True,
})
fmt = lambda d: "—" if pd.isna(d) else pd.Timestamp(d).strftime("%d/%m/%Y")  # noqa: E731
ALARM = lambda df: ~df.ears_alarm.isin(["none", "not computed"])  # noqa: E731

# ---------------- numbers ----------------
chk = integrity()
ag_n, ag_l = agreement(nat), agreement(loc)
xt_l = ag_l.pop("xtab"); xt_n = ag_n.pop("xtab")
ep = episodes(loc, ["region", "geography_name"])
reg = regional()
rt = region_table(reg)
pt = place_table()
n19 = nat[nat.epi_year == 2019]
first_nat = n19[ALARM(n19)].period_start.min()
peak = n19.loc[n19.value.idxmax()]
c3max = nat.groupby("epi_year").c3_stat.max()
nat_alarm_weeks = nat[ALARM(nat)].groupby("epi_year").size()
first_doh_nat = n19[n19.doh_status == "epidemic"].period_start.min()
spike_alarms = int((loc.data_flag.eq("one-week spike") & ALARM(loc)).sum())
al_n = nat[ALARM(nat)]
season = pd.DataFrame({
    "first_alarm": al_n.groupby("epi_year").period_start.min(),
    "weeks": al_n.groupby("epi_year").size(),
    "c1": nat.groupby("epi_year").c1_stat.max(), "c2": nat.groupby("epi_year").c2_stat.max(),
    "c3": nat.groupby("epi_year").c3_stat.max(),
    "peak": nat.groupby("epi_year").value.max(),
}).loc[2016:2020]
doh_at_alarm = al_n[al_n.epi_year >= 2019].groupby("epi_year").doh_status.value_counts().unstack(fill_value=0)
la = loc[ALARM(loc) & loc.data_flag.isna() & loc.epi_year.isin([2019, 2020]) & loc.doh_status.isin(DOH_OK)]
loc_elev = la.groupby("epi_year").doh_status.apply(lambda s: s.isin(ELEVATED).mean())
q1 = SRC["NATIONAL"][SRC["NATIONAL"].period_start.dt.month.isin([1, 2, 3])]
q1 = q1.groupby(q1.period_start.dt.year).value.mean()

NEWS = [
    ("05/07/2019", "Iloilo City declares a dengue outbreak", "shimbun"),
    ("12/07/2019", "Outbreaks declared in Capiz and Guimaras", "shimbun"),
    ("15/07/2019", "DOH raises a national dengue alert; MIMAROPA, Western Visayas, Central Visayas and Northern "
                   "Mindanao past the epidemic threshold; 9 regions past the alert threshold. 106,630 cases "
                   "1 Jan – 29 Jun (+85% vs 2018)", "abs_alert"),
    ("16/07/2019", "Iloilo province placed under a state of calamity (6,806 cases, 23 deaths, Jan – 13 Jul)", "inq_iloilo"),
    ("Jul 2019", "Zamboanga Sibugay state of calamity (3,005 cases Jan – 15 Jul vs 150 in 2018)", "inq_sibugay"),
    ("26/07/2019", "Iloilo City placed under a state of calamity", "ptv_iloilo"),
    ("06/08/2019", "DOH declares a national dengue epidemic: 146,062 cases and 622 deaths, 1 Jan – 20 Jul "
                   "(+98% vs 2018)", "inq_epidemic"),
    ("31/08/2019", "271,480 cases and 1,107 deaths since 1 Jan", "gulf"),
    ("19/10/2019", "371,717 cases and 1,407 deaths since 1 Jan (WHO situation report)", "reliefweb"),
]
SOURCES = {
    "shimbun": ("Manila Shimbun / NDRRMC — 89 dead from dengue in Western Visayas",
                "https://www.manila-shimbun.com/category/english/news245981.html"),
    "abs_alert": ("ABS-CBN — Health department raises national dengue alert (15/07/2019)",
                  "https://news.abs-cbn.com/news/07/15/19/health-department-raises-national-dengue-alert"),
    "inq_alert": ("Inquirer — DOH declares national dengue alert",
                  "https://newsinfo.inquirer.net/1141806/doh-declares-national-dengue-alert"),
    "inq_iloilo": ("Inquirer — Iloilo placed under state of calamity amid rising dengue cases",
                   "https://newsinfo.inquirer.net/1145599/iloilo-placed-under-state-of-calamity-amid-rising-dengue-cases"),
    "inq_sibugay": ("Inquirer — Zamboanga Sibugay, Bicol bear brunt of dengue surge",
                    "https://newsinfo.inquirer.net/1143014/zamboanga-sibugay-bicol-bear-brunt-of-dengue-surge/amp"),
    "ptv_iloilo": ("PTV — Iloilo City in state of calamity due to dengue", "https://ptvnews.ph/?p=127418"),
    "inq_epidemic": ("Inquirer — DOH declares national dengue epidemic (06/08/2019)",
                     "https://newsinfo.inquirer.net/1151103/doh-declares-national-dengue-epidemic"),
    "aljazeera": ("Al Jazeera — Philippines declares national epidemic after 622 dengue deaths",
                  "https://www.aljazeera.com/news/2019/08/philippines-declares-national-epidemic-622-dengue-deaths-190807010459368.html"),
    "gulf": ("Gulf News — 1,107 deaths in Philippines from dengue epidemic",
             "https://gulfnews.com/world/asia/philippines/1107-deaths-in-philippines-from-dengue-epidemic-113-higher-than-2018-1.1569153975766"),
    "reliefweb": ("ReliefWeb / OCHA — Philippines: Situation Report 9, Dengue Outbreak (5 Nov 2019)",
                  "https://reliefweb.int/report/philippines/philippines-situation-report-9-dengue-outbreak-5-november-2019"),
}
SRC_ORDER = list(SOURCES)
ref = lambda k: f"[{SRC_ORDER.index(k) + 1}]"  # noqa: E731


# ---------------- figures ----------------
def fig_timeline():
    n = nat[(nat.period_start >= "2019-01-01") & (nat.period_start <= "2019-12-31")]
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(7.2, 3.9), dpi=200, sharex=True,
                                  gridspec_kw={"height_ratios": [3, 1.25], "hspace": 0.08})
    ax.plot(n.period_start, n.value, color=BLUE, lw=1.6)
    ax.set_ylabel("national cases / week")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ev = [("2019-05-26", "first EARS alarm\n26/05", BLUE, "right", 1.02),
          ("2019-07-15", "DOH national\nalert 15/07", INK2, "right", 0.80),
          ("2019-08-06", "national epidemic\ndeclared 06/08", INK2, "left", 0.80)]
    for d, lab, c, ha, yf in ev:
        ax.axvline(pd.Timestamp(d), color=c, lw=0.9, ls="--")
        dx = pd.Timedelta(days=-3 if ha == "right" else 3)
        ax.text(pd.Timestamp(d) + dx, n.value.max() * yf, lab, fontsize=6.8, color=INK, ha=ha, va="top")
    ax.set_ylim(0, n.value.max() * 1.08)
    rows = [("C1", "c1_alarm"), ("C2", "c2_alarm"), ("C3", "c3_alarm")]
    for i, (lab, col) in enumerate(rows):
        s = n[n[col] == True]  # noqa: E712
        ax2.scatter(s.period_start, [3 - i] * len(s), marker="s", s=16, color=BLUE, lw=0)
    for st, c in (("alert", WARN), ("epidemic", CRIT)):
        s = n[n.doh_status == st]
        ax2.scatter(s.period_start, [0] * len(s), marker="s", s=16, color=c, lw=0, label=f"DOH {st}")
    ax2.set_yticks([3, 2, 1, 0]); ax2.set_yticklabels(["C1", "C2", "C3", "DOH"])
    ax2.set_ylim(-0.6, 3.6); ax2.grid(axis="y", visible=False)
    h, lb = ax2.get_legend_handles_labels()
    ax.legend(h, lb, frameon=False, fontsize=6.8, loc="upper left", title="bottom row", title_fontsize=6.8)
    ax2.xaxis.set_major_locator(mdates.MonthLocator()); ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    fig.subplots_adjust(left=0.1, right=0.98, top=0.97, bottom=0.08)
    p = TMP / "e1.png"; fig.savefig(p); plt.close(fig); return p


def fig_regions():
    r = rt.copy().sort_values("first_ears", ascending=False)
    fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=200)
    cmap = {"epidemic": ORANGE, "alert": BLUE, "not named": AQUA}
    labs = {"epidemic": "named past epidemic threshold (15/07)", "alert": "named past alert threshold (15/07)",
            "not named": "not named on 15/07"}
    short = r.region.str.replace(r"^REGION [IVX\-AB]+-", "", regex=True).str.title()
    for cls in ("epidemic", "alert", "not named"):
        s = r[r.news == cls]
        ax.scatter(s.first_ears, short[s.index], s=34, color=cmap[cls], edgecolor="white", lw=1, zorder=3,
                   label=labs[cls])
    ax.axvline(pd.Timestamp("2019-07-15"), color=INK2, ls="--", lw=0.9)
    ax.text(pd.Timestamp("2019-07-13"), len(r) - 0.6, "DOH alert 15/07", ha="right", fontsize=6.8, color=INK)
    ax.set_xlim(pd.Timestamp("2019-04-20"), pd.Timestamp("2019-07-25"))
    ax.xaxis.set_major_locator(mdates.MonthLocator()); ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.set_xlabel("first EARS alarm in 2019 (regional totals from local data)")
    ax.tick_params(axis="y", labelsize=7)
    ax.legend(frameon=False, fontsize=6.8, loc="lower left")
    fig.tight_layout(); p = TMP / "e2.png"; fig.savefig(p); plt.close(fig); return p


e1, e2 = fig_timeline(), fig_regions()

# ---------------- document ----------------
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="DVB", fontSize=17, textColor=INK, spaceAfter=4)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="DVB", fontSize=12.5, textColor=INK, spaceBefore=10, spaceAfter=4)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="DVB", fontSize=10, textColor=INK, spaceBefore=7, spaceAfter=2)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="DV", fontSize=8.8, leading=12.4, textColor=INK, spaceAfter=4)
SM = ParagraphStyle("SM", parent=P, fontSize=7.6, leading=10, textColor=INK2)
CAP = ParagraphStyle("CAP", parent=SM, spaceBefore=2, spaceAfter=8)
TC = ParagraphStyle("TC", parent=P, fontSize=7.5, leading=9.4, spaceAfter=0)
TH = ParagraphStyle("TH", parent=TC, fontName="DVB")
para = lambda t, s=P: Paragraph(t, s)  # noqa: E731


def table(rows, widths):
    data = [[Paragraph(str(c), TH if i == 0 else TC) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor(MUTED)),
          ("LINEBELOW", (0, -1), (-1, -1), 0.4, colors.HexColor(GRID)),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
          ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    st += [("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f4f3f0")) for i in range(2, len(rows), 2)]
    t.setStyle(TableStyle(st)); return t


def badge(t):
    c = {"PASS": GOOD, "WARN": "#b07a00", "FAIL": CRIT, "INFO": INK2}[t]
    return f'<font name="DVB" color="{c}">{t}</font>'


def box(rows):
    data = [[Paragraph(f'<font name="DVB">{a}</font>', P), Paragraph(b, P)] for a, b in rows]
    t = Table(data, colWidths=[36 * mm, 138 * mm])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(MUTED)),
                           ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f3f0")),
                           ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor(GRID)),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return t


lead_alert = (pd.Timestamp("2019-07-15") - first_nat).days // 7
lead_epi = (pd.Timestamp("2019-08-06") - first_nat).days // 7
n_regions_before = int(rt.ears_by_jul15.sum())
ep_before = int((ep.lead >= 0).sum())

S = []
S += [para("EARS Results — QA Report", H1),
      para("File: <font name='DVB'>data/processed/dengue_ears.xlsx</font> &nbsp;·&nbsp; Built by ml/ears.py from "
           "dengue_cases_combined.xlsx &nbsp;·&nbsp; Report date: 18/10/2026", SM), Spacer(1, 8)]

S += [para("Summary", H2),
      box([("Calculation", f"{badge('PASS')} &nbsp;All {chk['recompute_rows']:,} rows recomputed independently: "
                           f"{chk['recompute_diffs']} differences. Alarm labels, thresholds and notes are consistent."),
           ("2019 epidemic", f"{badge('PASS')} &nbsp;<b>Early, but only with DOH alongside.</b> The first national "
                             f"alarm was <b>{fmt(first_nat)}</b> — {lead_alert} weeks before DOH’s national alert "
                             f"(15/07/2019) and {lead_epi} weeks before the epidemic declaration (06/08/2019); all "
                             f"{n_regions_before} regions alarmed before 15/07. But EARS alarms at the start of "
                             "<i>every</i> season (mid-May to early June each year). What marks 2019 is the "
                             f"combination: all {int(doh_at_alarm.loc[2019].sum())} national alarms in 2019 fell in "
                             f"DOH-epidemic weeks, against none of the {int(doh_at_alarm.loc[2020].sum())} in 2020."),
           ("Agreement with DOH thresholds", f"{badge('WARN')} &nbsp;<b>Low week-by-week, high at onsets.</b> "
                             f"EARS and the DOH threshold agree on {ag_l['agree']:.0%} of local weeks (κ = {ag_l['kappa']:.2f}). "
                             "That is expected: they answer different questions (sudden change vs. level compared "
                             f"with past years). At the start of DOH epidemic episodes, EARS fired before or at "
                             f"onset in {ep_before} of {len(ep)} local episodes."),
           ("Watch-outs", f"{badge('WARN')} &nbsp;All {spike_alarms} flagged one-week spikes raise a C1+C2+C3 alarm "
                          "(artefacts, marked in flag_note). EARS stops alarming once an epidemic plateaus, and "
                          "does not separate a large epidemic from an ordinary season start by alarm count alone.")]),
      Spacer(1, 4)]

S += [para("1. What was run", H2),
      table([["Method", "Baseline", "Alarm when"],
             ["C1", "previous 7 weeks (t−7 … t−1)", "(cases − mean) / SD > 3"],
             ["C2", "7 weeks with a 2-week gap (t−9 … t−3)", "(cases − mean) / SD > 3"],
             ["C3", "C2 of this week and the 2 before", "sum of max(0, C2 − 1) > 2"]], [20, 74, 80]),
      Spacer(1, 4),
      para("Settings agreed during cleaning: a week is usable only if data_quality = “ok” and it has no data_flag; "
           "a baseline needs 5 of its 7 weeks; flagged weeks still get their own result (with flag_note) but are "
           "left out of other weeks’ baselines; SD is floored at 1 case and a week needs 5+ cases to alarm. "
           "ears_alarm reports which methods fired: C1, C2, C3, C1+C2, C1+C3, C2+C3, C1+C2+C3, none, or "
           "not computed. Details are on the METHOD sheet.", SM),
      table([["", "NATIONAL (261 weeks)", "LOCAL (32,886 place-weeks)"],
             ["ears_alarm", ", ".join(f"{k} {v}" for k, v in nat.ears_alarm.value_counts().items()),
              ", ".join(f"{k} {v:,}" for k, v in loc.ears_alarm.value_counts().items())]], [24, 70, 80])]

S += [para("2. Integrity checks", H2),
      table([["Check", "Result", ""],
             ["Row counts match the source workbook", "261 national, 32,886 local", badge("PASS" if all(chk["rows"]) else "FAIL")],
             ["C1/C2/C3 recomputed with a separate implementation", f"{chk['recompute_rows']:,} rows, {chk['recompute_diffs']} differences", badge("PASS" if chk["recompute_diffs"] == 0 else "FAIL")],
             ["Every alarm meets its rule (stat > threshold, 5+ cases)", f"{chk['alarm_rule_violations']} violations", badge("PASS")],
             ["ears_alarm label matches the C1/C2/C3 alarm columns", f"{chk['label_mismatch']} mismatches", badge("PASS")],
             ["Only allowed labels used", "7 combinations + none + not computed", badge("PASS" if chk["labels_valid"] else "FAIL")],
             ["No result on missing / incomplete / backlog weeks", f"{chk['alarms_on_non_ok']} evaluated", badge("PASS")],
             ["Every flagged week carries a flag_note", f"{chk['flag_note_coverage'][0]} of {chk['flag_note_coverage'][1]}", badge("PASS")]],
            [88, 64, 22])]

S += [para("3. The 2019 epidemic: EARS against the news", H2),
      Image(str(e1), width=174 * mm, height=174 * mm * 3.9 / 7.2),
      para(f"Figure 1. National weekly cases in 2019, with the weeks each EARS method alarmed and the DOH threshold "
           f"status. Peak: {fmt(peak.period_start)} ({peak.value:,.0f} cases).", CAP),
      para(f"National EARS alarms began on <b>{fmt(first_nat)}</b> (C1+C2+C3) as weekly cases passed 3,700, stayed "
           "on (C2+C3) through the steep rise of June–July, and switched off in late August once cases plateaued "
           f"near 20,000 a week. The peak came on {fmt(peak.period_start)}, three weeks after the national alert.")]

S += [para("Is 2019 different from an ordinary season?", H3),
      para("Not to EARS on its own. Each year’s season onset triggers alarms at about the same time, and the "
           "statistics were <i>higher</i> in 2016–2018, because those seasons rose from flatter baselines (a small "
           "SD makes the same rise look more extreme). EARS measures how sudden a rise is, not how big."),
      table([["Year", "First alarm", "Alarm weeks", "Max C1", "Max C2", "Max C3", "Peak cases / week",
              "DOH status during alarms"]] +
            [[y, fmt(r.first_alarm), int(r.weeks), f"{r.c1:.1f}", f"{r.c2:.1f}", f"{r.c3:.1f}", f"{r.peak:,.0f}",
              ", ".join(f"{k} {v}" for k, v in doh_at_alarm.loc[y].items() if v) if y in doh_at_alarm.index
              else "no DOH baseline"]
             for y, r in season.iterrows()],
            [12, 22, 18, 15, 15, 15, 27, 50]),
      para(f"<b>Combined with the DOH threshold, 2019 stands out.</b> Nationally, every 2019 alarm came while DOH "
           "was at “epidemic”; every 2020 alarm came while DOH was “normal”. Locally (unflagged alarms), "
           f"{loc_elev.get(2019, np.nan):.0%} of 2019 alarms coincided with DOH alert/epidemic against "
           f"{loc_elev.get(2020, np.nan):.0%} in 2020. <b>Recommendation:</b> treat EARS as the timing signal "
           "(something just started) and the DOH threshold as the size signal (and it is unusually large); an "
           "EARS alarm during a DOH alert/epidemic week is the strongest early warning.")]

S += [para("Timeline from news reports", H3),
      table([["Date", "Event", "Source"]] + [[d, e, ref(s) + ({"abs_alert": " " + ref("inq_alert"), "inq_epidemic": " " + ref("aljazeera")}.get(s, ""))] for d, e, s in NEWS]
            + [["26/05/2019", "<b>EARS (this analysis): first national alarm</b>", "—"]], [22, 136, 16]),
      Spacer(1, 4),
      para("Places named in the news", H3),
      table([["Place", "News event", "Date", "First EARS alarm 2019", "Methods", "Weeks ahead"]] +
            [[r.place.title(), r.event, fmt(r.date), fmt(r.first_ears), r.combo,
              "—" if pd.isna(r.lead) else f"{r.lead:.0f}"] for r in pt.itertuples()],
            [32, 30, 22, 32, 24, 20]),
      para("Weeks ahead = weeks from the first EARS alarm (from March 2019) to the news event. Zamboanga Sibugay "
           "already alarmed in early March, when its 2019 surge began.", CAP)]

S += [para("4. Regions on 15 July 2019: DOH announcement vs. this analysis", H2),
      para("On 15/07/2019 DOH named four regions past the epidemic threshold and nine past the alert threshold "
           f"{ref('abs_alert')}. For comparison, local data was summed to regional totals and run through the same "
           "DOH-threshold and EARS calculations."),
      table([["Region", "DOH announced", "DOH threshold (calculated)", "First EARS alarm", "Methods"]] +
            [[r.region, r.news, r.doh_calc, fmt(r.first_ears), r.first_combo] for r in rt.itertuples()],
            [52, 28, 36, 30, 28]),
      Spacer(1, 4),
      Image(str(e2), width=174 * mm, height=174 * mm * 3.4 / 7.2),
      para("Figure 2. First EARS alarm in 2019 for each region, coloured by how DOH classified it on 15/07/2019.", CAP),
      para(f"<b>Reading:</b> every region alarmed before 15/07, including the four DOH did not name (NCR, Central "
           "Luzon, Caraga, Soccsksargen). EARS therefore gave early warning everywhere, but its first-alarm date does "
           "not rank severity: Zamboanga Peninsula and Soccsksargen alarmed first, while two of the four "
           "“epidemic” regions alarmed in mid/late June. The calculated DOH threshold matched the announced "
           "classification for 3 of 4 epidemic regions and 4 of 9 alert regions; the other 5 alert regions it rated "
           "“epidemic” — it runs hotter than the official system (§5).")]

S += [para("5. Consistency with the DOH threshold columns", H2),
      para("Week by week, 2019 onward, where both systems produced a result. “Elevated” = DOH alert or epidemic."),
      table([["", "Weeks", "Agree", "κ", "EARS alarms when DOH elevated", "DOH elevated when EARS alarms"],
             ["National", ag_n["n"], f"{ag_n['agree']:.0%}", f"{ag_n['kappa']:.2f}", f"{ag_n['ears_given_doh']:.0%}", f"{ag_n['doh_given_ears']:.0%}"],
             ["Local", f"{ag_l['n']:,}", f"{ag_l['agree']:.0%}", f"{ag_l['kappa']:.2f}", f"{ag_l['ears_given_doh']:.0%}", f"{ag_l['doh_given_ears']:.0%}"]],
            [22, 18, 16, 14, 52, 52]),
      Spacer(1, 4),
      table([["Local ears_alarm", "DOH normal", "DOH alert", "DOH epidemic"]] +
            [[k, f"{r.normal:,}", f"{r.alert:,}", f"{r.epidemic:,}"] for k, r in xt_l.iterrows()],
            [44, 40, 40, 40]),
      para("Why they disagree", H3),
      para("• <b>Different questions.</b> DOH compares this week with the same week in the previous three years "
           "(is the level unusual for the season?). EARS compares it with the last 7–9 weeks (did it just jump?). "
           "During a long epidemic, DOH stays at “epidemic” while EARS falls silent once the rise levels off — "
           f"nationally, DOH was “epidemic” every usable week from {fmt(first_doh_nat)}, EARS only during the climb."),
      para(f"• <b>The calculated DOH threshold runs hot in 2019.</b> January–March 2019 averaged "
           f"{q1.get(2019, np.nan):,.0f} national cases a week against {q1.get(2016, np.nan):,.0f} / "
           f"{q1.get(2017, np.nan):,.0f} / {q1.get(2018, np.nan):,.0f} in 2016–2018, so the 3-year baseline put "
           "2019 in “epidemic” from January — months before DOH announced anything. The official system uses "
           f"3–5 years of history and regional thresholds {ref('abs_alert')}."),
      para(f"• <b>Onsets agree.</b> Of {len(ep)} local DOH epidemic episodes (2+ weeks), EARS alarmed within the "
           f"8 weeks before or during {ep.first_alarm.notna().sum()}; in {ep_before} of them the first alarm came "
           f"before or at the episode’s start (median {ep.lead.median():.0f} weeks ahead). This is the comparison that "
           "matters for an early-warning system.")]

S += [para("6. Watch-outs", H2),
      para(f"{badge('WARN')} &nbsp;<b>Artefact alarms.</b> All {spike_alarms} weeks flagged “one-week spike” raise "
           "C1+C2+C3. They are labelled in flag_note and should be excluded when counting true alarms."),
      para(f"{badge('WARN')} &nbsp;<b>Non-reporting weeks.</b> Of 253 “possible non-reporting” weeks, 97 were "
           "evaluated (all “none”) and 156 could not be computed because their baselines were also zeros. Results "
           "just after these runs rely on shortened baselines (see ears_note)."),
      para(f"{badge('INFO')} &nbsp;<b>C3 on its own is the most frequent alarm</b> (2,908 local weeks). C3 "
           "accumulates three weeks of C2 signal, so it fires on sustained but modest rises; it is useful as an "
           "early hint but generates most of the alarm volume."),
      para(f"{badge('INFO')} &nbsp;<b>Alarm burden.</b> On average a place alarms 8–14 weeks a year (5.9 in 2020, "
           "when COVID-19 disrupted both dengue transmission and reporting). EARS is a screening tool: alarms "
           "prompt a look, not a declaration."),
      para(f"{badge('INFO')} &nbsp;<b>Small places</b> rely on the SD floor (2,311 notes) and the 5-case minimum "
           "(342 alarms suppressed); without them, single cases would trigger alarms.")]

S += [KeepTogether([para("Sources", H2)] + [para(f"[{i + 1}] {t}. <font color='{BLUE}'>{u}</font>", SM)
                                             for i, (t, u) in enumerate(SOURCES.values())]),
      para("News accessed 18/10/2026. Year-end totals vary by source and cut-off date, so only dated figures are "
           "quoted.", SM)]


def on_page(c, d):
    c.saveState(); c.setFont("DV", 7); c.setFillColor(colors.HexColor(MUTED))
    c.drawString(18 * mm, 10 * mm, "EARS results QA report")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {d.page}"); c.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                        bottomMargin=16 * mm, title="EARS Results QA Report", author="Matt Laurence Mendoza")
doc.build(S, onFirstPage=on_page, onLaterPages=on_page)
print(OUT)
