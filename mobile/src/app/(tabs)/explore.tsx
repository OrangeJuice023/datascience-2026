import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { fetchSummary } from '@/api/endpoints';
import { formatIsoDate, historicalStatusLabel } from '@/components/format';
import { NationalTrendCard } from '@/components/national-trend';
import { Screen, SettingsButton } from '@/components/screen';
import { Banner, Card, Disclosure, ErrorState, LinkRow, LoadingState, SectionTitle } from '@/components/ui';
import { UnitPicker } from '@/components/unit-picker';
import { UnitYearTable } from '@/components/unit-year-table';
import { regionLabel, unitTypeLabel } from '@/components/units';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

/**
 * Explore.
 *
 * One reporting unit at a time, without a map: pick a unit from the list of
 * 126 and read its record by epi year (reported cases over usable weeks, EARS
 * alarm weeks, weeks above a DOH threshold), then the national weekly series
 * for context. Both are historical.
 */
export default function ExploreScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();
  const { resource: units, selectedUnit } = useUnits();

  const summary = useResource((signal) => fetchSummary(baseUrl, undefined, signal), [baseUrl]);

  const refresh = () => {
    units.reload();
    summary.reload();
  };

  const scope = units.data?.scope;
  const staleError = (units.stale ? units.error?.message : null) ?? (summary.stale ? summary.error?.message : null);

  return (
    <Screen
      title="Explore"
      subtitle="One reporting unit's dengue record by year, and the national weekly series."
      status={units.meta?.status}
      statusLabel={historicalStatusLabel(units.meta?.status)}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={units.refreshing || summary.refreshing}
      staleError={staleError}>
      <UnitPicker />

      {selectedUnit && scope ? (
        <Card>
          <SectionTitle>{selectedUnit.name} by epi year</SectionTitle>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {unitTypeLabel(selectedUnit.unitType)}, {regionLabel(selectedUnit.regionId)}. Weekly reports{' '}
            {formatIsoDate(scope.period.from)} – {formatIsoDate(scope.period.to)}, {scope.source}.
          </Text>
          <UnitYearTable years={selectedUnit.years} />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Cases are summed over usable weeks only, so a year with unusable weeks is not an annual total. An EARS
            alarm or a week above a DOH threshold is a prompt to check the data, not a confirmed outbreak.
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
            <Text key={note} style={[styles.note, { color: theme.textSecondary }]}>
              • {note}
            </Text>
          ))}
        </Disclosure>
      ) : null}

      {summary.loading && !summary.data ? <LoadingState label="Loading the national series…" /> : null}
      {summary.error && !summary.data ? (
        <ErrorState message={summary.error.message} onRetry={summary.reload} />
      ) : null}
      {summary.data ? <NationalTrendCard summary={summary.data} /> : null}

      <Banner tone="caution" title="Historical records">
        {[
          'These are past weekly reports',
          scope ? ` (reporting units to ${formatIsoDate(scope.period.to)}` : '',
          scope && summary.data ? `, national to ${formatIsoDate(summary.data.series.coverage.to)})` : scope ? ')' : '',
          '. They are not real-time, not a forecast and not a statement that an outbreak is occurring.',
        ].join('')}
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
