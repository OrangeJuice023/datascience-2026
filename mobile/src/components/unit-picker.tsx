import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { DengueUnitRecord } from '@sigma/contracts';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, IconButton, LoadingState } from '@/components/ui';
import { regionLabel, searchUnits, unitTypeLabel } from '@/components/units';
import { MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnits } from '@/state/units-context';

/**
 * The reporting-unit picker shared by Explore and Analyze.
 *
 * A row shows the unit in use; tapping it opens a searchable list of all 126
 * HDX reporting units. A reporting unit is not always a whole province, so
 * every row says what kind of unit it is.
 */
export function UnitPicker({ hint }: { hint?: string }) {
  const theme = useTheme();
  const { resource, units, selectedUnit, selectUnit } = useUnits();
  const [open, setOpen] = useState(false);

  if (resource.loading && !resource.data) return <LoadingState label="Loading the reporting units…" />;
  if (resource.error && !resource.data) {
    return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  }
  if (!selectedUnit) {
    return <EmptyState title="No reporting units" message="The API returned no reporting units." />;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reporting unit: ${selectedUnit.name}, ${unitTypeLabel(selectedUnit.unitType)}, ${regionLabel(selectedUnit.regionId)}`}
        accessibilityHint={hint ?? 'Opens the list of reporting units'}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
        ]}>
        <View style={styles.triggerText}>
          <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>Reporting unit</Text>
          <Text style={[Type.title, { color: theme.text }]} numberOfLines={1}>
            {selectedUnit.name}
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={2}>
            {unitTypeLabel(selectedUnit.unitType)} · {regionLabel(selectedUnit.regionId)}
          </Text>
        </View>
        <Text style={[styles.change, { color: theme.accent }]}>Change</Text>
      </Pressable>

      <UnitListModal
        visible={open}
        units={units}
        selectedId={selectedUnit.id}
        onClose={() => setOpen(false)}
        onSelect={(id) => {
          selectUnit(id);
          setOpen(false);
        }}
      />
    </>
  );
}

function UnitListModal({
  visible,
  units,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  units: DengueUnitRecord[];
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchUnits(units, query), [units, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
          <View style={styles.sheetInner}>
            <View style={styles.sheetHeader}>
              <View style={styles.triggerText}>
                <Text role="heading" aria-level={1} accessibilityRole="header" style={[Type.display, { color: theme.text }]}>
                  Reporting units
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondaryStrong }]}>
                  {units.length} HDX dengue reporting units. A province remainder excludes the cities reported
                  separately.
                </Text>
              </View>
              <IconButton
                label="Close the list"
                onPress={onClose}
                glyph={<MaterialCommunityIcons name="close" size={22} color={theme.textSecondaryStrong} />}
              />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search reporting units"
              placeholder="Search by name, region or type"
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
              style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />
            <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: theme.textSecondary }]}>
              {results.length === units.length ? `${units.length} units, A–Z` : `${results.length} of ${units.length} units`}
            </Text>
          </View>
          <FlatList
            data={results}
            keyExtractor={(unit) => unit.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState title="No unit matches" message={`Nothing matches "${query.trim()}".`} />}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.name}, ${unitTypeLabel(item.unitType)}, ${regionLabel(item.regionId)}`}
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: selected ? theme.backgroundSelected : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <View style={styles.triggerText}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      {unitTypeLabel(item.unitType)} · {regionLabel(item.regionId)}
                    </Text>
                  </View>
                  {selected ? <MaterialCommunityIcons name="check" size={22} color={theme.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 64,
  },
  triggerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  change: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheet: {
    flex: 1,
  },
  sheetInner: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
});
