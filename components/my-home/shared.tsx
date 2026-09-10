import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import type { Language, Region } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { isRegionalState, type RegionalCategory, type RegionalContentItem } from '@/src/my-home/content';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export const regionalCategoryKeys: Record<RegionalCategory, TranslationKey> = {
  nature: 'regionalNature', tradition: 'regionalTradition', craft: 'regionalCraft',
  everyday: 'regionalEveryday', landmark: 'regionalLandmark',
};

// Read the persisted patient's region, independently of their language or onboarding draft.
export function useMyHomePatient() {
  const focused = useIsFocused();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [state, setState] = useState<Region | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    const current = capturePatientRequest();
    setStatus('loading'); setState(null);
    void resolveActivePatient().then(result => {
      if (!active || !current()) return;
      if (result.status !== 'ready') { setStatus('invalid'); return; }
      const store = useOnboardingStore.getState();
      store.setLanguage(result.settings.language);
      store.setAccessibilityPreferences({ highContrast: result.settings.highContrast, reducedMotion: result.settings.reducedMotion,
        textSize: result.settings.textSize, voiceGuidance: result.settings.voiceGuidance });
      if (!isRegionalState(result.settings.region)) { setStatus('invalid'); return; }
      setState(result.settings.region); setStatus('ready');
    }).catch(() => { if (active && current()) setStatus('failed'); });
    return () => { active = false; };
  }, [attempt, focused]);
  return { state, status, language, retry: () => setAttempt(n => n + 1) };
}

export function RegionalRecovery({ status, language, retry }: {
  status: 'loading' | 'invalid' | 'failed'; language: Language; retry: () => void;
}) {
  if (status === 'loading') return <SmaranLoading label={t(language, 'loadingSetup')} />;
  return <View style={homeStyles.group}>
    <ThemedText accessibilityRole="alert">
      {t(language, status === 'invalid' ? 'regionalInvalid' : 'regionalFailed')}
    </ThemedText>
    <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={retry} />
  </View>;
}

export function RegionalImage({ item, language }: { item: RegionalContentItem; language: Language }) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  return <View style={homeStyles.group}>
    {!failed && <Image source={item.imageAsset} accessible accessibilityLabel={item.imageDescription}
      contentFit="contain" transition={0} onError={() => setFailed(true)}
      style={[homeStyles.image, { backgroundColor: colors.surface, borderColor: colors.border }]} />}
    {failed && <ThemedText accessibilityLiveRegion="polite">{t(language, 'regionalImageMissing')}</ThemedText>}
  </View>;
}

export const homeStyles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 24 },
  group: { gap: 16 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, borderWidth: 1 },
});
