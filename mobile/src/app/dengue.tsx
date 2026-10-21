import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchSignals, fetchSummary } from '@/api/endpoints';
import { BarChart, type BarDatum } from '@/components/bar-chart';
import { Screen } from '@/components/screen';
import { SigiNote } from '@/components/sigi';
import { Banner, Card, ChipGroup, ErrorState, FactRow, LoadingState, SectionTitle, StatusPill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

type WindowKey = '26' | '52' | 'all';

const WINDOWS: { value: WindowKey; label: string }[] = [
  { value: '26', label: 'Last 26 weeks' },
  { value: '52', label: 'Last 52 weeks' },
  { value: 'all', label: 'Full series' },
];

/**
 * Dengue.
 *
 * The national OpenDengue series, shown as observed weekly reports. Two
 * things are load-bearing here:
 *
 * 1. Missing weeks stay missing. The chart draws a gap marker, not a zero,
 *   and the gap list says how many weeks are absent.
 * 2. The anomaly section reports `not_connected`. No model is wired to this
 *   API, so no anomaly score is shown, and the screen says that plainly
 *   rather than letting an empty list read as "no signal".
 */
export default function DengueScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();
  const [windowKey, setWindowKey] = useState<WindowKey>('52');

  const summary = useResource((signal) => fetchSummary(baseUrl, undefined, signal), [baseUrl]);
  const signals = useResource((signal) => fetchSignals(baseUrl, {}, signal), [baseUrl]);

  const chartData: BarDatum[] = useMemo(() => {
    const points = summary.data?.weekly.points ?? [];
    const sliced = windowKey === 'all' ? points : points.slice(-Number(windowKey));
    return sliced.map((point, index) => ({
      label: point.periodStart.slice(5),
      value: point.value,
      highlight: index === sliced.length - 1,
    }));
  }, [summary.data, windowKey]);

  const refresh = () => {
    summary.reload();
    signals.reload();
  };

  const loading = summary.loading && !summary.data;
  const failed = summary.error && !summary.data;

  return (
    <Screen
      title="Dengue"
      subtitle="National reported case counts, weekly."
      status={summary.meta?.status}
      onRefresh={refresh}
      refreshing={summary.refreshing}>
      {loading ? <LoadingState label="Loading the national series…" /> : null}
      {failed && summary.error ? (
        <ErrorState message={summary.error.message} onRetry={refresh} />
      ) : null}

      {summary.data ? (
        <>
          <Card>
            <SectionTitle>Weekly reports</SectionTitle>
            <ChipGroup options={WINDOWS} selected={windowKey} onSelect={setWindowKey} />
            {chartData.length > 0 ? (
              <BarChart data={chartData} unit=" cases" />
            ) : (
              <Text style={[styles.note, { color: theme.textSecondary }]}>No weeks to show.</Text>
            )}
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Weeks with no record are drawn as a gap marker. A gap is not a week with zero cases.
            </Text>
          </Card>

          <Card>
            <SectionTitle>Coverage</SectionTitle>
            <FactRow label="From" value={summary.data.series.coverage.from} />
            <FactRow label="To" value={summary.data.series.coverage.to} />
            <FactRow
              label="Weeks recorded"
              value={`${summary.data.weekly.recorded} of ${summary.data.weekly.expected}`}
            />
            <FactRow label="Gap runs" value={String(summary.data.series.gaps.length)} />
            <FactRow label="Case definition" value={summary.data.caseDefinitions.join(', ') || 'unspecified'} />
            <FactRow label="Geographic level" value={summary.data.series.geographicScope} />
          </Card>

          {summary.data.weekly.stats ? (
            <Card>
              <SectionTitle>Recorded weeks only</SectionTitle>
              <FactRow label="Mean" value={Math.round(summary.data.weekly.stats.mean).toLocaleString()} />
              <FactRow label="Median" value={Math.round(summary.data.weekly.stats.median).toLocaleString()} />
              <FactRow
                label="Peak week"
                value={`${summary.data.weekly.stats.max.value.toLocaleString()} (${summary.data.weekly.stats.max.periodStart})`}
              />
              <FactRow
                label="Lowest week"
                value={`${summary.data.weekly.stats.min.value.toLocaleString()} (${summary.data.weekly.stats.min.periodStart})`}
              />
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Epidemiological years</SectionTitle>
            {summary.data.weekly.epiYears.map((year) => (
              <View key={year.year} style={styles.yearRow}>
                <View style={styles.yearHeader}>
                  <Text style={[styles.yearLabel, { color: theme.text }]}>
                    {year.year} epi year
                  </Text>
                  <StatusPill
                    status={year.complete ? 'live' : year.truncated ? 'not_connected' : 'unavailable'}
                    label={year.complete ? 'Complete' : year.truncated ? 'Partly covered' : 'Has gaps'}
                  />
                </View>
                <Text style={[styles.note, { color: theme.textSecondary }]}>
                  {year.recordedWeeks} of {year.expectedWeeks} weeks recorded
                  {year.complete ? '' : `; recorded sum ${year.recordedSum.toLocaleString()} is not an annual total`}
                </Text>
              </View>
            ))}
          </Card>

          {summary.data.series.gaps.length > 0 ? (
            <Card>
              <SectionTitle>Missing weeks</SectionTitle>
              {summary.data.series.gaps.map((gap) => (
                <FactRow
                  key={`${gap.from}-${gap.to}`}
                  label={`${gap.from} → ${gap.to}`}
                  value={`${gap.missingWeeks} week${gap.missingWeeks === 1 ? '' : 's'}`}
                />
              ))}
            </Card>
          ) : null}

          <Card>
            <SectionTitle>What this series is</SectionTitle>
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              {summary.data.series.interpretation}
            </Text>
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Source: {summary.data.series.source.name} — {summary.data.series.source.provenance}
            </Text>
          </Card>
        </>
      ) : null}

      {signals.data ? (
        <Card>
          <SectionTitle>Anomaly detection</SectionTitle>
          <View style={styles.yearHeader}>
            <Text style={[styles.yearLabel, { color: theme.text }]}>{signals.data.engine.name}</Text>
            <StatusPill
              status={signals.data.status === 'live' ? 'live' : 'not_connected'}
              label={signals.data.status === 'live' ? 'Connected' : 'Not connected'}
            />
          </View>
          <Text style={[styles.note, { color: theme.textSecondary }]}>{signals.data.reason}</Text>
          <SigiNote state={signals.data.status === 'live' ? 'insight' : 'unavailable'} size={48}>
            {signals.data.status === 'live'
              ? 'The anomaly engine is connected and the results below come from it.'
              : 'Sigi cannot read the anomaly engine: it is not connected to this API, so there are no anomaly results to show.'}
          </SigiNote>
          {signals.data.signals.length > 0 ? (
            <FactRow label="Anomaly results" value={String(signals.data.signals.length)} />
          ) : null}
          {signals.data.limitations.map((limitation) => (
            <Text key={limitation} style={[styles.bullet, { color: theme.textSecondary }]}>
              • {limitation}
            </Text>
          ))}
        </Card>
      ) : null}

      <Banner tone="caution" title="Read this before using the numbers">
        This is a historical surveillance record from a national extract. It is not a forecast, not a
        sub-national breakdown, and not a statement that an outbreak is occurring. Annual totals are
        meaningful only for epi years where every week was recorded.
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  bullet: {
    fontSize: 13,
    lineHeight: 19,
  },
  yearRow: {
    gap: 4,
    paddingVertical: Spacing.two,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  yearLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
});
