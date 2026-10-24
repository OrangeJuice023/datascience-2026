import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The tab bar.
 *
 * The same three destinations as the web app: Overview, Explore (one
 * reporting unit's record and the national series) and Analyze (ACCESS,
 * Policy and Lab). Settings is a utility, reached from the gear in each
 * screen's header rather than from a tab of its own.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const icon = (name: keyof typeof MaterialCommunityIcons.glyphMap) => (
    <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name={name} />
  );

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('home-variant-outline')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('map-search-outline')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analyze">
        <NativeTabs.Trigger.Label>Analyze</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('chart-box-outline')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
