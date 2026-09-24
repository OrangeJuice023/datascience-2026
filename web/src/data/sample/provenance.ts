import type { Provenance, ProvenanceMethod } from "@/types/data";

/** Fixed write time for every DEMO / SAMPLE record, so renders stay deterministic. */
export const SAMPLE_RECORDED_AT = "2026-09-20T00:00:00Z";

/** Model reference for sample outputs. No model produced these values. */
export const SAMPLE_MODEL = { name: "sample-fixture", version: "0" } as const;

export function sampleProvenance(
  sourceIds: string[],
  method: ProvenanceMethod,
  extra?: Pick<Provenance, "pipeline" | "upstreamId" | "retrievedAt">,
): Provenance {
  return {
    sourceIds,
    method,
    ...extra,
    recordedAt: SAMPLE_RECORDED_AT,
    isSample: true,
  };
}
