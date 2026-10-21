import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";

export interface ValidationIssue {
  code: string;
  message: string;
  evidenceId?: string;
}

export function validateRegistry(records: PolicyEvidenceRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const r of records) {
    if (!r.evidenceId) {
      issues.push({ code: "missing_id", message: "evidence record missing evidenceId" });
      continue;
    }
    if (ids.has(r.evidenceId)) {
      issues.push({ code: "duplicate_id", message: `duplicate evidenceId: ${r.evidenceId}`, evidenceId: r.evidenceId });
    }
    ids.add(r.evidenceId);
    if (!r.claim) {
      issues.push({ code: "missing_claim", message: `claim is required`, evidenceId: r.evidenceId });
    }
    if (!r.sourceTitle) {
      issues.push({ code: "missing_source_title", message: `sourceTitle is required`, evidenceId: r.evidenceId });
    }
  }
  return issues;
}
