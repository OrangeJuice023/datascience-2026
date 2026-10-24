import type { DengueSummaryData } from '@sigma/contracts';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BarChart, type BarDatum } from '@/components/bar-chart';
import { formatIsoDate } from '@/components/format';
import { Card, ChipGroup, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

type WindowKey = '26' | '52' | 'all';

const WINDOWS: { value: WindowKey; label: string }[] = [
  { value: 'all', label: 'Full series' },
  { value: '52', label: 'Last 52 weeks' },
  { value: '26', label: 'Last 26 weeks' },
];

/**
 * The national OpenDengue weekly series as a bar chart. A missing week is a
 * gap marker, never a zero; the full series is binned (bar-bins.ts) so no
 * week is dropped.
 */
export function NationalTrendCard({ summary, title = 'National weekly reports' }: { summary: DengueSummaryData; title?: string }) {
  const theme = useTheme();
  const [windowKey, setWindowKey] = useState<WindowKey>('all');

  const chartData: BarDatum[] = useMemo(() => {
    const points = summary.weekly.points;
    const sliced = windowKey === 'all' ? points : points.slice(-Number(windowKey));
    return sliced.map((point, index) => ({
      label: point.periodStart,
      value: point.value,
      highlight: index === sliced.length - 1,
    }));
  }, [summary, windowKey]);

  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        {summary.series.source.name}, Philippines, {formatIsoDate(summary.series.coverage.from)} to{' '}
        {formatIsoDate(summary.series.coverage.to)}. The last bar is the newest week in the record, not this week.
      </Text>
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
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
