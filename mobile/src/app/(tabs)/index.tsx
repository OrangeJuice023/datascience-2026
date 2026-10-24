import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SOURCE_LABEL } from '@/api/discovery';
import { fetchSignals, fetchSummary } from '@/api/endpoints';
import { BOUNDARIES_ATTRIBUTION } from '@/api/geo';
import { Donut, WeeklyLineChart } from '@/components/charts';
import {
  ALL_HDX,
  caseRadius,
  countClasses,
  HDX_YEARS,
  nationalStats,
  rangeLabel,
  SIGNAL_CLASSES,
  SIGNAL_LABEL,
  UNIT_YEARS,
  unitSignalClasses,
  unitValue,
  type SignalClass,
} from '@/components/dashboard-data';
import { DashboardScreen, DashCard, LegendRow, Select, SelectRow, StatTile, TileGrid } from '@/components/dashboard';
import { formatCount, formatIsoDate } from '@/components/format';
import { ErrorState, LoadingState } from '@/components/ui';
import { UnitMap } from '@/components/unit-map';
import { Spacing } from '@/constants/theme';
import { useBoundaries } from '@/hooks/use-boundaries';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

/**
 * Overview: the key figures for the window the reporting-unit data covers
 * (2016-2021), all from the API.
 * - Tiles and the line chart: the national OpenDengue weekly series
 *   (/dengue/summary), cut to the chosen years. A week with no record is a
 *   gap, and the tiles count it as missing, never as zero cases.
 * - Cases by reporting unit: /dengue/units, drawn as sized points (counts are
 *   never filled into areas).
 * - Recent signals: EARS results for the latest week (/dengue/signals).
 * Historical records; nothing here describes this week.
 */

type RangeKey = 'all' | `${(typeof HDX_YEARS)[number]}`;

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'all', label: rangeLabel(ALL_HDX) },
  ...HDX_YEARS.map((y) => ({ value: String(y) as RangeKey, label: String(y) })),
];

export default function OverviewScreen() {
  const { baseUrl, source } = useSettings();
  const theme = useTheme();
  const { resource: units } = useUnits();
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');
  const range = useMemo(() => (rangeKey === 'all' ? ALL_HDX : { from: Number(rangeKey), to: Number(rangeKey) }), [rangeKey]);
  const unitYears = useMemo(() => UNIT_YEARS.filter((y) => y >= range.from && y <= range.to), [range]);

  const summary = useResource((signal) => fetchSummary(baseUrl, undefined, signal), [baseUrl]);
  const signals = useResource((signal) => fetchSignals(baseUrl, {}, signal), [baseUrl]);
  const boundaries = useBoundaries(baseUrl);

  const refresh = () => {
    summary.reload();
    signals.reload();
    units.reload();
    boundaries.reload();
  };

  const stats = useMemo(() => (summary.data ? nationalStats(summary.data.weekly.points, range) : null), [summary.data, range]);

  const caseMarkers = useMemo(() => {
    const list = units.data?.units ?? [];
    const values = list.map((u) => ({ id: u.id, cases: unitValue(u, 'cases', unitYears) }));
    const max = Math.max(0, ...values.map((v) => v.cases ?? 0));
    return values.map((v) => ({ id: v.id, color: theme.brand, radius: caseRadius(v.cases, max, 9) }));
  }, [units.data, theme.brand, unitYears]);

  const signalWeek = signals.data?.signals[0]?.periodStart ?? null;
  const classCounts = useMemo(() => {
    if (!signals.data || !units.data) return null;
    const classes = unitSignalClasses(signals.data.signals, units.data.units.map((u) => u.id));
    return countClasses(classes.values(), SIGNAL_CLASSES);
  }, [signals.data, units.data]);
  const classColor: Record<SignalClass, string> = {
    none: theme.signalNone,
    C1: theme.signalC1,
    C2: theme.signalC2,
    C3: theme.signalC3,
    no_result: theme.noResult,
  };

  const staleError = [summary, signals, units].find((r) => r.stale)?.error?.message ?? null;
  const scope = units.data?.scope;

  return (
    <DashboardScreen
      title="Overview"
      subtitle="Key dengue indicators for the Philippines."
      onRefresh={refresh}
      refreshing={summary.refreshing || signals.refreshing || units.refreshing}
      staleError={staleError}>
      <SelectRow>
        <Select label="Years" icon="calendar-month-outline" value={rangeKey} options={RANGE_OPTIONS} onChange={setRangeKey} />
        <Select
          label="Place"
          icon="map-marker-outline"
          value="ph"
          options={[
            { value: 'ph', label: 'Philippines (National)' },
            { value: 'unit', label: 'A reporting unit…', hint: 'Opens Explore, where you can pick one of the 126.' },
          ]}
          onChange={(v) => {
            if (v === 'unit') router.navigate('/explore');
          }}
        />
      </SelectRow>

      {summary.loading && !summary.data ? <LoadingState label="Loading the national series…" /> : null}
      {summary.error && !summary.data ? <ErrorState message={summary.error.message} onRetry={summary.reload} /> : null}

      {stats ? (
        <TileGrid>
          <StatTile
            label="Total reported cases"
            value={formatCount(stats.total)}
            sub={`${rangeLabel(range)} · ${stats.recordedWeeks} of ${stats.expectedWeeks} weeks recorded`}
            icon="chart-bar"
          />
          <StatTile
            label="Average weekly cases"
            value={stats.average === null ? '–' : formatCount(Math.round(stats.average))}
            sub={`${rangeLabel(range)}, recorded weeks`}
            icon="chart-line-variant"
          />
          <StatTile
            label="Peak week"
            value={stats.peak ? formatCount(stats.peak.value) : '–'}
            sub={stats.peak ? `Week of ${formatIsoDate(stats.peak.periodStart)}` : 'No recorded week'}
            icon="chart-bar"
            tone="alert"
          />
          <StatTile
            label="Reporting units"
            value={scope ? formatCount(scope.units) : '–'}
            sub="Provinces, remainders, cities"
            icon="view-grid-outline"
          />
        </TileGrid>
      ) : null}

      {stats && summary.data ? (
        <DashCard
          title="National weekly dengue cases"
          onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'lab' } })}>
          <WeeklyLineChart
            points={stats.points}
            accessibilityLabel={`National weekly reported dengue cases, ${rangeLabel(range)}. Peak ${stats.peak ? formatCount(stats.peak.value) : 'none'}.`}
          />
          <Text style={[styles.caption, { color: theme.textSecondary }]}>
            {summary.data.series.source.name}, national. Historical records, not a forecast and not a statement that an
            outbreak is occurring. Gaps are weeks with no record.
          </Text>
        </DashCard>
      ) : null}

      <View style={styles.pair}>
        <DashCard
          title="Cases by reporting unit"
          subtitle={unitYears.length ? `Reported cases, ${rangeLabel({ from: unitYears[0], to: unitYears[unitYears.length - 1] })}` : 'No unit totals for 2021'}
          onPress={() => router.navigate('/explore')}
          style={styles.half}
          compact>
          {boundaries.data && units.data && unitYears.length ? (
            <UnitMap map={boundaries.data} markers={caseMarkers} height={190} interactive={false} />
          ) : boundaries.error ? (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>{boundaries.error.message}</Text>
          ) : unitYears.length ? (
            <LoadingState label="Loading map…" />
          ) : (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>
              2021 has a single week in the unit data, so there is no total to map.
            </Text>
          )}
          <Text style={[styles.small, { color: theme.textSecondary }]}>
            Dot area = reported cases, not population-adjusted.
          </Text>
        </DashCard>

        <DashCard
          title="Recent signals"
          subtitle={signalWeek ? `Week of ${formatIsoDate(signalWeek)} (latest)` : 'Latest available week'}
          onPress={() => router.navigate('/explore')}
          style={styles.half}
          compact>
          {signals.error && !signals.data ? (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>{signals.error.message}</Text>
          ) : signals.data?.status === 'not_connected' ? (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>{signals.data.reason}</Text>
          ) : classCounts ? (
            <View style={styles.donutBlock}>
              <Donut
                size={118}
                centerLabel={'reporting\nunits'}
                segments={SIGNAL_CLASSES.map((c) => ({ key: c, value: classCounts[c], color: classColor[c], hollow: c === 'no_result' }))}
              />
              <View style={styles.legend}>
                {SIGNAL_CLASSES.map((c) => (
                  <LegendRow key={c} color={classColor[c]} label={SIGNAL_LABEL[c]} count={classCounts[c]} hollow={c === 'no_result'} />
                ))}
              </View>
            </View>
          ) : (
            <LoadingState label="Loading signals…" />
          )}
        </DashCard>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/about')}
        style={({ pressed }) => [styles.about, { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <MaterialCommunityIcons name="book-open-variant" size={34} color={theme.brand} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.aboutTitle, { color: theme.text }]}>About these numbers</Text>
          <Text style={[styles.caption, { color: theme.textSecondary }]}>
            Historical surveillance data, 2016 – 2021. Not a forecast.
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={26} color={theme.text} />
      </Pressable>

      <Text style={[styles.small, { color: theme.textSecondary }]}>
        API: {baseUrl} ({SOURCE_LABEL[source]}). {BOUNDARIES_ATTRIBUTION}. Dengue: Cirrolytix / DOH-EB via HDX (CC BY);
        OpenDengue (CC BY 4.0).
      </Text>
    </DashboardScreen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 11.5, lineHeight: 16 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + Spacing.one },
  half: { flexBasis: '47%', flexGrow: 1, minWidth: 160 },
  donutBlock: { alignItems: 'center', gap: Spacing.two },
  legend: { alignSelf: 'stretch', gap: 1 },
  about: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  aboutTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
});
