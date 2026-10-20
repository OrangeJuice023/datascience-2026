import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The tab bar.
 *
 * Five destinations, each mapping to one part of the API: overview, the
 * dengue series, ACCESS indicators, policy, and settings.
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
        <NativeTabs.Trigger.Icon src={icon('shield-check-outline')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dengue">
        <NativeTabs.Trigger.Label>Dengue</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('virus-outline')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="access">
        <NativeTabs.Trigger.Label>Access</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('pill')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="policy">
        <NativeTabs.Trigger.Label>Policy</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('chat-processing-outline')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={icon('cog-outline')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
