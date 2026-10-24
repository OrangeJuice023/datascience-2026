import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Spacing, STATUS_COLOR, STATUS_LABEL, STATUS_TEXT_TOKEN, TONE_TEXT_TOKEN, Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small shared building blocks.
 *
 * The app leans on a strict rule: a screen always shows what kind of data
 * it is showing. The status pill, the disclosure banner and the fact list
 * exist so that rule is easy to honour rather than easy to forget.
 */

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text role="heading" aria-level={2} accessibilityRole="header" style={[Type.title, { color: theme.text }]}>
        {children}
      </Text>
      {action}
    </View>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const theme = useTheme();
  const color = STATUS_COLOR[status] ?? 'notConnected';
  const tint = theme[color] as string;
  const textToken = STATUS_TEXT_TOKEN[status] ?? color;
  const textColor = theme[textToken] as string;
  return (
    <View
      accessible
      accessibilityLabel={`Data status: ${label ?? STATUS_LABEL[status] ?? status}`}
      style={[styles.pill, { backgroundColor: `${tint}17`, borderColor: `${tint}40` }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.pillText, { color: textColor }]}>{label ?? STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

export function Banner({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'caution';
  title?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  // A caution is a pale amber notice; information is a quiet neutral well. No coloured edge bar.
  const caution = tone === 'caution';
  return (
    <View
      accessibilityRole={caution ? 'alert' : undefined}
      style={[
        styles.banner,
        caution
          ? { backgroundColor: `${theme.demo}14`, borderColor: `${theme.demo}55` }
          : { backgroundColor: theme.backgroundSelected, borderColor: 'transparent' },
      ]}>
      {title ? (
        <Text style={[Type.title, { fontSize: 15, lineHeight: 20, color: caution ? theme.demoText : theme.text }]}>
          {title}
        </Text>
      ) : null}
      <Text style={[styles.bannerBody, { color: caution ? theme.text : theme.textSecondaryStrong }]}>{children}</Text>
    </View>
  );
}

export function FactRow({ label, value, tone }: { label: string; value: string; tone?: ThemeColor }) {
  const theme = useTheme();
  const color = tone ? theme[TONE_TEXT_TOKEN[tone] ?? tone] : theme.text;
  return (
    <View style={styles.factRow}>
      <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.factValue, Type.numeric, { color }]}>{value}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} />
      <Text style={[styles.centeredText, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={[styles.emptyTitle, Type.title, { color: theme.text }]}>{title}</Text>
      {message ? <Text style={[styles.centeredText, { color: theme.textSecondary }]}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={[styles.emptyTitle, Type.title, { color: theme.unavailableText }]}>Could not load this data</Text>
      <Text style={[styles.centeredText, { color: theme.textSecondary }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.retryText, { color: theme.background }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A row of filter chips. It scrolls sideways inside its own row, so a long list
 * of options takes one line instead of pushing the content down.
 */
export function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled">
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? theme.text : theme.backgroundElement,
                borderColor: active ? theme.text : theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={[styles.chipText, { color: active ? theme.background : theme.textSecondaryStrong }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * A segmented control: two to four views of the same screen, one row, equal
 * widths, each segment a 44pt touch target that announces whether it is
 * selected.
 */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              { opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: active ? theme.text : theme.textSecondaryStrong }, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A row that goes somewhere: a title, one line on what is there, and a
 * chevron. The whole row is the touch target.
 */
export function LinkRow({
  title,
  description,
  onPress,
  accessibilityHint,
}: {
  title: string;
  description?: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.disclosureText}>
        <Text style={[Type.title, { fontSize: 15, lineHeight: 20, color: theme.accent }]}>{title}</Text>
        {description ? <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>{description}</Text> : null}
      </View>
      <Text
        style={[styles.disclosureChevron, { color: theme.textSecondary }]}
        accessibilityElementsHidden
        importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

/** A square 44pt button holding one glyph; the label is for screen readers. */
export function IconButton({
  glyph,
  label,
  onPress,
}: {
  glyph: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      {glyph}
    </Pressable>
  );
}

/**
 * A collapsible section: supporting detail a reader may need but should not
 * have to scroll past. The header is one large touch target and announces
 * whether it is expanded.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Collapses this section' : 'Expands this section'}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.disclosureHeader, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.disclosureText}>
          <Text style={[Type.title, { fontSize: 16, lineHeight: 21, color: theme.text }]}>{title}</Text>
          {summary ? <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>{summary}</Text> : null}
        </View>
        <Text
          style={[styles.disclosureChevron, { color: theme.textSecondary, transform: [{ rotate: open ? '90deg' : '0deg' }] }]}
          accessibilityElementsHidden
          importantForAccessibility="no">
          ›
        </Text>
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disclosureHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  disclosureText: {
    flex: 1,
    gap: 2,
  },
  disclosureChevron: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '400',
    width: 24,
    textAlign: 'center',
  },
  disclosureBody: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    minHeight: 24,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  bannerBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 8,
  },
  factLabel: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  factValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '62%',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  centeredText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  retry: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
  },
  retryText: {
    fontWeight: '600',
    fontSize: 15,
  },
  chipScroll: {
    marginHorizontal: -Spacing.three,
    flexGrow: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  linkRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { Colors };
