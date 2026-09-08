import { isPatientNavigationVisible } from '@/src/utils/patient-navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, type ComponentProps, type KeyboardEvent } from 'react';
import { ThemedText } from '@components/themed-text';
import { t, type TranslationKey } from '@i18n/index';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

const destinations = [
  { path: '/patient/home', label: 'navHome', icon: 'home' },
  { path: '/patient/games', label: 'navTrain', icon: 'psychology' },
  { path: '/patient/my-day', label: 'navDay', icon: 'event-note' },
  { path: '/patient/my-memories', label: 'navMemories', icon: 'photo-library' },
  { path: '/patient/menu', label: 'navMenu', icon: 'menu' },
] as const satisfies readonly { path: string; label: TranslationKey; icon: ComponentProps<typeof MaterialIcons>['name'] }[];

export function PatientNavigation() {
  const path = usePathname();
  const router = useRouter();
  const colors = useThemeColors();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const size = useOnboardingStore(s => s.accessibility.textSize);
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<string | null>(null);
  if (!isPatientNavigationVisible(path)) return null;
  const current = path === '/patient/home' ? 0 : path.startsWith('/patient/games') ? 1
    : path.startsWith('/patient/my-day') ? 2 : /^\/patient\/my-memor/u.test(path) ? 3 : 4;
  const open = (target: typeof destinations[number]['path']) => {
    if (path === target) return;
    // Keep Home beneath each section so hardware Back has a predictable destination.
    router.dismissTo('/patient/home');
    if (target !== '/patient/home') router.navigate(target);
  };
  return <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
    {destinations.map((item, index) => {
      const selected = current === index;
      return <Pressable key={item.path} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected}
        accessibilityLabel={t(language, item.label)} onFocus={() => setFocused(item.path)} onBlur={() => setFocused(null)}
        onPress={() => open(item.path)}
        {...(Platform.OS === 'web' ? { tabIndex: selected ? 0 as const : -1 as const,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            const next = event.key === 'ArrowRight' ? (index + 1) % destinations.length
              : event.key === 'ArrowLeft' ? (index + destinations.length - 1) % destinations.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? destinations.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
            tabs?.[next]?.focus(); open(destinations[next].path);
          },
        } : {})}
        style={({ pressed }) => [styles.item, {
          flex: item.label === 'navMemories' ? 1.6 : 1,
          backgroundColor: selected || pressed ? colors.surfaceMuted : colors.surface,
          borderTopColor: selected ? colors.primary : 'transparent',
        }, focused === item.path && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 3 }]}>
        <MaterialIcons name={item.icon} size={26} color={selected ? colors.tabIconSelected : colors.tabIconDefault}
          accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" />
        <ThemedText type="caption" style={{ textAlign: 'center', width: '100%', fontSize: size === 'extra-large' ? 20 : size === 'large' ? 18 : 16,
          lineHeight: size === 'extra-large' ? 26 : 24, fontWeight: selected ? '700' : '500', color: colors.text }}>{t(language, item.label)}</ThemedText>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 4, paddingHorizontal: 4, gap: 2 },
  item: { flex: 1, minWidth: 0, minHeight: 64, alignItems: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 8, borderTopWidth: 4, borderRadius: 8 },
});
