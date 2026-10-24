import type { DengueUnitYear } from '@sigma/contracts';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { yearCells } from '@/components/units';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One reporting unit's epi years: reported cases over usable weeks, EARS
 * alarm weeks and weeks above a DOH threshold. Each row is read out as one
 * sentence; "no data" cells say why in words instead of showing zero.
 */
export function UnitYearTable({ years }: { years: DengueUnitYear[] }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Epi-year table" style={styles.table}>
      <View style={[styles.row, styles.headRow, { borderBottomColor: theme.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.head, styles.yearCol, { color: theme.textSecondary }]}>Year</Text>
        <Text style={[styles.head, styles.casesCol, { color: theme.textSecondary }]}>Reported cases</Text>
        <Text style={[styles.head, styles.countCol, { color: theme.textSecondary }]}>EARS alarm weeks</Text>
        <Text style={[styles.head, styles.countCol, { color: theme.textSecondary }]}>DOH threshold weeks</Text>
      </View>
      {years.map((year) => {
        const cells = yearCells(year);
        return (
          <View
            key={year.year}
            accessible
            accessibilityLabel={cells.accessibilityLabel}
            style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.value, styles.yearCol, Type.numeric, { color: theme.text }]}>{year.year}</Text>
            <View style={styles.casesCol}>
              <Text style={[styles.value, Type.numeric, { color: year.cases === null ? theme.notConnectedText : theme.text }]}>
                {cells.cases}
              </Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{cells.casesDetail}</Text>
            </View>
            <View style={styles.countCol}>
              <Text style={[styles.value, Type.numeric, { color: year.earsWeeks === null ? theme.notConnectedText : theme.text }]}>
                {cells.ears}
              </Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{cells.earsDetail}</Text>
            </View>
            <View style={styles.countCol}>
              <Text style={[styles.value, Type.numeric, { color: year.dohWeeks === null ? theme.notConnectedText : theme.text }]}>
                {cells.doh}
              </Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{cells.dohDetail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headRow: {
    paddingTop: 0,
  },
  head: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  yearCol: {
    width: 40,
  },
  casesCol: {
    flex: 1.3,
    minWidth: 0,
  },
  countCol: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
  },
});
