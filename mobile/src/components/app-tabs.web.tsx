import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabListProps,
} from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, View, useColorScheme, StyleSheet, type PressableInstance, type PressableProps } from 'react-native';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const TABS = [
  { name: 'overview', href: '/', label: 'Overview', icon: 'shield-check-outline' },
  { name: 'dengue', href: '/dengue', label: 'Dengue', icon: 'virus-outline' },
  { name: 'access', href: '/access', label: 'Access', icon: 'pill' },
  { name: 'policy', href: '/policy', label: 'Policy', icon: 'chat-processing-outline' },
  { name: 'settings', href: '/settings', label: 'Settings', icon: 'cog-outline' },
] as const;

/**
 * The web tab bar. Mirrors the native tab bar so both platforms show the
 * same five destinations.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  isFocused?: boolean;
  href?: string;
  icon: string;
  children?: React.ReactNode;
};

export const TabButton = forwardRef<PressableInstance, TabButtonProps>(function TabButton(
  { children, isFocused, icon, href, ...props },
  ref
) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Pressable
      {...props}
      ref={ref}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={16}
          color={isFocused ? colors.text : colors.textSecondary}
        />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
});

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
