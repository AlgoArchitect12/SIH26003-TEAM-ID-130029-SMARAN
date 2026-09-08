import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { SmaranCard } from '@components/ui/smaran-card';
import { ThemedText } from '@components/themed-text';
import { t, type TranslationKey } from '@i18n/index';
import { useThemeColors } from '@/hooks/use-theme-color';

type Entry = { label: TranslationKey; icon: ComponentProps<typeof MaterialIcons>['name']; href: Href };
const groups: { title: TranslationKey; entries: Entry[] }[] = [
  { title: 'menuPatient', entries: [
    { label: 'myProfile', icon: 'person-outline', href: '/patient/profile' },
    { label: 'homeRegionTitle', icon: 'landscape', href: '/patient/my-home' },
    { label: 'homeMemoriesTitle', icon: 'photo-library', href: '/patient/my-memories' },
    { label: 'homeTrainTitle', icon: 'psychology', href: '/patient/games' },
    { label: 'homeDayTitle', icon: 'event-note', href: '/patient/my-day' },
    { label: 'homeCareTitle', icon: 'favorite-outline', href: '/caregiver/home' },
  ] },
  { title: 'menuSettings', entries: [
    { label: 'languageLabel', icon: 'language', href: { pathname: '/patient/settings', params: { section: 'language' } } },
    { label: 'appearance', icon: 'contrast', href: { pathname: '/patient/settings', params: { section: 'appearance' } } },
    { label: 'accessibility', icon: 'accessibility-new', href: { pathname: '/patient/settings', params: { section: 'accessibility' } } },
    { label: 'voiceGuidance', icon: 'volume-up', href: { pathname: '/patient/settings', params: { section: 'voice' } } },
  ] },
  { title: 'menuSupport', entries: [
    { label: 'help', icon: 'help-outline', href: { pathname: '/patient/support', params: { section: 'help' } } },
    { label: 'about', icon: 'info-outline', href: { pathname: '/patient/support', params: { section: 'about' } } },
  ] },
];
export default function MenuScreen() {
  const patient = useMyDayPatient();
  const router = useRouter();
  const colors = useThemeColors();
  return <PatientPage {...patient} title={t(patient.language, 'navMenu')}>
    {groups.map(group => <View key={group.title} style={{ gap: 12 }}>
      <ThemedText type="cardHeading">{t(patient.language, group.title)}</ThemedText>
      {group.entries.map(item => <SmaranCard key={item.label} accessibilityLabel={t(patient.language, item.label)}
        onPress={() => router.navigate(item.href)} padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <MaterialIcons name={item.icon} color={colors.icon} size={28} accessible={false} aria-hidden />
        <ThemedText style={{ flex: 1 }} type="defaultSemiBold">{t(patient.language, item.label)}</ThemedText>
        <MaterialIcons name="chevron-right" color={colors.icon} size={24} accessible={false} aria-hidden />
      </SmaranCard>)}
    </View>)}
  </PatientPage>;
}
