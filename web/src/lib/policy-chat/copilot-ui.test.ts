import { describe, expect, it } from "vitest";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";
import { copilotSigiState, isCopilotUnavailable, referencedEvidence, suggestedQuestions } from "./copilot-ui";

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

describe("suggested questions", () => {
  it("adds a question only for topics the copilot has evidence for", () => {
    const qs = suggestedQuestions([record("pe-test-b", "budget_procurement_fiscal")], true);

    expect(qs.some((q) => q.includes("budget and procurement"))).toBe(true);
    expect(qs.some((q) => q.includes("reported outcomes"))).toBe(false);
  });

  it("does not refer to a signal when there is none", () => {
    expect(suggestedQuestions([], false).join(" ")).not.toMatch(/this signal/);
  });
});
