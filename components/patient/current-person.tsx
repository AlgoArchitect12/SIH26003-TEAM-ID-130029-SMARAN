import { CommonActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { leavePatientForSelection } from '@services/profile-switching.service';

export function CurrentPerson({ name, language, caregiver = false }: { name?: string; language: Language; caregiver?: boolean }) {
  const navigation = useNavigation('/');
  return <View style={{ gap: 12 }}>
    {name && <ThemedText type="cardHeading">{t(language, caregiver ? 'viewingPerson' : 'currentPerson', { name })}</ThemedText>}
    <SmaranButton label={t(language, 'switchPerson')} accessibilityLabel={t(language, 'switchPerson')} variant="outline"
      onPress={() => {
        leavePatientForSelection();
        // Discard every patient/caregiver screen and editor before choosing another person.
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'profiles', params: { view: caregiver ? 'caregiver' : 'patient' } }] }));
      }} />
  </View>;
}
