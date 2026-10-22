import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

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
      <Text style={[Type.title, { color: theme.text }]}>{children}</Text>
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
    <View style={[styles.pill, { backgroundColor: `${tint}1a`, borderColor: `${tint}55` }]}>
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
  const tint = tone === 'caution' ? theme.demo : theme.accent;
  return (
    <View style={[styles.banner, { borderLeftColor: tint, backgroundColor: theme.backgroundElement }]}>
      {title ? (
        <Text style={[Type.title, { fontSize: 15, lineHeight: 21, color: theme.text }]}>{title}</Text>
      ) : null}
      <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>{children}</Text>
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
          style={[styles.retry, { backgroundColor: theme.accent }]}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A horizontally scrollable row of filter chips. */
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
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? theme.accent : theme.background,
                borderColor: active ? theme.accent : theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.chipText, { color: active ? '#ffffff' : theme.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
          <Text style={[Type.title, { fontSize: 16, lineHeight: 22, color: theme.text }]}>{title}</Text>
          {summary ? <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>{summary}</Text> : null}
        </View>
        <Text style={[styles.disclosureChevron, { color: theme.textSecondary }]} accessibilityElementsHidden importantForAccessibility="no">
          {open ? '−' : '+'}
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
    fontSize: 22,
    fontWeight: '400',
    width: 24,
    textAlign: 'center',
  },
  disclosureBody: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  banner: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  bannerBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 6,
  },
  factLabel: {
    fontSize: 14,
    flexShrink: 1,
  },
  factValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 0,
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export { Colors };
