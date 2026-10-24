import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { MaxContentWidth, PixelFont, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Banner } from '@/components/ui';

/**
 * The dashboard look of the Overview and Explore tabs (design references of
 * 2026-10-24): a faint grid behind everything, the SIGMA pixel wordmark,
 * a large pixel title, tinted stat tiles and dropdown filters.
 */

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Two small offset squares, the pixel motif from the wordmark. */
export function PixelMark({ size = 7 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ width: size * 2, height: size * 2 }} accessible={false}>
      <View style={{ position: 'absolute', right: 0, top: 0, width: size, height: size, backgroundColor: theme.signalNone, opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: size, height: size, backgroundColor: theme.signalC2, opacity: 0.45 }} />
    </View>
  );
}

function GridBackground() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height * 3} pointerEvents="none">
      <Defs>
        <Pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <Path d="M24 0H0V24" fill="none" stroke={theme.grid} strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

export function DashboardScreen({
  title,
  subtitle,
  onRefresh,
  refreshing,
  staleError,
  children,
}: {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  staleError?: string | null;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <GridBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.brand} /> : undefined
        }>
        <View style={styles.topBar}>
          <View style={styles.wordmarkRow}>
            <Text accessibilityRole="header" style={[styles.wordmark, { color: theme.brand }]}>
              SIGMA
            </Text>
            <View style={{ marginTop: 18 }}>
              <PixelMark size={6} />
            </View>
          </View>
          <View style={styles.topActions}>
            <HeaderIcon name="information-outline" label="About these numbers" onPress={() => router.push('/about')} />
            <HeaderIcon name="menu" label="Settings" onPress={() => router.push('/settings')} />
          </View>
        </View>
        <Text role="heading" aria-level={1} style={[styles.title, { color: theme.brand }]}>
          {title}
        </Text>
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.brand }]}>{subtitle}</Text>
          <PixelMark size={7} />
        </View>
        <View style={[styles.rule, { backgroundColor: theme.grid }]} />
        {staleError ? (
          <Banner tone="caution" title="Showing older data">
            The last refresh failed ({staleError}). The figures below are from the previous successful load. Pull down to
            try again.
          </Banner>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderIcon({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.headerIcon, { opacity: pressed ? 0.6 : 1 }]}>
      <MaterialCommunityIcons name={name} size={28} color={theme.brand} />
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  sub: string;
  icon: IconName;
  tone?: 'brand' | 'alert';
}) {
  const theme = useTheme();
  const alert = tone === 'alert';
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${sub}`}
      style={[styles.tile, { backgroundColor: alert ? theme.alertSoft : theme.brandSoft, borderColor: theme.border }]}>
      <View style={styles.tileText}>
        <Text style={[styles.tileLabel, { color: theme.text }]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[styles.tileValue, Type.numeric, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[styles.tileSub, { color: theme.textSecondary }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <MaterialCommunityIcons name={icon} size={22} color={alert ? theme.signalC2 : theme.signalNone} style={styles.tileIcon} />
    </View>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.tileGrid}>{children}</View>;
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** A dropdown: a labelled box that opens a list. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  /** What the control chooses, for screen readers. */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  icon?: IconName;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.select,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 },
        ]}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={theme.brand} /> : null}
        <Text style={[styles.selectText, { color: theme.text }]} numberOfLines={1}>
          {current?.label ?? label}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[Type.title, { color: theme.text, marginBottom: Spacing.two }]}>{label}</Text>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.value);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: active ? theme.brandSoft : 'transparent', opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.body, { color: theme.text, fontWeight: active ? '600' : '400' }]}>{o.label}</Text>
                    {o.hint ? <Text style={[Type.label, { color: theme.textSecondary }]}>{o.hint}</Text> : null}
                  </View>
                  {active ? <MaterialCommunityIcons name="check" size={20} color={theme.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export function SelectRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.selectRow}>{children}</View>;
}

/** A card with a bold title row and an optional chevron that goes somewhere. */
export function DashCard({
  title,
  subtitle,
  onPress,
  children,
  style,
  compact,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: object;
  /** Smaller title, for half-width cards. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const header = (
    <View style={styles.cardHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, compact && styles.cardTitleCompact, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={26} color={theme.text} /> : null}
    </View>
  );
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
          {header}
        </Pressable>
      ) : (
        header
      )}
      {children}
    </View>
  );
}

export function LegendRow({
  color,
  label,
  count,
  hollow,
}: {
  color: string;
  label: string;
  count?: number;
  hollow?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.legendDot,
          hollow ? { borderWidth: 2, borderColor: color, backgroundColor: 'transparent' } : { backgroundColor: color },
        ]}
      />
      <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text style={[styles.legendText, Type.numeric, { color: theme.text, marginLeft: 'auto' }]}>{count}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six + Spacing.four,
    gap: Spacing.three,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.three },
  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  wordmark: { fontFamily: PixelFont.bold, fontSize: 30, lineHeight: 36, letterSpacing: 1 },
  topActions: { flexDirection: 'row', gap: Spacing.three },
  headerIcon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: PixelFont.bold, fontSize: 46, lineHeight: 54, marginTop: -Spacing.two },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: -Spacing.three },
  subtitle: { fontFamily: PixelFont.regular, fontSize: 19, lineHeight: 26, flex: 1 },
  rule: { height: 7, borderRadius: 4 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + Spacing.one },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three - 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tileText: { flex: 1, gap: 2 },
  tileLabel: { fontSize: 14, lineHeight: 19, paddingRight: 26 },
  tileValue: { fontSize: 27, lineHeight: 33, fontWeight: '700' },
  tileSub: { fontSize: 13, lineHeight: 17 },
  tileIcon: { position: 'absolute', top: 12, right: 12 },
  selectRow: { flexDirection: 'row', gap: Spacing.two + Spacing.one },
  select: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selectText: { flex: 1, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, padding: Spacing.three, paddingBottom: Spacing.five, gap: 2 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: Spacing.two, borderRadius: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  cardTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  cardTitleCompact: { fontSize: 16, lineHeight: 21 },
  cardSub: { fontSize: 14, lineHeight: 19 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 22 },
  legendDot: { width: 13, height: 13, borderRadius: 7 },
  legendText: { fontSize: 13, lineHeight: 18 },
});
