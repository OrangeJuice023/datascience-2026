import type { DengueUnitRecord, DengueUnitsData } from '@sigma/contracts';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { fetchDengueUnits } from '@/api/endpoints';
import { DEFAULT_UNIT_ID } from '@/components/units';
import { useResource, type Resource } from '@/hooks/use-resource';
import { useSettings } from '@/state/settings-context';

/**
 * The 126 HDX dengue reporting units (GET /dengue/units) and the one the
 * reader is looking at.
 *
 * The list is loaded once per API address and shared, so Explore and the
 * three Analyze views show the same unit: picking Iloilo City in Explore and
 * opening ACCESS shows Iloilo City's facilities. The ids are the ones ACCESS
 * and the SIGI chat take as `unitId` / `locationId`.
 */

interface UnitsContextValue {
  resource: Resource<DengueUnitsData>;
  units: DengueUnitRecord[];
  /** Null until the list has loaded. */
  selectedUnit: DengueUnitRecord | null;
  selectUnit: (id: string) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const { baseUrl } = useSettings();
  const resource = useResource((signal) => fetchDengueUnits(baseUrl, {}, signal), [baseUrl]);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_UNIT_ID);

  const units = useMemo(() => resource.data?.units ?? [], [resource.data]);
  const selectedUnit = useMemo(
    () =>
      units.find((unit) => unit.id === selectedId) ??
      units.find((unit) => unit.id === DEFAULT_UNIT_ID) ??
      units[0] ??
      null,
    [units, selectedId]
  );
  const selectUnit = useCallback((id: string) => setSelectedId(id), []);

  const value = useMemo<UnitsContextValue>(
    () => ({ resource, units, selectedUnit, selectUnit }),
    [resource, units, selectedUnit, selectUnit]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const context = useContext(UnitsContext);
  if (!context) throw new Error('useUnits must be used inside a UnitsProvider.');
  return context;
}
