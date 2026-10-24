import type { DengueSummaryData } from '@sigma/contracts';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatCount, formatIsoDate, weeksLabel } from '@/components/format';
import { NationalTrendCard } from '@/components/national-trend';
import { Card, Disclosure, ErrorState, FactRow, LinkRow, LoadingState, SectionTitle, StatusPill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Resource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useUnits } from '@/state/units-context';

/**
 * Lab: the national OpenDengue trend, how complete it is, and where its
 * gaps are, then the reporting-unit record behind Explore. Missing weeks stay
 * missing: the chart draws a gap marker and the gap list counts them.
 */
export function LabPanel({ summary }: { summary: Resource<DengueSummaryData> }) {
  const theme = useTheme();
  const { resource: units } = useUnits();
  const data = summary.data;
  const scope = units.data?.scope;

  return (
    <>
      {summary.loading && !data ? <LoadingState label="Loading the national series…" /> : null}
      {summary.error && !data ? <ErrorState message={summary.error.message} onRetry={summary.reload} /> : null}

      {data ? (
        <>
          <NationalTrendCard summary={data} title="National trend" />

          <Card>
            <SectionTitle>Coverage</SectionTitle>
            <FactRow label="From" value={formatIsoDate(data.series.coverage.from)} />
            <FactRow label="To" value={formatIsoDate(data.series.coverage.to)} />
            <FactRow
              label="Weeks recorded"
              value={`${formatCount(data.weekly.recorded)} of ${formatCount(data.weekly.expected)}`}
            />
            <FactRow
              label="Weeks missing"
              value={weeksLabel(data.weekly.expected - data.weekly.recorded)}
              tone="notConnected"
            />
            <FactRow label="Gap runs" value={String(data.series.gaps.length)} />
            <FactRow label="Case definition" value={data.caseDefinitions.join(', ') || 'unspecified'} />
            <FactRow label="Geographic level" value={data.series.geographicScope} />
            {data.weekly.stats ? (
              <FactRow
                label="Peak recorded week"
                value={`${formatCount(data.weekly.stats.max.value)} (${formatIsoDate(data.weekly.stats.max.periodStart)})`}
              />
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Epidemiological years</SectionTitle>
            {data.weekly.epiYears.map((year) => (
              <View key={year.year} style={styles.yearRow}>
                <View style={styles.yearHeader}>
                  <Text style={[styles.yearLabel, { color: theme.text }]}>{year.year} epi year</Text>
                  <StatusPill
                    status={year.complete ? 'live' : year.truncated ? 'not_connected' : 'unavailable'}
                    label={year.complete ? 'Complete' : year.truncated ? 'Partly covered' : 'Has gaps'}
                  />
                </View>
                <Text style={[styles.note, { color: theme.textSecondary }]}>
                  {year.recordedWeeks} of {year.expectedWeeks} weeks recorded
                  {year.complete
                    ? `; ${formatCount(year.recordedSum)} cases`
                    : `; the recorded sum (${formatCount(year.recordedSum)}) is not an annual total`}
                </Text>
              </View>
            ))}
          </Card>

          {data.series.gaps.length > 0 ? (
            <Disclosure
              title="Missing weeks"
              summary={`${data.series.gaps.length} gap run${data.series.gaps.length === 1 ? '' : 's'}, never zero-filled`}>
              {data.series.gaps.map((gap) => (
                <FactRow
                  key={`${gap.from}-${gap.to}`}
                  label={gap.from === gap.to ? formatIsoDate(gap.from) : `${formatIsoDate(gap.from)} – ${formatIsoDate(gap.to)}`}
                  value={weeksLabel(gap.missingWeeks)}
                />
              ))}
            </Disclosure>
          ) : null}

          <Card>
            <SectionTitle>What this series is</SectionTitle>
            <Text style={[styles.note, { color: theme.textSecondary }]}>{data.series.interpretation}</Text>
            {data.series.limitations.map((line) => (
              <Text key={line} style={[styles.note, { color: theme.textSecondary }]}>
                • {line}
              </Text>
            ))}
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Source: {data.series.source.name}. {data.series.source.provenance}
            </Text>
          </Card>
        </>
      ) : null}

      {scope ? (
        <Card>
          <SectionTitle>Reporting-unit record</SectionTitle>
          <FactRow label="Units" value={formatCount(scope.units)} />
          <FactRow label="Weeks" value={`${formatCount(scope.period.weeks)}, ${formatIsoDate(scope.period.from)} – ${formatIsoDate(scope.period.to)}`} />
          <FactRow label="Source" value={scope.source} />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Each unit&apos;s EARS alarm weeks and DOH-threshold weeks, by epi year, are in Explore.
          </Text>
          <LinkRow
            title="Open Explore"
            description="Pick a reporting unit and read its record."
            onPress={() => router.navigate('/explore')}
          />
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: {
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
