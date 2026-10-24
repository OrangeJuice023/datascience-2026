import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchSummary } from '@/api/endpoints';
import { BOUNDARIES_ATTRIBUTION } from '@/api/geo';
import {
  binWeeks,
  caseRadius,
  countClasses,
  LAYER_LABEL,
  UNIT_YEARS,
  unitValue,
  unitWeeksPerYear,
  WEEK_BINS,
  WEEK_CUTS,
  weekBinLabels,
  type MapLayer,
  type WeekBin,
} from '@/components/dashboard-data';
import { DashboardScreen, DashCard, LegendRow, Select, SelectRow } from '@/components/dashboard';
import { formatCount, formatIsoDate } from '@/components/format';
import { NationalTrendCard } from '@/components/national-trend';
import { Card, Disclosure, ErrorState, FactRow, LinkRow, LoadingState, SectionTitle } from '@/components/ui';
import { UnitMap, MapCaption } from '@/components/unit-map';
import { UnitPicker } from '@/components/unit-picker';
import { UnitYearTable } from '@/components/unit-year-table';
import { regionLabel, unitTypeLabel } from '@/components/units';
import { Spacing } from '@/constants/theme';
import { useBoundaries } from '@/hooks/use-boundaries';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

/**
 * Explore: the 126 reporting units on a map (Map) and one unit's record by
 * epi year next to the national series (Trends).
 *
 * The map shows, per unit and for the chosen years, how many weeks EARS
 * alarmed or the DOH threshold was crossed (a coloured point), or how many
 * cases were reported (a sized point). Polygons are neutral: counts are never
 * filled into areas, and a unit with no computable result is drawn hollow.
 */

type View_ = 'map' | 'trends';
type YearKey = 'all' | `${(typeof UNIT_YEARS)[number]}`;

const YEAR_OPTIONS: { value: YearKey; label: string }[] = [
  { value: 'all', label: 'All years' },
  ...UNIT_YEARS.map((y) => ({ value: String(y) as YearKey, label: String(y) })),
];

const LAYER_OPTIONS: { value: MapLayer; label: string; hint: string }[] = [
  { value: 'ears', label: LAYER_LABEL.ears, hint: 'Weeks a year with an EARS C1, C2 or C3 alarm' },
  { value: 'doh', label: LAYER_LABEL.doh, hint: 'Weeks a year above the DOH alert or epidemic threshold (from 2019)' },
  { value: 'cases', label: LAYER_LABEL.cases, hint: 'Reported cases over usable weeks; not population-adjusted' },
];

export default function ExploreScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();
  const { resource: units, selectedUnit, selectUnit } = useUnits();
  const [view, setView] = useState<View_>('map');
  const [layer, setLayer] = useState<MapLayer>('ears');
  const [yearKey, setYearKey] = useState<YearKey>('all');
  const [picking, setPicking] = useState(false);
  const [mapSelection, setMapSelection] = useState<string | null>(null);

  const boundaries = useBoundaries(baseUrl);
  const summary = useResource((signal) => fetchSummary(baseUrl, undefined, signal), [baseUrl]);

  const years = useMemo(() => (yearKey === 'all' ? [...UNIT_YEARS] : [Number(yearKey)]), [yearKey]);
  const binColor = useMemo<Record<WeekBin, string>>(
    () => ({ zero: theme.signalNone, low: theme.signalC1, mid: theme.signalC2, high: theme.signalC3, no_result: theme.noResult }),
    [theme]
  );

  const { markers, counts, maxCases } = useMemo(() => {
    const list = units.data?.units ?? [];
    const values = list.map((u) => ({ id: u.id, v: unitValue(u, layer, years) }));
    if (layer === 'cases') {
      const max = Math.max(0, ...values.map((x) => x.v ?? 0));
      return {
        markers: values.map((x) => ({ id: x.id, color: theme.brand, radius: x.v === null ? 3 : caseRadius(x.v, max, 13), hollow: x.v === null })),
        counts: null,
        maxCases: max,
      };
    }
    const bins = list.map((u) => ({ id: u.id, bin: binWeeks(unitWeeksPerYear(u, layer, years), WEEK_CUTS[layer]) }));
    return {
      markers: bins.map((b) => ({ id: b.id, color: binColor[b.bin], radius: 5, hollow: b.bin === 'no_result' })),
      counts: countClasses(bins.map((b) => b.bin), WEEK_BINS),
      maxCases: 0,
    };
  }, [units.data, layer, years, theme.brand, binColor]);

  const focused = units.data?.units.find((u) => u.id === (mapSelection ?? selectedUnit?.id)) ?? null;
  const focusedValue = focused ? unitValue(focused, layer, years) : null;
  const focusedPerYear = focused && layer !== 'cases' ? unitWeeksPerYear(focused, layer, years) : null;
  const yearText = yearKey === 'all' ? `${UNIT_YEARS[0]}–${UNIT_YEARS[UNIT_YEARS.length - 1]}` : yearKey;

  const choose = (id: string) => {
    setMapSelection(id);
    selectUnit(id);
  };

  const legend =
    layer === 'cases' ? (
      <View style={{ gap: 2 }}>
        <Text style={[styles.legendTitle, { color: theme.text }]}>Reported cases</Text>
        <Text style={[styles.legendNote, { color: theme.textSecondary }]}>Largest dot: {formatCount(maxCases)}</Text>
        <LegendRow color={theme.noResult} label="No usable weeks" hollow />
      </View>
    ) : counts ? (
      <View style={{ gap: 1 }}>
        <Text style={[styles.legendTitle, { color: theme.text }]}>{layer === 'ears' ? 'EARS alarm weeks' : 'Weeks over DOH threshold'}</Text>
        {WEEK_BINS.map((b) => (
          <LegendRow key={b} color={binColor[b]} label={weekBinLabels(WEEK_CUTS[layer])[b]} count={counts[b]} hollow={b === 'no_result'} />
        ))}
      </View>
    ) : null;

  const scope = units.data?.scope;
  const staleError = (units.stale ? units.error?.message : null) ?? (summary.stale ? summary.error?.message : null);

  return (
    <DashboardScreen
      title="Explore"
      subtitle={`Dengue patterns across ${scope ? scope.units : 126} reporting units.`}
      onRefresh={() => {
        units.reload();
        summary.reload();
        boundaries.reload();
      }}
      refreshing={units.refreshing || summary.refreshing}
      staleError={staleError}>
      <ViewToggle value={view} onChange={setView} />

      {view === 'map' ? (
        <>
          <SelectRow>
            <Select label="Map layer" value={layer} options={LAYER_OPTIONS} onChange={setLayer} />
            <Select label="Years" value={yearKey} options={YEAR_OPTIONS} onChange={setYearKey} />
          </SelectRow>

          {(boundaries.loading && !boundaries.data) || (units.loading && !units.data) ? <LoadingState label="Loading the map…" /> : null}
          {boundaries.error && !boundaries.data ? <ErrorState message={boundaries.error.message} onRetry={boundaries.reload} /> : null}
          {units.error && !units.data ? <ErrorState message={units.error.message} onRetry={units.reload} /> : null}
          {boundaries.data && units.data ? (
            <UnitMap map={boundaries.data} markers={markers} selectedId={focused?.id} onSelect={choose} height={520} legend={legend} />
          ) : null}

          <MapCaption>
            Historical records · {yearText}.{' '}
            {layer === 'cases'
              ? 'Dot area is reported cases, not population-adjusted; a city is not riskier because its dot is bigger.'
              : 'Signal status relative to each area’s own history: it prompts investigation and does not confirm an outbreak.'}
            {layer === 'doh' ? ' DOH thresholds need three prior years, so 2016–2018 have no result.' : ''} Points sit at
            each unit’s label position, not where cases occurred. {BOUNDARIES_ATTRIBUTION}.
          </MapCaption>

          <Pressable
            accessibilityRole="button"
            onPress={() => setPicking(true)}
            style={({ pressed }) => [styles.picker, { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
            <MaterialCommunityIcons name="map-marker-radius" size={34} color={theme.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>{focused ? focused.name : 'Select a reporting unit'}</Text>
              <Text style={[styles.caption, { color: theme.textSecondary }]}>
                {focused
                  ? `${unitTypeLabel(focused.unitType)}, ${regionLabel(focused.regionId)}`
                  : 'Choose a province, province remainder, or city.'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={26} color={theme.text} />
          </Pressable>

          {focused ? (
            <DashCard title={`${focused.name}, ${yearText}`} onPress={() => setView('trends')}>
              <FactRow
                label={LAYER_LABEL[layer]}
                value={
                  focusedValue === null
                    ? 'No result'
                    : layer === 'cases'
                      ? formatCount(focusedValue)
                      : `${focusedValue} week${focusedValue === 1 ? '' : 's'} (${focusedPerYear?.toFixed(1)} a year)`
                }
              />
              <Text style={[styles.caption, { color: theme.textSecondary }]}>Tap to see this unit by year in Trends.</Text>
            </DashCard>
          ) : null}
        </>
      ) : (
        <>
          <UnitPicker />
          {selectedUnit && scope ? (
            <Card>
              <SectionTitle>{selectedUnit.name} by epi year</SectionTitle>
              <Text style={[styles.caption, { color: theme.textSecondary }]}>
                {unitTypeLabel(selectedUnit.unitType)}, {regionLabel(selectedUnit.regionId)}. Weekly reports{' '}
                {formatIsoDate(scope.period.from)} – {formatIsoDate(scope.period.to)}, {scope.source}.
              </Text>
              <UnitYearTable years={selectedUnit.years} />
              <Text style={[styles.caption, { color: theme.textSecondary }]}>
                Cases are summed over usable weeks only, so a year with unusable weeks is not an annual total. An EARS alarm
                or a week above a DOH threshold is a prompt to check the data, not a confirmed outbreak.
              </Text>
              <LinkRow
                title={`Ask SIGI about ${selectedUnit.name}`}
                description="Analyze · Policy, with the sources for every answer."
                onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'policy' } })}
              />
              <LinkRow
                title="Care and medicines here"
                description="Analyze · ACCESS: mapped facilities and DOH medicine prices."
                onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'access' } })}
              />
            </Card>
          ) : null}
          {scope ? (
            <Disclosure title="How these counts work" summary="Weeks, EARS, DOH thresholds and the assumptions behind them">
              {scope.notes.map((note) => (
                <Text key={note} style={[styles.caption, { color: theme.textSecondary }]}>
                  • {note}
                </Text>
              ))}
            </Disclosure>
          ) : null}
          {summary.loading && !summary.data ? <LoadingState label="Loading the national series…" /> : null}
          {summary.error && !summary.data ? <ErrorState message={summary.error.message} onRetry={summary.reload} /> : null}
          {summary.data ? <NationalTrendCard summary={summary.data} /> : null}
        </>
      )}

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select a reporting unit</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => setPicking(false)} hitSlop={10}>
              <Text style={[styles.done, { color: theme.brand }]}>Done</Text>
            </Pressable>
          </View>
          <UnitPicker />
          {selectedUnit ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMapSelection(selectedUnit.id);
                setPicking(false);
              }}
              style={[styles.showButton, { backgroundColor: theme.brand }]}>
              <Text style={[styles.showText, { color: theme.background }]}>Show {selectedUnit.name} on the map</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </DashboardScreen>
  );
}

function ViewToggle({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const theme = useTheme();
  const items: { v: View_; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { v: 'map', label: 'Map', icon: 'map-outline' },
    { v: 'trends', label: 'Trends', icon: 'chart-bar' },
  ];
  return (
    <View accessibilityRole="tablist" style={[styles.toggle, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      {items.map((it) => {
        const active = it.v === value;
        return (
          <Pressable
            key={it.v}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(it.v)}
            style={[styles.toggleItem, active && { backgroundColor: theme.brand }]}>
            <MaterialCommunityIcons name={it.icon} size={24} color={active ? theme.background : theme.text} />
            <Text style={[styles.toggleText, { color: active ? theme.background : theme.text }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, lineHeight: 18 },
  legendTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  legendNote: { fontSize: 11, lineHeight: 15 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  toggleItem: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  toggleText: { fontSize: 18, fontWeight: '600' },
  picker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  pickerTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  modal: { flex: 1, padding: Spacing.three, paddingTop: Spacing.five, gap: Spacing.three },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  done: { fontSize: 17, fontWeight: '600' },
  showButton: { borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  showText: { fontSize: 16, fontWeight: '600' },
});
