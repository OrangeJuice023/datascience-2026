import type { AccessFacilityType, AccessMedicineRecord } from '@sigma/contracts';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchAccessMedicines, fetchAccessUnits } from '@/api/endpoints';
import { formatCount, formatPeso } from '@/components/format';
import { Banner, Card, Disclosure, ErrorState, FactRow, LoadingState, SectionTitle, StatusPill } from '@/components/ui';
import { UnitPicker } from '@/components/unit-picker';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';

const FACILITY_ORDER: { type: AccessFacilityType; label: string }[] = [
  { type: 'hospital', label: 'Hospitals' },
  { type: 'clinic', label: 'Clinics and primary care' },
  { type: 'pharmacy', label: 'Pharmacies' },
  { type: 'laboratory', label: 'Laboratories' },
];

/**
 * ACCESS for one reporting unit: the hospitals, clinics, pharmacies and
 * laboratories mapped in OpenStreetMap (GET /access/units), and what DOH
 * hospitals paid for dengue medicines (GET /access/medicines). Medicine stock
 * has no public source, so it is shown as unknown, never estimated.
 */
export function useAccessData(baseUrl: string, unitId: string | null) {
  const units = useResource(
    (signal) =>
      unitId ? fetchAccessUnits(baseUrl, { unitId }, signal) : Promise.reject(new Error('No reporting unit selected.')),
    [baseUrl, unitId]
  );
  const medicines = useResource((signal) => fetchAccessMedicines(baseUrl, signal), [baseUrl]);
  // Until the unit list has loaded there is no unit to ask about; the picker shows that state.
  return { units, medicines, ready: unitId !== null };
}

export type AccessData = ReturnType<typeof useAccessData>;

export function AccessPanel({ data }: { data: AccessData }) {
  const theme = useTheme();
  const { units, medicines, ready } = data;
  const unit = ready ? (units.data?.units[0] ?? null) : null;
  const attribution = [...new Set((units.data?.sources ?? []).map((s) => (s.snapshot ? `${s.attribution} (snapshot ${s.snapshot})` : s.attribution)))];

  return (
    <>
      <UnitPicker />

      {ready && units.loading && !units.data ? <LoadingState label="Loading mapped facilities…" /> : null}
      {ready && units.error && !units.data ? <ErrorState message={units.error.message} onRetry={units.reload} /> : null}

      {unit ? (
        <Card>
          <SectionTitle>Mapped care in {unit.name}</SectionTitle>
          {FACILITY_ORDER.map(({ type, label }) => {
            const density = unit.mappedPer100SqKm?.[type];
            return (
              <FactRow
                key={type}
                label={label}
                value={
                  density === undefined
                    ? formatCount(unit.mappedFacilities[type])
                    : `${formatCount(unit.mappedFacilities[type])} · ${formatCount(density)} per 100 km²`
                }
              />
            );
          })}
          {unit.areaSqKm !== null ? <FactRow label="Land area" value={`${formatCount(unit.areaSqKm)} km²`} /> : null}
          <FactRow label="Medicine stock" value="Unknown" tone="notConnected" />
          <FactRow label="Population" value="Not in the dataset" tone="notConnected" />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Counts are places mapped in OpenStreetMap. A low count can mean low mapping, not low access. No public
            source reports whether a medicine is in stock at a pharmacy or health centre, so SIGMA does not show it.
          </Text>
          {attribution.length > 0 ? (
            <Text style={[styles.note, { color: theme.textSecondary }]}>Facilities: {attribution.join('; ')}.</Text>
          ) : null}
        </Card>
      ) : null}

      {ready && units.data ? (
        <Disclosure title="What ACCESS cannot tell you" summary="Limits of the facility and price data">
          {[...units.data.scope.doesNotSupport, ...units.data.scope.limitations].map((line) => (
            <Text key={line} style={[styles.note, { color: theme.textSecondary }]}>
              • {line}
            </Text>
          ))}
        </Disclosure>
      ) : null}

      {medicines.loading && !medicines.data ? <LoadingState label="Loading medicine prices…" /> : null}
      {medicines.error && !medicines.data ? (
        <ErrorState message={medicines.error.message} onRetry={medicines.reload} />
      ) : null}

      {medicines.data ? (
        <>
          <Banner tone="caution" title="Procurement prices, not shelf prices">
            {medicines.data.scope.priceBasis} They are national figures, the same for every unit, and say nothing
            about stock.
          </Banner>
          <Card>
            <SectionTitle>Dengue medicine prices</SectionTitle>
            {medicines.data.medicines.map((medicine) => (
              <MedicineRow key={medicine.id} medicine={medicine} />
            ))}
            {medicines.data.sources.map((source) => (
              <Text key={source.id} style={[styles.note, { color: theme.textSecondary }]}>
                Source: {source.title}
                {source.edition ? `, ${source.edition}` : ''} ({source.publisher}).
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

function MedicineRow({ medicine }: { medicine: AccessMedicineRecord }) {
  const theme = useTheme();
  return (
    <View style={[styles.medicine, { borderTopColor: theme.border }]}>
      <View style={styles.medicineHeader}>
        <Text style={[styles.medicineName, { color: theme.text }]}>{medicine.name}</Text>
        <StatusPill
          status={medicine.onPnfEml ? 'live' : 'not_connected'}
          label={medicine.onPnfEml ? 'PNF essential list' : 'Not on PNF list'}
        />
      </View>
      <Text style={[styles.note, { color: theme.textSecondary }]}>{medicine.role}</Text>
      {medicine.prices.map((price) => (
        <View key={price.item} style={styles.price}>
          <Text style={[styles.priceItem, { color: theme.text }]}>{price.item}</Text>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {price.status === 'priced' && price.medianPhp !== null
              ? `Median ${formatPeso(price.medianPhp)}${
                  price.lowestPhp !== null && price.highestPhp !== null
                    ? ` · range ${formatPeso(price.lowestPhp)}–${formatPeso(price.highestPhp)}`
                    : ''
                }${price.reportingFacilities !== null ? ` · ${formatCount(price.reportingFacilities)} hospitals` : ''}`
              : `No public price (${price.status})`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  medicine: {
    gap: 4,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  medicineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  medicineName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  price: {
    gap: 1,
    paddingTop: Spacing.one,
  },
  priceItem: {
    fontSize: 14,
    lineHeight: 19,
  },
});
