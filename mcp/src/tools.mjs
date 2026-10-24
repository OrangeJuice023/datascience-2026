import { z } from "zod";

/**
 * The SIGMA API endpoints exposed as MCP tools. Read-only GETs only:
 * - left out: POST /chat (needs a server-side model key and costs per call)
 *   and /access/metrics (retired: no real source for stock or search data).
 *
 * Descriptions are written for the model that calls them: what the data is,
 * its time window, and what it must not be read as.
 */

const CAVEAT =
  "Hackathon prototype on historical data; not a validated public-health claim. Missing weeks are absent, never zero.";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const TOOLS = [
  {
    name: "sigma_health",
    title: "SIGMA API health",
    path: "/health",
    description: "Which SIGMA services are operating (dengue observations, EARS engine, ACCESS, policy copilot) and why any are disabled.",
    input: {},
  },
  {
    name: "sigma_sources",
    title: "SIGMA data sources",
    path: "/sources",
    description: "The source catalogue: every dataset SIGMA uses, its licence, status (connected / demo / planned) and what it can answer.",
    input: {},
  },
  {
    name: "dengue_signals",
    title: "EARS dengue signals",
    path: "/dengue/signals",
    description:
      "EARS C1/C2/C3 aberration results per Philippine dengue reporting unit and week (HDX DOH data, 2016-01-10 to 2021-01-03). " +
      "Default: the latest week (all 126 units). Give locationId for one unit's whole series, week for one week, or both. " +
      "An alarm prompts investigation; it does not confirm an outbreak. No record for a unit-week means no computable result, not 'no signal'. " +
      "The openSourceSignals block is simulated demo data. " + CAVEAT,
    input: {
      locationId: z.string().optional().describe("Reporting unit id, e.g. 'iloilo-city' (see dengue_units)."),
      week: isoDate.optional().describe("Week start (a Sunday), e.g. '2019-07-14'."),
    },
  },
  {
    name: "dengue_units",
    title: "Dengue reporting units by year",
    path: "/dengue/units",
    description:
      "The 126 HDX DOH dengue reporting units (provinces, province remainders, cities, Pateros) with, per epi year 2016-2020: reported cases over usable weeks, " +
      "EARS alarm weeks and DOH alert/epidemic-threshold weeks. A province remainder excludes its separately reported cities. Counts are not population-adjusted. " + CAVEAT,
    input: {
      unitId: z.string().optional().describe("One reporting unit id; omit for all 126."),
    },
  },
  {
    name: "dengue_observations",
    title: "National weekly dengue cases",
    path: "/dengue/observations",
    description: "Raw weekly national (Philippines) reported dengue cases from OpenDengue v1.3 (2012-12-30 to 2023-11-25). Observations, not a model output or forecast. " + CAVEAT,
    input: {
      from: isoDate.optional().describe("First week start to include."),
      to: isoDate.optional().describe("Last week start to include."),
      limit: z.number().int().positive().optional().describe("Maximum rows."),
    },
  },
  {
    name: "dengue_summary",
    title: "National dengue summary",
    path: "/dengue/summary",
    description: "Weekly, monthly and yearly aggregates of the national OpenDengue series, with gaps and completeness per epi year. " + CAVEAT,
    input: {
      limit: z.number().int().positive().optional().describe("Maximum weekly rows."),
    },
  },
  {
    name: "access_units",
    title: "Health facilities per reporting unit",
    path: "/access/units",
    description:
      "Mapped hospitals, clinics, pharmacies and laboratories per dengue reporting unit (OpenStreetMap snapshot via HOT/HDX, ODbL), with reported dengue cases. " +
      "A mapped facility is not proof that it is open, stocked or staffed. No stock data exists.",
    input: {
      unitId: z.string().optional().describe("One reporting unit id; omit for all."),
    },
  },
  {
    name: "access_medicines",
    title: "Dengue medicines and procurement prices",
    path: "/access/medicines",
    description: "Dengue-relevant medicines, their Philippine National Formulary status, and what DOH hospitals paid (2026 Drug Price Reference Index). Procurement prices, not retail prices.",
    input: {},
  },
  {
    name: "policy_info",
    title: "Policy evidence overview",
    path: "/policy/info",
    description: "Assessment areas, evidence summary, supported diseases and the AI disclosure for SIGMA's policy evidence pack.",
    input: {},
  },
  {
    name: "policy_evidence",
    title: "Policy evidence records",
    path: "/policy/evidence",
    description: "The curated policy-evidence research pack (national laws and memoranda, local issuances), filterable. Each record carries its verification status; not an official government position.",
    input: {
      locationId: z.string().optional().describe("Reporting unit or 'ph' for national records."),
      topic: z.string().optional().describe("Assessment area / topic id (see policy_info)."),
      verificationStatus: z.string().optional().describe("e.g. 'verified'."),
    },
  },
];

/** Text the model sees: provenance first, then the data as JSON. */
export function formatResult(tool, envelope) {
  const { meta, data } = envelope;
  const lines = [
    `SIGMA ${tool.path} - status: ${meta.status}; isSample: ${meta.isSample}; generated: ${meta.generatedAt ?? "n/a"}`,
  ];
  if (meta.status !== "live") lines.push(`Note: status is "${meta.status}", not live data. Do not present it as a finding.`);
  if (meta.isSample) lines.push("Note: isSample is true; part or all of this response is demo data and is labelled as such inside.");
  lines.push("", JSON.stringify(data, null, 2));
  return lines.join("\n");
}
