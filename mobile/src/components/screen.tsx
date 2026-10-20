import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StatusPill } from '@/components/ui';

/**
 * Screen frame + data-status pill + pull-to-refresh.
 *
 * Every screen in the app shows the status of the data it is displaying.
 * That is the whole point: a reader must never have to guess whether a
 * number is a live surveillance record, a simulated record, or the output
 * of a model that is not connected.
 */
export function Screen({
  title,
  subtitle,
  status,
  statusLabel,
  onRefresh,
  refreshing,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  statusLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          ) : undefined
        }>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[Type.display, { color: theme.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textSecondaryStrong }]}>{subtitle}</Text>
            ) : null}
          </View>
          {status ? <StatusPill status={status} label={statusLabel} /> : null}
        </View>
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingTop: Spacing.two,
  },
});
