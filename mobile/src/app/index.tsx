import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchHealth, fetchSources } from '@/api/endpoints';
import { Screen } from '@/components/screen';
import { SigiNote, sigiStateForData } from '@/components/sigi';
import { Banner, Card, ErrorState, FactRow, LoadingState, SectionTitle, StatusPill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

/**
 * Overview.
 *
 * Answers three questions before anything else: which API am I talking to,
 * is that API healthy, and what kind of data does it have? A reader who
 * cannot answer those cannot use the rest of the app responsibly.
 */
export default function OverviewScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();

  const health = useResource(
    (signal) => fetchHealth(baseUrl, signal),
    [baseUrl]
  );
  const sources = useResource((signal) => fetchSources(baseUrl, signal), [baseUrl]);

  const refresh = () => {
    health.reload();
    sources.reload();
  };

  const loading = health.loading && !health.data;
  const failed = health.error && !health.data;

  return (
    <Screen
      title="SIGMA"
      subtitle="Surveillance context and access indicators for public-health review."
      status={health.meta?.status}
      onRefresh={refresh}
      refreshing={health.refreshing}>
      {loading ? <LoadingState label="Contacting the API…" /> : null}
      {failed && health.error ? (
        <ErrorState message={health.error.message} onRetry={refresh} />
      ) : null}

      <SigiNote
        state={sigiStateForData({
          loading: loading,
          failed: Boolean(failed),
          hasResult: Boolean(health.data),
        })}>
        {health.data
          ? `Sigi is with you. ${health.data.dataSources.connected} connected sources, ${health.data.dataSources.demo} demo, ${health.data.dataSources.planned} planned. The anomaly engine is not connected to this API, and the access figures are simulated.`
          : 'Sigi is waiting for the API. Nothing on this screen describes current conditions until the API answers.'}
      </SigiNote>

      {health.data ? (
        <>
          <Card>
            <SectionTitle>API</SectionTitle>
            <FactRow label="Base URL" value={baseUrl} />
            <FactRow label="Service" value={`${health.data.service} ${health.data.version}`} />
            <FactRow
              label="Status"
              value={health.data.status === 'ok' ? 'OK' : 'Degraded'}
              tone={health.data.status === 'ok' ? 'live' : 'demo'}
            />
            <FactRow
              label="Model provider configured"
              value={health.data.configuration.aiProviderConfigured ? 'Yes' : 'No'}
              tone={health.data.configuration.aiProviderConfigured ? undefined : 'notConnected'}
            />
            <FactRow
              label="Map tiles configured"
              value={health.data.configuration.mapTilesConfigured ? 'Yes' : 'No'}
              tone={health.data.configuration.mapTilesConfigured ? undefined : 'notConnected'}
            />
          </Card>

          <Card>
            <SectionTitle>Services</SectionTitle>
            {health.data.services.map((service) => (
              <View key={service.id} style={styles.serviceRow}>
                <View style={styles.serviceHeader}>
                  <Text style={[styles.serviceName, { color: theme.text }]}>{service.name}</Text>
                  <StatusPill
                    status={service.status === 'ok' ? 'live' : service.status === 'disabled' ? 'not_connected' : 'unavailable'}
                    label={service.status === 'ok' ? 'OK' : service.status === 'disabled' ? 'Disabled' : 'Degraded'}
                  />
                </View>
                <Text style={[styles.serviceNote, { color: theme.textSecondary }]}>{service.note}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>Data sources</SectionTitle>
            <FactRow label="Connected" value={String(health.data.dataSources.connected)} tone="live" />
            <FactRow label="Demo" value={String(health.data.dataSources.demo)} tone="demo" />
            <FactRow label="Planned" value={String(health.data.dataSources.planned)} tone="notConnected" />
          </Card>
        </>
      ) : null}

      <Banner title="What this app reports">
        SIGMA surfaces observed surveillance records, prototype access indicators, and prompts for human
        review. It does not confirm outbreaks, diagnose patients, or prescribe policy. Every screen states
        whether its data is live, demo, or not connected.
      </Banner>

      {sources.data ? (
        <Card>
          <SectionTitle>Source catalogue</SectionTitle>
          {sources.data.sources.map((source) => (
            <View key={source.id} style={styles.serviceRow}>
              <View style={styles.serviceHeader}>
                <Text style={[styles.serviceName, { color: theme.text }]}>{source.name}</Text>
                <StatusPill
                  status={source.status === 'connected' ? 'live' : source.status === 'demo' ? 'demo' : 'not_connected'}
                  label={source.status === 'connected' ? 'Connected' : source.status === 'demo' ? 'Demo' : 'Planned'}
                />
              </View>
              <Text style={[styles.serviceNote, { color: theme.textSecondary }]}>{source.purpose}</Text>
              <Text style={[styles.serviceNote, { color: theme.textSecondary }]}>{source.scope}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  serviceRow: {
    gap: 4,
    paddingVertical: Spacing.two,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  serviceNote: {
    fontSize: 13,
    lineHeight: 19,
  },
});
