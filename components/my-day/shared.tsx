import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { getScaledTypography } from '@constants/typography';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import type { ReminderType } from '@/src/my-day/types';
import type { NotificationResult } from '@services/my-day.service';

export const category: Record<ReminderType, { key: TranslationKey; icon: ComponentProps<typeof MaterialIcons>['name'] }> = {
  medicine: { key: 'dayMedicine', icon: 'medication' }, hydration: { key: 'dayWater', icon: 'water-drop' },
  activity: { key: 'dayActivity', icon: 'directions-walk' }, appointment: { key: 'dayAppointment', icon: 'event' },
  custom: { key: 'dayOther', icon: 'notifications-none' },
};
export function useMyDayPatient() {
  const router = useRouter();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  const [patientId, setPatientId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void resolveActivePatient().then(result => {
      if (!active) return;
      if (result.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const store = useOnboardingStore.getState();
      store.setLanguage(result.settings.language);
      store.setAccessibilityPreferences({ highContrast: result.settings.highContrast, reducedMotion: result.settings.reducedMotion,
        textSize: result.settings.textSize, voiceGuidance: result.settings.voiceGuidance });
      setPatientId(result.profile.id);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, router]);
  return { patientId, language, failed, retry };
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useThemeColors();
  const size = useTextSize();
  return <View style={dayStyles.group}>
    <ThemedText>{label}</ThemedText>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.textSecondary}
      style={[dayStyles.input, getScaledTypography('body', size), { color: colors.text, backgroundColor: colors.surface, borderColor: colors.primary }, props.style]} />
  </View>;
}
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
  </View>;
}
export const dayStyles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 24 },
  group: { gap: 12 },
  card: { gap: 16, padding: 20, borderWidth: 2, borderRadius: 24 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  input: { minHeight: 72, borderWidth: 2, borderRadius: 16, padding: 16, width: '100%' },
});
