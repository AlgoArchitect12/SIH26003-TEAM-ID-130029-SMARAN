import { capturePatientRequest, usePatientSessionStore } from '@/src/stores/patient-session.store';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { PageLayout, Radius, Spacing } from '@constants/layout';
import { t } from '@i18n/index';
import { PatientSelectionRequiredError, resolveActivePatient } from '@services/active-patient.service';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import type { NotificationResult } from '@services/my-day.service';

export { category } from '@/src/my-day/presets';
export function useMyDayPatient() {
  const router = useRouter();
  const revision = usePatientSessionStore(s => s.revision);
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let active = true;
    const current = capturePatientRequest();
    setFailed(false);
    setPatientId(null); setPatientName(undefined);
    void resolveActivePatient().then(result => {
      if (!active || !current()) return;
      if (result.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const store = useOnboardingStore.getState();
      store.setLanguage(result.settings.language);
      store.setRegion(result.settings.region);
      store.setAccessibilityPreferences({ highContrast: result.settings.highContrast, reducedMotion: result.settings.reducedMotion,
        textSize: result.settings.textSize, voiceGuidance: result.settings.voiceGuidance });
      setPatientId(result.profile.id);
      setPatientName(result.profile.preferredName);
    }).catch(error => {
      if (!active || !current()) return;
      if (error instanceof PatientSelectionRequiredError) router.replace('/profiles');
      else setFailed(true);
    });
    return () => { active = false; };
  }, [attempt, router, revision]);
  return { patientId, patientName, language, failed, retry };
}
export { Field } from '@components/ui/smaran-field';
export function NotificationNotice({ result, busy, onRetry, onAllow }: {
  result: NotificationResult | null; busy: boolean; onRetry: () => void; onAllow: () => void;
}) {
  const language = useOnboardingStore(s => s.language) ?? 'en';
  if (!result) return null;
  const key = result.failed ? 'dayNotificationFailed' : result.permission === 'granted' ? 'dayNotificationReady'
    : result.permission === 'unavailable' ? 'dayUnavailable' : 'dayNotificationFallback';
  return <View style={dayStyles.group}>
    <ThemedText type="cardHeading">{t(language, 'dayNotifications')}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{t(language, key)}</ThemedText>
    {result.permission === 'undetermined' && <SmaranButton label={t(language, 'dayAllow')} accessibilityLabel={t(language, 'dayAllow')} onPress={onAllow} disabled={busy} variant="outline" />}
    {(result.failed || result.permission === 'denied') && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={onRetry} disabled={busy} variant="outline" />}
    {result.permission === 'denied' && <SmaranButton label={t(language, 'dayNotificationSettings')} accessibilityLabel={t(language, 'dayNotificationSettings')}
      onPress={() => { void Linking.openSettings().catch(() => {}); }} disabled={busy} variant="outline" />}
  </View>;
}
export const dayStyles = StyleSheet.create({
  content: PageLayout.content,
  heading: PageLayout.heading,
  group: PageLayout.group,
  card: { gap: Spacing.md, padding: Spacing.lg, borderWidth: 2, borderRadius: Radius.card },
  category: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  input: { minHeight: 72, borderWidth: 2, borderRadius: 16, padding: 16, width: '100%' },
});
