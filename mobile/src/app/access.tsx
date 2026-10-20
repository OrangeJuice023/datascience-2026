import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchAccessMetrics } from '@/api/endpoints';
import { Screen } from '@/components/screen';
import { SigiNote, sigiStateForData } from '@/components/sigi';
import { Banner, Card, ChipGroup, ErrorState, FactRow, LoadingState, SectionTitle, StatusPill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

/**
 * ACCESS.
 *
 * Medication-access indicators per area and medicine. The scope block in
 * the payload is not decoration: the records behind this screen are
 * simulated, so the screen says what the data cannot support before it
 * shows what it can.
 */
export default function AccessScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();
  const [medicineId, setMedicineId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);

  const access = useResource((signal) => fetchAccessMetrics(baseUrl, {}, signal), [baseUrl]);

  const medicines = access.data?.medicines ?? [];
  const areas = access.data?.areas ?? [];
  const weeks = access.data?.weeks ?? [];

  const activeMedicine = medicineId ?? medicines[0]?.id ?? null;
  const activeArea = areaId ?? areas[0]?.id ?? null;

  const latestWeek = weeks[weeks.length - 1];

  const latestMetric = useMemo(() => {
    if (!access.data || !latestWeek || !activeMedicine || !activeArea) return null;
    return (
      access.data.metrics.find(
        (metric) =>
          metric.medicineId === activeMedicine &&
          metric.areaId === activeArea &&
          metric.periodStart === latestWeek.periodStart
      ) ?? null
    );
  }, [access.data, latestWeek, activeMedicine, activeArea]);

  const assessments = useMemo(() => {
    const all = access.data?.areasForAssessment ?? [];
    return activeArea ? all.filter((entry) => entry.areaId === activeArea) : all;
  }, [access.data, activeArea]);

  const refresh = () => access.reload();

  const loading = access.loading && !access.data;
  const failed = access.error && !access.data;

  return (
    <Screen
      title="ACCESS"
      subtitle="Medication access indicators by area and medicine."
      status={access.meta?.status}
      statusLabel="Prototype"
      onRefresh={refresh}
      refreshing={access.refreshing}>
      {loading ? <LoadingState label="Loading access metrics…" /> : null}
      {failed && access.error ? (
        <ErrorState message={access.error.message} onRetry={refresh} />
      ) : null}

      {access.data ? (
        <>
          <Banner tone="caution" title="What this data does not show">
            {access.data.scope.doesNotSupport.join(' ')}
          </Banner>

          <SigiNote state={sigiStateForData({ loading, failed: Boolean(failed), hasResult: Boolean(access.data) })} size={48}>
            Sigi is reading simulated inventory and search records. The figures below are a prototype
            of the access model, not measurements of medicine availability.
          </SigiNote>

          <Card>
            <SectionTitle>Medicine</SectionTitle>
            <ChipGroup
              options={medicines.map((m) => ({ value: m.id, label: m.name }))}
              selected={activeMedicine}
              onSelect={setMedicineId}
            />
          </Card>

          <Card>
            <SectionTitle>Area</SectionTitle>
            <ChipGroup
              options={areas.map((a) => ({ value: a.id, label: a.name }))}
              selected={activeArea}
              onSelect={setAreaId}
            />
          </Card>

          <Card>
            <SectionTitle
              action={
                latestWeek ? (
                  <Text style={[styles.week, { color: theme.textSecondary }]}>
                    {latestWeek.periodStart} → {latestWeek.periodEnd}
                  </Text>
                ) : null
              }>
              Latest week
            </SectionTitle>
            {latestMetric ? (
              <>
                <FactRow label="Access gap" value={latestMetric.accessGapLabel} tone={gapTone(latestMetric.accessGap)} />
                <FactRow label="Confidence" value={latestMetric.confidence} />
                <FactRow label="Facilities in area" value={String(latestMetric.facilities)} />
                <FactRow label="Reporting coverage" value={`${Math.round(latestMetric.facilityCoverage * 100)}%`} />
                <FactRow label="Confirmed available" value={String(latestMetric.confirmedAvailable)} />
                <FactRow label="Reported unavailable" value={String(latestMetric.reportedUnavailable)} />
                <FactRow label="Stale reports" value={String(latestMetric.staleInventory)} />
                <FactRow label="Unknown" value={String(latestMetric.unknownInventory)} />
                <FactRow label="Search events" value={String(latestMetric.searchDemand)} />
                <FactRow
                  label="Searches finding nothing nearby"
                  value={`${latestMetric.notFoundSearches} (${Math.round(
                    latestMetric.searchDemand ? (latestMetric.notFoundSearches / latestMetric.searchDemand) * 100 : 0
                  )}%)`}
                />
                <FactRow label="Demand vs area baseline" value={`${latestMetric.demandRatio.toFixed(2)}x`} />
                {latestMetric.reasons.map((reason) => (
                  <Text key={reason} style={[styles.bullet, { color: theme.textSecondary }]}>
                    • {reason}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                No metric for this medicine and area in the latest week.
              </Text>
            )}
          </Card>

          <Card>
            <SectionTitle>Areas for assessment</SectionTitle>
            {assessments.length === 0 ? (
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                No area is flagged for review in the latest week.
              </Text>
            ) : (
              assessments.map((entry) => (
                <View key={`${entry.areaId}-${entry.medicineId}`} style={styles.assessment}>
                  <View style={styles.assessmentHeader}>
                    <Text style={[styles.assessmentTitle, { color: theme.text }]}>
                      {entry.areaName} — {entry.medicineName}
                    </Text>
                    <StatusPill
                      status={entry.gap === 'elevated' ? 'unavailable' : entry.gap === 'moderate' ? 'demo' : 'not_connected'}
                      label={entry.gapLabel}
                    />
                  </View>
                  <Text style={[styles.note, { color: theme.textSecondary }]}>{entry.areaForAssessment}</Text>
                  {entry.observed.map((observation) => (
                    <Text key={observation} style={[styles.bullet, { color: theme.textSecondary }]}>
                      • {observation}
                    </Text>
                  ))}
                </View>
              ))
            )}
          </Card>

          <Card>
            <SectionTitle>Scope</SectionTitle>
            <FactRow label="Source" value={access.data.scope.source} />
            <FactRow label="Areas" value={String(access.data.scope.areas)} />
            <FactRow label="Facilities" value={String(access.data.scope.facilities)} />
            <FactRow label="Medicines" value={String(access.data.scope.medicines)} />
            <FactRow label="Weeks" value={String(access.data.scope.weeks)} />
            <Text style={[styles.note, { color: theme.textSecondary }]}>{access.data.scope.sourceNote}</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function gapTone(gap: string): 'live' | 'demo' | 'notConnected' | 'unavailable' {
  if (gap === 'elevated') return 'unavailable';
  if (gap === 'moderate') return 'demo';
  if (gap === 'insufficient_data') return 'notConnected';
  return 'live';
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  bullet: {
    fontSize: 13,
    lineHeight: 19,
  },
  week: {
    fontSize: 12,
  },
  assessment: {
    gap: 4,
    paddingVertical: Spacing.two,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
});
