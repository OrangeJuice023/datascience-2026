import "server-only";

import { dataProvider } from "@/data/opendengue-provider";
import { getAllPolicyEvidence } from "@/data/policy-evidence";
import { getLguById } from "@/data/demo-lgus";
import { accessUnit, accessUnitForLgu } from "@/lib/access/reference";
import { summarizeNational } from "@/lib/national-observations";
import { readSigmaData } from "@/lib/sigma/summary";
import { buildEvidencePack, type EvidencePack, type PackUnit } from "./evidence";

/**
 * Resolves a copilot location to a dengue reporting unit. Accepts a unit id
 * (any of the 126) or one of the app's LGU ids ("pasig" → "pasig-city").
 * Returns null for a known LGU that is not reported on its own (Antipolo is
 * inside Rizal), and undefined for an unknown id.
 */
export function resolveChatUnit(locationId: string): { unitId: string; name: string } | null | undefined {
  const unit = accessUnit(locationId) ?? accessUnitForLgu(locationId);
  if (unit) return { unitId: unit.id, name: unit.name };
  return getLguById(locationId) ? null : undefined;
}

function packUnit(locationId: string): PackUnit {
  const resolved = resolveChatUnit(locationId);
  return {
    unitId: resolved?.unitId ?? locationId,
    unitName: resolved?.name ?? getLguById(locationId)?.name ?? locationId,
    accessUnit: resolved ? accessUnit(resolved.unitId) : undefined,
    // A place with no reporting unit gets no unit-level evidence, never another unit's.
    hasUnitData: Boolean(resolved),
  };
}

/** The evidence for this request's place, rebuilt on every request, with an optional second place. */
export async function loadEvidencePack(locationId: string, compareLocationId?: string): Promise<EvidencePack> {
  const [sigma, national] = await Promise.all([
    readSigmaData(),
    dataProvider
      .getHealthObservations("dengue", "ph")
      .then(summarizeNational)
      .catch(() => null),
  ]);
  const primary = packUnit(locationId);
  return buildEvidencePack({
    unitId: primary.unitId,
    unitName: primary.unitName,
    accessUnit: primary.accessUnit,
    hasUnitData: primary.hasUnitData,
    sigma,
    national,
    policyRecords: getAllPolicyEvidence(),
    compare: compareLocationId ? packUnit(compareLocationId) : null,
  });
}
