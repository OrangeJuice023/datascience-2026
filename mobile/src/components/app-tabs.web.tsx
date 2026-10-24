import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabListProps,
} from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, View, StyleSheet, type PressableInstance, type PressableProps } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

const TABS = [
  { name: 'index', href: '/', label: 'Overview', icon: 'home-variant-outline' },
  { name: 'explore', href: '/explore', label: 'Explore', icon: 'map-search-outline' },
  { name: 'analyze', href: '/analyze', label: 'Analyze', icon: 'chart-box-outline' },
] as const;

/**
 * The web tab bar. Mirrors the native tab bar: the same three destinations in
 * a full-width bar along the bottom, an icon over a short label, the current
 * tab marked by ink and a neutral fill. Three equal tabs fit a 390px screen
 * with room to spare. Settings is the gear in each screen's header. Content
 * scrolls behind the bar, never under a floating pill at the top.
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
  const colors = useTheme();

  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <View style={[styles.tabInner, isFocused && { backgroundColor: colors.backgroundSelected }]}>
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          color={isFocused ? colors.text : colors.textSecondary}
        />
        <ThemedText
          type="small"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={[styles.label, isFocused && styles.labelActive]}
          numberOfLines={1}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
});

export function CustomTabList(props: TabListProps) {
  const colors = useTheme();
  return (
    <View
      {...props}
      style={[styles.tabListContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.two,
  },
  tab: {
    flex: 1,
    minWidth: 0,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  labelActive: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
