import { useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SelectionCard } from '@components/onboarding/selection-card';
import { SmaranCard } from '@components/ui/smaran-card';
import { AppearanceChoices } from '@components/ui/appearance-choices';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { patientRepository } from '@db/repositories/patient.repository';
import { Languages, TextSizes, type UpdatePatientSettingsInput } from '@db/schema.types';
import { getLanguageName, getTextSizeName, t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export default function SettingsScreen() {
  const patient = useMyDayPatient();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const language = patient.language;
  const preferences = useOnboardingStore(s => s.accessibility);
  const locked = useRef(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const title = t(language, section === 'language' ? 'languageLabel' : section === 'appearance' ? 'appearance'
    : section === 'voice' ? 'voiceGuidance' : 'accessibility');
  const save = async (input: UpdatePatientSettingsInput) => {
    if (locked.current || !patient.patientId) return;
    locked.current = true; setStatus('saving');
    try {
      const saved = await patientRepository.updateSettings(patient.patientId, input);
      const store = useOnboardingStore.getState();
      store.setLanguage(saved.language); store.setAccessibilityPreferences({ textSize: saved.textSize,
        reducedMotion: saved.reducedMotion, highContrast: saved.highContrast, voiceGuidance: saved.voiceGuidance });
      setStatus('saved');
    } catch { setStatus('failed'); }
    finally { locked.current = false; }
  };
  return <PatientPage {...patient} title={title}>
    <ThemedText>{t(language, 'settingsIntro')}</ThemedText>
    {section === 'appearance' ? <AppearanceChoices language={language} /> : section === 'language' ? Languages.map(option =>
      <SelectionCard key={option} icon="language" title={getLanguageName(option)} selectedLabel={t(language, 'selected')}
        disabled={status === 'saving'}
        selected={language === option} onPress={() => void save({ language: option })} />)
      : <View style={{ gap: 16 }}>
        {section !== 'voice' && <>
          <ThemedText type="cardHeading">{t(language, 'textSize')}</ThemedText>
          {TextSizes.map(option => <SelectionCard key={option} icon="text-fields" title={getTextSizeName(language, option)}
            disabled={status === 'saving'}
            selectedLabel={t(language, 'selected')} selected={preferences.textSize === option} onPress={() => void save({ textSize: option })} />)}
          <ThemedText>{t(language, 'previewBody')}</ThemedText>
        </>}
        {(section === 'voice' ? ['voiceGuidance'] as const : ['reducedMotion'] as const).map(key => <SmaranCard key={key}
          accessibilityRole="switch" checked={preferences[key]} selected={preferences[key]} disabled={status === 'saving'}
          accessibilityLabel={`${t(language, key)}. ${t(language, preferences[key] ? 'on' : 'off')}`}
          onPress={() => void save({ [key]: !preferences[key] })}>
          <ThemedText type="cardHeading">{t(language, key)}</ThemedText>
          <ThemedText>{t(language, preferences[key] ? 'on' : 'off')}</ThemedText>
        </SmaranCard>)}
        {section === 'voice' && <ReadScreenButton language={language} text={t(language, 'previewBody')} />}
      </View>}
    {status !== 'idle' && <ThemedText accessibilityLiveRegion="polite" accessibilityRole={status === 'failed' ? 'alert' : undefined}>
      {t(language, status === 'saving' ? 'saving' : status === 'saved' ? 'saved' : 'settingsSaveFailed')}
    </ThemedText>}
  </PatientPage>;
}
