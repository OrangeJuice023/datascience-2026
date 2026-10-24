import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { SOURCE_LABEL } from '@/api/discovery';
import { BOUNDARIES_ATTRIBUTION } from '@/api/geo';
import { CloseButton, Screen } from '@/components/screen';
import { Banner, Card, FactRow, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';
import { useUnits } from '@/state/units-context';

/**
 * About these numbers: where each figure on Overview and Explore comes from,
 * and what it must not be read as.
 */
export default function AboutScreen() {
  const theme = useTheme();
  const { baseUrl, source } = useSettings();
  const { resource: units } = useUnits();
  const note = [styles.note, { color: theme.textSecondary }];

  return (
    <Screen title="About these numbers" subtitle="Historical surveillance records. Not a forecast." headerAction={<CloseButton />}>
      <Card>
        <SectionTitle>National weekly cases</SectionTitle>
        <Text style={note}>
          The tiles and the line on Overview are the national weekly series from OpenDengue v1.3 (CC BY 4.0), cut to
          2016–2021, the years the reporting-unit data covers. A week with no record is left out of the totals and drawn
          as a gap; it is never counted as zero cases.
        </Text>
      </Card>
      <Card>
        <SectionTitle>Reporting units</SectionTitle>
        <Text style={note}>
          The map and the unit figures come from the DOH Epidemiology Bureau data published on HDX by Cirrolytix (CC BY),
          2016-01-10 to 2021-01-03, for 126 reporting units: 59 provinces, 22 province remainders (a province minus its
          separately reported cities), 44 cities and Pateros. Missing weeks and the 665 suspected cases/deaths swap rows
          are no data.
        </Text>
        {units.data ? <FactRow label="Units" value={String(units.data.scope.units)} /> : null}
      </Card>
      <Card>
        <SectionTitle>Signals</SectionTitle>
        <Text style={note}>
          EARS C1, C2 and C3 compare each unit with its own recent weeks; the DOH thresholds compare a week with the same
          week in the three previous years. Both flag weeks to look at. Neither confirms an outbreak, and a unit with no
          computable result is shown as &quot;No result&quot;, not as &quot;No signal&quot;.
        </Text>
      </Card>
      <Card>
        <SectionTitle>Sources and the API</SectionTitle>
        <FactRow label="API" value={baseUrl} />
        <FactRow label="Found by" value={SOURCE_LABEL[source]} />
        <Text style={note}>{BOUNDARIES_ATTRIBUTION}. Map positions are label points inside each unit, not where cases occurred.</Text>
      </Card>
      <Banner title="Prototype">
        SIGMA is a hackathon prototype&apos;s reading of public records, not a validated public-health claim.
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 14, lineHeight: 20 },
});
