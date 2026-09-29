import { capturePatientRequest, usePatientSessionStore } from '@/src/stores/patient-session.store';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { PageLayout, Radius } from '@constants/layout';
import type { Language, Region } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { imageCredits, isRegionalState, type RegionalCategory, type RegionalContentItem } from '@/src/my-home/content';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export const regionalCategoryKeys: Record<RegionalCategory, TranslationKey> = {
  nature: 'regionalNature', tradition: 'regionalTradition', craft: 'regionalCraft',
  everyday: 'regionalEveryday', landmark: 'regionalLandmark',
};

// Read the persisted patient's region, independently of their language or onboarding draft.
export function useMyHomePatient() {
  const focused = useIsFocused();
  const revision = usePatientSessionStore(s => s.revision);
  const switching = usePatientSessionStore(s => s.switching);
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [state, setState] = useState<Region | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    const current = capturePatientRequest();
    setStatus('loading'); setState(null);
    if (switching) return;
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
  }, [attempt, focused, revision, switching]);
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
  const [loaded, setLoaded] = useState(false);
  const credit = imageCredits[item.imageCredit];
  useEffect(() => { setFailed(false); setLoaded(false); }, [item.id]);
  return <View style={homeStyles.group}>
    {!failed && <View style={[homeStyles.image, { aspectRatio: credit.width / credit.height, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Image source={item.imageAsset} accessible accessibilityLabel={item.imageDescription}
        contentFit="contain" contentPosition="center" recyclingKey={item.id} transition={0}
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={StyleSheet.absoluteFillObject} />
      {!loaded && <View style={StyleSheet.absoluteFillObject}><SmaranLoading label={t(language, 'memoryPhotoLoading')} /></View>}
    </View>}
    {failed && <ThemedText accessibilityLiveRegion="polite">{t(language, 'regionalImageMissing')}</ThemedText>}
  </View>;
}

export const homeStyles = StyleSheet.create({
  content: PageLayout.content,
  heading: PageLayout.heading,
  group: PageLayout.group,
  image: { width: '100%', borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
});
