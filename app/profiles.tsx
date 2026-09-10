import { CommonActions } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { t } from '@i18n/index';
import { leavePatientForSelection, listLocalPatients, selectActivePatient } from '@services/profile-switching.service';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export default function ProfilesScreen() {
  const router = useRouter();
  const navigation = useNavigation('/');
  const { view } = useLocalSearchParams<{ view?: string }>();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [data, setData] = useState<Awaited<ReturnType<typeof listLocalPatients>> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    leavePatientForSelection();
    if ((navigation.getState()?.routes.length ?? 0) > 1) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'profiles', params: { view } }] }));
      return;
    }
    setData(null); setFailed(false); setSelected(null);
    void listLocalPatients().then(result => {
      if (active) { setData(result); setSelected(result.activeId); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, navigation, view]);
  const profile = data?.profiles.find(person => person.id === selected);
  const open = async () => {
    if (!profile || locked.current) return;
    locked.current = true; setBusy(true); setFailed(false);
    try {
      await selectActivePatient(profile.id);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: view === 'caregiver' ? 'caregiver/home' : 'patient' }] }));
    } catch { setFailed(true); }
    finally { locked.current = false; setBusy(false); }
  };
  return <ScreenWrapper scroll><View style={{ gap: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'profilesTitle')}</ThemedText>
    <ThemedText>{t(language, 'profilesHint')}</ThemedText>
    {!data && !failed && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {failed && <View style={{ gap: 12 }} accessibilityRole="alert">
      <ThemedText>{t(language, 'profilesFailed')}</ThemedText>
      {!data && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => setAttempt(n => n + 1)} />}
    </View>}
    {data?.profiles.map(person => <SelectionCard key={person.id} title={person.preferredName} icon="person-outline"
      description={person.id === data.activeId ? t(language, 'currentPerson', { name: person.preferredName }) : undefined}
      selected={selected === person.id} selectedLabel={t(language, 'selected')} disabled={busy}
      onPress={() => { setSelected(person.id); setFailed(false); }} />)}
    {!!data?.profiles.length && <SmaranButton size="large" disabled={!profile || busy} loading={busy}
      label={profile ? t(language, 'continuePerson', { name: profile.preferredName }) : t(language, 'continue')}
      accessibilityLabel={profile ? t(language, 'continuePerson', { name: profile.preferredName }) : t(language, 'continue')}
      onPress={() => void open()} />}
    {data && <SmaranButton label={t(language, data.profiles.length ? 'addPerson' : 'homeReturnSetup')}
      accessibilityLabel={t(language, data.profiles.length ? 'addPerson' : 'homeReturnSetup')} disabled={busy} variant={data.profiles.length ? 'outline' : 'primary'}
      onPress={() => {
        if (data.profiles.length) router.replace({ pathname: '/add-person', params: { view } });
        else { useOnboardingStore.getState().resetOnboarding(); router.replace('/onboarding/role'); }
      }} />}
  </View></ScreenWrapper>;
}
