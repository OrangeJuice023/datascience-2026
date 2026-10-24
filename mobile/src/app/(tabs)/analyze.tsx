import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { fetchSummary } from '@/api/endpoints';
import { AccessPanel, useAccessData } from '@/components/analyze/access-panel';
import { LabPanel } from '@/components/analyze/lab-panel';
import { PolicyPanel } from '@/components/analyze/policy-panel';
import { historicalStatusLabel } from '@/components/format';
import { Screen, SettingsButton } from '@/components/screen';
import { SegmentedControl } from '@/components/ui';
import { useCopilot } from '@/hooks/use-copilot';
import { useResource } from '@/hooks/use-resource';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

type Segment = 'access' | 'policy' | 'lab';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'access', label: 'ACCESS' },
  { value: 'policy', label: 'Policy' },
  { value: 'lab', label: 'Lab' },
];

const SUBTITLE: Record<Segment, string> = {
  access: 'Where care is mapped, and what dengue medicines cost public hospitals.',
  policy: "Ask SIGI about a reporting unit, then check the sources it used.",
  lab: 'The national weekly trend, its coverage and its gaps.',
};

function isSegment(value: unknown): value is Segment {
  return value === 'access' || value === 'policy' || value === 'lab';
}

/**
 * Analyze: ACCESS, Policy and Lab, the same three views as the web app's
 * Analyze tab. The segment is a route parameter (`/analyze?tab=policy`), so
 * Overview and Explore can link straight to one. The SIGI conversation is
 * held here rather than in the Policy view, so switching to ACCESS and back
 * keeps it; changing the reporting unit starts a new one.
 */
export default function AnalyzeScreen() {
  const { baseUrl } = useSettings();
  const { selectedUnit } = useUnits();
  const params = useLocalSearchParams<{ tab?: string }>();
  const segment: Segment = isSegment(params.tab) ? params.tab : 'access';

  const unitId = selectedUnit?.id ?? null;
  const access = useAccessData(baseUrl, unitId);
  const copilot = useCopilot(baseUrl, unitId);
  const summary = useResource((signal) => fetchSummary(baseUrl, undefined, signal), [baseUrl]);

  const select = (value: Segment) => router.setParams({ tab: value });

  const control = (
    <SegmentedControl options={SEGMENTS} selected={segment} onSelect={select} accessibilityLabel="Analyze views" />
  );

  if (segment === 'access') {
    const { units, medicines } = access;
    return (
      <Screen
        title="Analyze"
        subtitle={SUBTITLE.access}
        status={units.meta?.status}
        statusLabel={units.meta?.status === 'live' ? 'Real data · snapshot' : undefined}
        headerAction={<SettingsButton />}
        onRefresh={() => {
          units.reload();
          medicines.reload();
        }}
        refreshing={units.refreshing || medicines.refreshing}
        staleError={(units.stale ? units.error?.message : null) ?? (medicines.stale ? medicines.error?.message : null)}>
        {control}
        <AccessPanel data={access} />
      </Screen>
    );
  }

  if (segment === 'policy') {
    return (
      <Screen
        title="Analyze"
        subtitle={SUBTITLE.policy}
        status="demo"
        statusLabel="AI-generated · verify"
        headerAction={<SettingsButton />}
        onRefresh={copilot.clearError}>
        {control}
        <PolicyPanel copilot={copilot} place={selectedUnit?.name ?? null} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Analyze"
      subtitle={SUBTITLE.lab}
      status={summary.meta?.status}
      statusLabel={historicalStatusLabel(summary.meta?.status)}
      headerAction={<SettingsButton />}
      onRefresh={summary.reload}
      refreshing={summary.refreshing}
      staleError={summary.stale ? summary.error?.message : null}>
      {control}
      <LabPanel summary={summary} />
    </Screen>
  );
}
