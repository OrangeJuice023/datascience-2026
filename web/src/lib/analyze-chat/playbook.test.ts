import { describe, expect, it } from "vitest";
import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { getAllPolicyEvidence } from "@/data/policy-evidence";
import { EXAMPLES, PLAYBOOK_VERSION, playbookPrompt } from "./playbook";

/**
 * The playbook teaches tone and reasoning; it must never carry facts. These
 * tests keep real places, real evidence ids and real numbers out of it, so the
 * model cannot repeat them as if they were evidence.
 */
describe("SIGI's playbook", () => {
  const text = playbookPrompt();

  it("names no real reporting unit", () => {
    for (const unit of ACCESS_REFERENCE.units) {
      expect(text.toLowerCase()).not.toContain(`${unit.id}-`);
    }
    expect(text).not.toMatch(/Quezon|Pasig|Davao|Bacolod|Manila/);
  });

  it("uses only placeholder ids in its examples, never a real evidence id", () => {
    for (const record of getAllPolicyEvidence()) expect(text).not.toContain(record.evidenceId);
    for (const e of EXAMPLES) {
      for (const [, id] of e.a.matchAll(/\[([^\]]+)\]/g)) {
        expect(id === "method-ears" || id === "access-medicines-dpri" || id.includes("<")).toBe(true);
      }
    }
  });

  it("carries no case counts or prices", () => {
    // Years and single digits (C1, C2, C3) are the only numbers allowed once the version stamp is set aside.
    const numbers = [...text.replace(`v${PLAYBOOK_VERSION}`, "").matchAll(/\d[\d,.]*\d|\d/g)].map((m) => m[0]);
    for (const n of numbers) expect(n).toMatch(/^(20\d\d|\d)$/);
  });
});
