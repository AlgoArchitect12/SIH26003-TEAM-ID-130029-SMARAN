import { CommonActions } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { DateOfBirthField } from '@components/onboarding/date-of-birth-field';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { Field } from '@components/ui/smaran-field';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { Languages, Regions, TextSizes, type Language, type Region } from '@db/schema.types';
import { getLanguageName, getRegionName, getTextSizeName, t } from '@i18n/index';
import { beginAddPerson, finishAddPerson, leavePatientForSelection, saveAdditionalPerson, selectActivePatient } from '@services/profile-switching.service';
import { capturePatientRequest } from '@/src/stores/patient-session.store';
import type { AccessibilityPreferences, ProfileDraft } from '@/src/stores/onboarding.store';
import { parseDateOfBirth } from '@/src/utils/date-of-birth';
import { normalizeIndianPhone, validateOptionalName, validatePreferredName } from '@/src/utils/validation';

export default function AddPersonScreen() {
  const router = useRouter();
  const navigation = useNavigation('/');
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof beginAddPerson>> | null>(null);
  const [chosenLanguage, setLanguage] = useState<Language | null>(null);
  const language = chosenLanguage ?? 'en';
  const [region, setRegion] = useState<Region | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({ preferredName: '', dateOfBirth: '', emergencyName: '', emergencyPhone: '' });
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({ textSize: 'large', highContrast: false, voiceGuidance: true, reducedMotion: false });
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    leavePatientForSelection();
    if ((navigation.getState()?.routes.length ?? 0) > 1) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'add-person', params: { view } }] }));
      return;
    }
    setFailed(false);
    void beginAddPerson().then(value => { if (active) setSetup(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, navigation, view]);
  const personList = () => router.replace({ pathname: '/profiles', params: { view } });
  const save = async () => {
    if (!setup || !chosenLanguage || !region || locked.current) return;
    locked.current = true; setBusy(true); setFailed(false);
    const current = capturePatientRequest();
    try {
      const profile = await saveAdditionalPerson(setup.id, draft, { ...preferences, language: chosenLanguage, region });
      if (current()) setSetup({ id: profile.id, profile });
    } catch { if (current()) setFailed(true); }
    finally { locked.current = false; if (current()) setBusy(false); }
  };
  const finish = async (open: boolean) => {
    if (!setup?.profile || locked.current) return;
    locked.current = true; setBusy(true); setFailed(false);
    try {
      if (open) {
        await selectActivePatient(setup.id);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: view === 'caregiver' ? 'caregiver/home' : 'patient' }] }));
      } else { await finishAddPerson(setup.id); personList(); }
    } catch { setFailed(true); }
    finally { locked.current = false; setBusy(false); }
  };
  const next = () => {
    try {
      if (step === 1) {
        validatePreferredName(draft.preferredName); validateOptionalName(draft.emergencyName); normalizeIndianPhone(draft.emergencyPhone);
        if (!parseDateOfBirth(draft.dateOfBirth)) throw new Error('Invalid birthday.');
      }
      setInvalid(false); setStep(n => n + 1);
    } catch { setInvalid(true); }
  };
  return <ScreenWrapper scroll><View style={{ gap: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
    <SmaranButton label={t(language, setup?.profile || step === 0 ? 'personList' : 'back')}
      accessibilityLabel={t(language, setup?.profile || step === 0 ? 'personList' : 'back')} disabled={busy} variant="outline"
      onPress={() => setup?.profile ? void finish(false) : step === 0 ? personList() : (setInvalid(false), setStep(n => n - 1))} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'addPerson')}</ThemedText>
    <ThemedText>{t(language, 'addPersonHint')}</ThemedText>
    {failed && <ThemedText accessibilityRole="alert">{t(language, 'addPersonFailed')}</ThemedText>}
    {!setup ? failed ? <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => setAttempt(n => n + 1)} />
      : <SmaranLoading label={t(language, 'loadingSetup')} /> : setup.profile ? <>
      <ThemedText type="cardHeading">{setup.profile.preferredName}</ThemedText>
      <ThemedText>{t(language, 'personSaved')}</ThemedText>
      <SmaranButton label={t(language, 'continuePerson', { name: setup.profile.preferredName })}
        accessibilityLabel={t(language, 'continuePerson', { name: setup.profile.preferredName })} loading={busy} disabled={busy} onPress={() => void finish(true)} />
    </> : <>
      <ThemedText>{t(language, 'stepProgress', { current: String(step + 1), total: '4' })}</ThemedText>
      {step === 0 && Languages.map(option => <SelectionCard key={option} title={getLanguageName(option)} icon="language"
        selected={chosenLanguage === option} selectedLabel={t(language, 'selected')} onPress={() => setLanguage(option)} />)}
      {step === 1 && <>
        <Field label={t(language, 'preferredName')} value={draft.preferredName} maxLength={80} autoCapitalize="words"
          onChangeText={preferredName => setDraft({ ...draft, preferredName })} />
        <DateOfBirthField language={language} value={draft.dateOfBirth} onChange={dateOfBirth => setDraft({ ...draft, dateOfBirth })}
          error={invalid && !parseDateOfBirth(draft.dateOfBirth) ? t(language, 'dobInvalid') : undefined} />
        <Field label={`${t(language, 'emergencyName')} (${t(language, 'optional')})`} value={draft.emergencyName} maxLength={80}
          onChangeText={emergencyName => setDraft({ ...draft, emergencyName })} />
        <Field label={`${t(language, 'emergencyPhone')} (${t(language, 'optional')})`} value={draft.emergencyPhone} maxLength={24} keyboardType="phone-pad"
          onChangeText={emergencyPhone => setDraft({ ...draft, emergencyPhone })} />
      </>}
      {step === 2 && Regions.map(option => <SelectionCard key={option} title={getRegionName(language, option)} icon="landscape"
        selected={region === option} selectedLabel={t(language, 'selected')} onPress={() => setRegion(option)} />)}
      {step === 3 && <>
        <ThemedText type="cardHeading">{t(language, 'textSize')}</ThemedText>
        {TextSizes.map(option => <SelectionCard key={option} title={getTextSizeName(language, option)} icon="text-fields"
          selected={preferences.textSize === option} selectedLabel={t(language, 'selected')} disabled={busy}
          onPress={() => setPreferences({ ...preferences, textSize: option })} />)}
        {(['voiceGuidance', 'reducedMotion'] as const).map(key => <SelectionCard key={key} icon={key === 'voiceGuidance' ? 'volume-up' : 'accessibility-new'} title={t(language, key)}
          description={t(language, preferences[key] ? 'on' : 'off')} selected={preferences[key]} selectedLabel={t(language, 'selected')}
          disabled={busy} onPress={() => setPreferences({ ...preferences, [key]: !preferences[key] })} />)}
      </>}
      {invalid && <ThemedText accessibilityRole="alert">{t(language, 'checkDetails')}</ThemedText>}
      <SmaranButton label={t(language, step === 3 ? 'saveFinish' : 'continue')} accessibilityLabel={t(language, step === 3 ? 'saveFinish' : 'continue')}
        disabled={busy || (step === 0 && !chosenLanguage) || (step === 2 && !region)} loading={busy} size="large"
        onPress={() => step === 3 ? void save() : next()} />
    </>}
  </View></ScreenWrapper>;
}
