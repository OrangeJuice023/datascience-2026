import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BarDatum {
  label: string;
  /** Null marks a period with no record in the source. */
  value: number | null;
  /** Drawn in the accent color, e.g. the most recent week. */
  highlight?: boolean;
}

/**
 * A dependency-free bar chart.
 *
 * A null value is drawn as an empty slot with a dotted baseline, never as a
 * zero-height bar. A missing week and a week with zero reported cases are
 * different facts, and the chart has to keep them apart.
 */
export function BarChart({
  data,
  height = 140,
  unit = '',
  maxBars = 60,
}: {
  data: BarDatum[];
  height?: number;
  unit?: string;
  maxBars?: number;
}) {
  const theme = useTheme();

  const visible = useMemo(() => {
    if (data.length <= maxBars) return data;
    const head = Math.floor(maxBars * 0.4);
    const tail = maxBars - head;
    return [...data.slice(0, head), ...data.slice(data.length - tail)];
  }, [data, maxBars]);

  const max = useMemo(() => {
    const values = visible.map((d) => d.value ?? 0);
    return Math.max(1, ...values);
  }, [visible]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.plot, { height }]}>
        {visible.map((datum, index) => {
          const isNull = datum.value === null;
          const ratio = isNull ? 0 : (datum.value as number) / max;
          const barHeight = Math.max(2, Math.round(ratio * (height - 22)));
          const tint = datum.highlight ? theme.accent : theme.textSecondary;
          return (
            <View key={`${datum.label}-${index}`} style={styles.column}>
              <View style={styles.barArea}>
                {isNull ? (
                  <View
                    style={[
                      styles.gapMark,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.bar,
                      { height: barHeight, backgroundColor: tint, opacity: datum.highlight ? 1 : 0.75 },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, Type.numeric, { color: theme.textSecondary }]}>{visible[0]?.label ?? ''}</Text>
        <Text style={[styles.axisText, Type.numeric, { color: theme.textSecondary }]}>
          peak {max.toLocaleString()}{unit}
        </Text>
        <Text style={[styles.axisText, Type.numeric, { color: theme.textSecondary }]}>
          {visible[visible.length - 1]?.label ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  column: {
    flex: 1,
    height: '100%',
  },
  barArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  gapMark: {
    width: '100%',
    height: 3,
    borderTopWidth: 1,
    borderStyle: 'dotted',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  axisText: {
    fontSize: 11,
  },
});
