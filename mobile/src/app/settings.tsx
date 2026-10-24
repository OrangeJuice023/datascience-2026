import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { fetchHealth } from '@/api/endpoints';
import { validateBaseUrl } from '@/api/config';
import { SOURCE_LABEL } from '@/api/discovery';
import { CloseButton, Screen } from '@/components/screen';
import { Banner, Card, FactRow, SectionTitle, StatusPill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

/**
 * Settings.
 *
 * The API address is editable, because the app has to be pointed at a
 * local server, a staging deployment or a production deployment. The
 * current value is always visible, and the health check says plainly
 * whether the app can actually reach it.
 */
export default function SettingsScreen() {
  const { baseUrl, source, defaultBaseUrl, updateBaseUrl, resetBaseUrl, rediscover } = useSettings();
  const [finding, setFinding] = useState(false);
  const theme = useTheme();

  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  /** Null means "follow the saved address"; a string is an unsaved edit. */
  const value = draft ?? baseUrl;

  const save = async () => {
    const message = validateBaseUrl(value);
    setProblem(message);
    setSaved(false);
    if (message) return;
    await updateBaseUrl(value);
    setDraft(null);
    setSaved(true);
  };

  const reset = async () => {
    setFinding(true);
    await (source === 'saved' ? resetBaseUrl() : rediscover()).finally(() => setFinding(false));
    setDraft(null);
    setProblem(null);
    setSaved(false);
    setCheckResult(null);
  };

  const check = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const response = await fetchHealth(baseUrl);
      const services = response.data.services.filter((service) => service.status === 'ok').length;
      setCheckResult({
        ok: response.data.status === 'ok',
        message: `${response.data.service} ${response.data.version} responded. ${services}/${response.data.services.length} services are operating.`,
      });
    } catch (error) {
      setCheckResult({
        ok: false,
        message: error instanceof ApiError ? error.message : 'The health check failed.',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen title="Settings" subtitle="Where this app looks for the SIGMA API." headerAction={<CloseButton />}>
      <Card>
        <SectionTitle>API address</SectionTitle>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          The base URL of the SIGMA API, including the version path. The app finds one by itself (your
          development machine, the emulator host, then the deployed API); save an address here only to
          override that.
        </Text>
        <TextInput
          accessibilityLabel="API address"
          value={value}
          onChangeText={(next) => {
            setDraft(next);
            setSaved(false);
          }}
          onSubmitEditing={save}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={defaultBaseUrl}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
        {problem ? <Text style={[styles.error, { color: theme.unavailableText }]}>{problem}</Text> : null}
        {saved ? <Text style={[styles.ok, { color: theme.liveText }]}>Saved. The app now uses this address.</Text> : null}

        <View style={styles.buttonRow}>
          <Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.primary, { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[styles.primaryText, { color: theme.background }]}>Save</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            disabled={finding}
            style={[styles.secondary, { borderColor: theme.border }]}>
            <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>
              {finding ? 'Finding…' : 'Find automatically'}
            </Text>
          </Pressable>
        </View>

        <FactRow label="In use" value={baseUrl} />
        <FactRow label="Found by" value={SOURCE_LABEL[source]} tone={source === 'unreachable' ? 'unavailableText' : undefined} />
        <FactRow label="Fallback" value={defaultBaseUrl} />
      </Card>

      <Card>
        <SectionTitle>Health check</SectionTitle>
        <Pressable
          accessibilityRole="button"
          onPress={check}
          disabled={checking}
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.text, opacity: checking ? 0.6 : pressed ? 0.8 : 1 }]}>
          <Text style={[styles.primaryText, { color: theme.background }]}>{checking ? 'Checking…' : 'Check the API'}</Text>
        </Pressable>
        {checkResult ? (
          <View style={styles.result}>
            <StatusPill status={checkResult.ok ? 'live' : 'unavailable'} label={checkResult.ok ? 'Reachable' : 'Not reachable'} />
            <Text style={[styles.note, { color: theme.textSecondary }]}>{checkResult.message}</Text>
          </View>
        ) : null}
      </Card>

      <Banner title="About">
        SIGMA mobile is a read-only client for the SIGMA API. It shows the same historical records, with the
        same provenance rules, as the web client: every screen says where its data comes from and how old it
        is, missing weeks stay missing, and no screen presents a method&apos;s output or SIGI&apos;s answer as a
        finding.
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.two,
    fontSize: 14,
    marginTop: Spacing.two,
  },
  error: {
    fontSize: 13,
    marginTop: Spacing.one,
  },
  ok: {
    fontSize: 13,
    marginTop: Spacing.one,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  primary: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: {
    fontWeight: '600',
    fontSize: 15,
  },
  secondary: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontWeight: '600',
    fontSize: 15,
  },
  result: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
});
