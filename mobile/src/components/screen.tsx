import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Banner, IconButton, StatusPill } from '@/components/ui';

/**
 * Screen frame + data-status pill + pull-to-refresh.
 *
 * Every screen in the app shows the status of the data it is displaying.
 * That is the whole point: a reader must never have to guess whether a
 * number is a historical surveillance record, a simulated record, or the
 * output of a model that is not connected.
 */
export function Screen({
  title,
  subtitle,
  status,
  statusLabel,
  headerAction,
  onRefresh,
  refreshing,
  staleError,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  statusLabel?: string;
  /** A button at the right of the title, e.g. the settings gear. */
  headerAction?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Set when a refresh failed and older data is still shown; the message says why. */
  staleError?: string | null;
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
            <Text role="heading" aria-level={1} accessibilityRole="header" style={[Type.display, { color: theme.text }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textSecondaryStrong }]}>{subtitle}</Text>
            ) : null}
            {status ? <StatusPill status={status} label={statusLabel} /> : null}
          </View>
          {headerAction}
        </View>
        {staleError ? (
          <Banner tone="caution" title="Showing older data">
            The last refresh failed ({staleError}). The figures below are from the previous successful load. Pull
            down to try again.
          </Banner>
        ) : null}
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The gear at the top right of each tab: Settings is a utility, not a destination of its own. */
export function SettingsButton() {
  const theme = useTheme();
  return (
    <IconButton
      label="Settings"
      onPress={() => router.push('/settings')}
      glyph={<MaterialCommunityIcons name="cog-outline" size={22} color={theme.textSecondaryStrong} />}
    />
  );
}

/** Closes a screen opened on top of the tabs; falls back to Overview when there is nothing to go back to. */
export function CloseButton({ label = 'Close' }: { label?: string }) {
  const theme = useTheme();
  return (
    <IconButton
      label={label}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      glyph={<MaterialCommunityIcons name="close" size={22} color={theme.textSecondaryStrong} />}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    paddingBottom: Spacing.six + Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingTop: Spacing.two,
  },
});
