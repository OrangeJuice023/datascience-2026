import { describe, expect, it } from "vitest";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";
import {
  HISTORY_BYTE_BUDGET,
  copilotSigiState,
  historyForRequest,
  isCopilotUnavailable,
  linkServerCitations,
  referencedEvidence,
  suggestedQuestionGroups,
} from "./copilot-ui";

function record(evidenceId: string, topic: PolicyEvidenceRecord["topic"], sourceIds: string[] = []): PolicyEvidenceRecord {
  return {
    evidenceId,
    researchPackId: "test",
    researchPackVersion: "0",
    locationId: "test-lgu",
    entityName: "Test LGU",
    geographicLevel: "city",
    topic,
    claim: "Test claim",
    sourceTitle: "Test source",
    issuingOrganization: "Test org",
    sourceUrl: null,
    sourceRef: null,
    publicationDate: null,
    referencePeriod: null,
    dateReviewed: "2026-01-01",
    evidenceType: "test",
    verificationStatus: "verified",
    verifiedWhat: [],
    unverifiedWhat: [],
    limitations: [],
    caveats: [],
    unresolvedQuestions: [],
    notes: [],
    relationToSurveillancePeriod: "unknown",
    financialStage: null,
    amount: null,
    sourceIds,
  };
}

describe("Sigi in the copilot", () => {
  const base = { sending: false, errorCode: null, draft: "", hasReply: false };

  it("waits, listens, then thinks only while a request is in flight", () => {
    expect(copilotSigiState(base)).toBe("idle");
    expect(copilotSigiState({ ...base, draft: "  hello " })).toBe("listening");
    expect(copilotSigiState({ ...base, draft: "hello", sending: true })).toBe("thinking");
  });

  it("shows a result only once a real reply came back", () => {
    expect(copilotSigiState({ ...base, hasReply: true })).toBe("insight");
  });

  it("distinguishes a switched-off copilot from a failure", () => {
    expect(copilotSigiState({ ...base, errorCode: "not_configured" })).toBe("unavailable");
    expect(copilotSigiState({ ...base, errorCode: "upstream_unavailable" })).toBe("error");
    expect(isCopilotUnavailable("not_configured")).toBe(true);
    expect(isCopilotUnavailable("rate_limited")).toBe(false);
    expect(isCopilotUnavailable(null)).toBe(false);
  });
});

describe("evidence referenced by a reply", () => {
  const records = [record("pe-test-a", "reported_outcomes", ["S-001"]), record("pe-test-b", "budget_procurement_fiscal")];

  it("matches records by evidence id or source id", () => {
    expect(referencedEvidence("See pe-test-b for the plan.", records).map((r) => r.evidenceId)).toEqual(["pe-test-b"]);
    expect(referencedEvidence("Reported in (S-001).", records).map((r) => r.evidenceId)).toEqual(["pe-test-a"]);
  });

  it("never invents a citation the model was not given", () => {
    expect(referencedEvidence("According to pe-other-lgu and S-999…", records)).toEqual([]);
  });
});

describe("server citations in a reply", () => {
  const citations = [{ id: "lab-quezon-city-2019" }, { id: "pe-national-lgc-1991" }];

  it("numbers only the ids the server verified, consuming the brackets around them", () => {
    const { text, cited } = linkServerCitations("Rose [lab-quezon-city-2019]; mandate [pe-national-lgc-1991].", citations);
    expect(text).toBe("Rose [1](#cite-lab-quezon-city-2019); mandate [2](#cite-pe-national-lgc-1991).");
    expect(cited.map((c) => c.id)).toEqual(["lab-quezon-city-2019", "pe-national-lgc-1991"]);
  });

  it("never turns an id the server did not verify into a link", () => {
    const { text, cited } = linkServerCitations("Pasig too [lab-pasig-city-2019], see pe-made-up-1.", citations);
    expect(cited).toEqual([]);
    expect(text).not.toContain("#cite-");
  });
});

describe("suggested questions", () => {
  const full = { place: "Test City", hasLab: true, hasAccess: true, hasLocalPolicy: true };

  it("groups questions by what the evidence can answer", () => {
    expect(suggestedQuestionGroups(full).map((g) => g.label)).toEqual([
      "Understand the data",
      "Investigate signals",
      "Explore access",
      "Connect evidence",
    ]);
  });

  it("drops groups whose evidence is missing and never promises a local policy that is not held", () => {
    const bare = suggestedQuestionGroups({ ...full, hasLab: false, hasAccess: false, hasLocalPolicy: false });
    expect(bare.map((g) => g.label)).toEqual(["Connect evidence"]);
    expect(bare[0].questions.join(" ")).not.toMatch(/local/);
  });

  it("never offers live counts, stock or forecasts", () => {
    const text = suggestedQuestionGroups(full)
      .flatMap((g) => g.questions)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/current|today|this week|in stock|available now|forecast|predict/);
  });
});
