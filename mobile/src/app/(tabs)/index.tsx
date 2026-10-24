import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { fetchSummary } from '@/api/endpoints';
import { formatCount, formatIsoDate, historicalStatusLabel, weeksLabel } from '@/components/format';
import { Screen, SettingsButton } from '@/components/screen';
import { SigiNote, sigiStateForData } from '@/components/sigi';
import { Banner, Card, ErrorState, FactRow, LinkRow, LoadingState, SectionTitle } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

/**
 * Overview.
 *
 * What SIGMA is, how much data is behind it, and where to go next. Every
 * figure comes from the API: the national series' coverage from
 * /dengue/summary and the reporting-unit record from /dengue/units. Both are
 * historical, and the screen says so before anything else.
 */
export default function OverviewScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();
  const { resource: units } = useUnits();

  // One weekly point is enough here: the coverage block always describes the whole series.
  const summary = useResource((signal) => fetchSummary(baseUrl, 1, signal), [baseUrl]);

  const refresh = () => {
    summary.reload();
    units.reload();
  };

  const loading = (summary.loading && !summary.data) || (units.loading && !units.data);
  const failed = Boolean(summary.error && !summary.data && units.error && !units.data);
  const series = summary.data?.series;
  const scope = units.data?.scope;
  const staleError = (summary.stale ? summary.error?.message : null) ?? (units.stale ? units.error?.message : null);

  return (
    <Screen
      title="SIGMA"
      subtitle="Dengue early-warning evidence for the Philippines, from historical surveillance records."
      status={summary.meta?.status}
      statusLabel={historicalStatusLabel(summary.meta?.status)}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={summary.refreshing || units.refreshing}
      staleError={staleError}>
      <SigiNote state={sigiStateForData({ loading, failed, hasResult: Boolean(series || scope) })}>
        {series || scope
          ? 'Sigi is with you. Everything here is a past record: the newest week SIGMA holds is shown below, and nothing describes this week.'
          : loading
            ? 'Sigi is contacting the API…'
            : 'Sigi is waiting for the API. Nothing on this screen describes current conditions.'}
      </SigiNote>

      <Card>
        <SectionTitle>What SIGMA is</SectionTitle>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          SIGMA puts weekly dengue reports for each Philippine reporting unit next to two ways of spotting a rise:
          the CDC EARS early-warning method and the DOH alert and epidemic thresholds. Beside them it shows where
          care is mapped, what dengue medicines cost public hospitals, and the policy evidence SIGI can cite.
        </Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          It works on historical data, not real-time reports, and it does not declare outbreaks or make decisions.
        </Text>
      </Card>

      {loading ? <LoadingState label="Loading coverage…" /> : null}

      {summary.error && !summary.data ? (
        <ErrorState message={`National series: ${summary.error.message}`} onRetry={summary.reload} />
      ) : null}
      {series && summary.data ? (
        <Card>
          <SectionTitle>National series</SectionTitle>
          <FactRow label="Source" value={series.source.name} />
          <FactRow label="Coverage" value={`${formatIsoDate(series.coverage.from)} – ${formatIsoDate(series.coverage.to)}`} />
          <FactRow
            label="Weeks recorded"
            value={`${formatCount(series.coverage.recordedWeeks)} of ${formatCount(series.coverage.weeks)}`}
          />
          <FactRow
            label="Weeks missing"
            value={weeksLabel(series.coverage.weeks - series.coverage.recordedWeeks)}
            tone="notConnected"
          />
          <FactRow label="Level" value="National, weekly" />
        </Card>
      ) : null}

      {units.error && !units.data ? (
        <ErrorState message={`Reporting units: ${units.error.message}`} onRetry={units.reload} />
      ) : null}
      {scope ? (
        <Card>
          <SectionTitle>Reporting units</SectionTitle>
          <FactRow label="Source" value={scope.source} />
          <FactRow label="Units" value={formatCount(scope.units)} />
          <FactRow label="Coverage" value={`${formatIsoDate(scope.period.from)} – ${formatIsoDate(scope.period.to)}`} />
          <FactRow label="Weeks" value={formatCount(scope.period.weeks)} />
          <FactRow
            label="Epi years summarised"
            value={`${scope.period.epiYears[0]}–${scope.period.epiYears[scope.period.epiYears.length - 1]}`}
          />
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            A reporting unit is a province, a province remainder (the province minus its separately reported
            cities), a city or Pateros. Missing and suspect weeks are no data, never zero.
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Where to go</SectionTitle>
        <LinkRow
          title="Explore"
          description="Pick a reporting unit and see its cases, EARS alarms and DOH-threshold weeks by year."
          onPress={() => router.navigate('/explore')}
        />
        <LinkRow
          title="Analyze · ACCESS"
          description="Mapped hospitals, clinics, pharmacies and labs, and DOH medicine prices."
          onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'access' } })}
        />
        <LinkRow
          title="Analyze · Policy"
          description="Ask SIGI about a unit; every answer lists the evidence it used."
          onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'policy' } })}
        />
        <LinkRow
          title="Analyze · Lab"
          description="The national weekly trend, its coverage and its gaps."
          onPress={() => router.navigate({ pathname: '/analyze', params: { tab: 'lab' } })}
        />
      </Card>

      <Banner title="What SIGMA does not do">
        It does not confirm outbreaks, diagnose patients, report medicine stock or prescribe policy. Its counts are
        a hackathon prototype&apos;s reading of public records, not a validated public-health claim.
      </Banner>

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        API in use: {baseUrl}. Change it with the gear at the top.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
