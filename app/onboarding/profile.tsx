import { Field } from '@components/ui/smaran-field';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { DateOfBirthField } from '@components/onboarding/date-of-birth-field';
import { parseDateOfBirth } from '@/src/utils/date-of-birth';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { t } from '@i18n/index';
import {
  normalizeIndianPhone,
  validateOptionalName,
  validatePreferredName,
} from '@/src/utils/validation';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type ProfileErrors = Partial<
  Record<'dateOfBirth' | 'emergencyName' | 'emergencyPhone' | 'preferredName' | 'save', string>
>;

export default function ProfileScreen() {
  const router = useRouter();
  const accessibility = useOnboardingStore((state) => state.accessibility);
  const selectedLanguage = useOnboardingStore((state) => state.language);
  const language = selectedLanguage ?? 'en';
  const profile = useOnboardingStore((state) => state.profile);
  const role = useOnboardingStore((state) => state.role);
  const setProfileDraft = useOnboardingStore((state) => state.setProfileDraft);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const saveProfile = () => {
    const next: ProfileErrors = {};
    try { validatePreferredName(profile.preferredName); } catch { next.preferredName = t(language, 'nameRequired'); }
    try { validateOptionalName(profile.emergencyName); } catch { next.emergencyName = t(language, 'checkDetails'); }
    try { normalizeIndianPhone(profile.emergencyPhone); } catch { next.emergencyPhone = t(language, 'invalidPhone'); }
    if (!parseDateOfBirth(profile.dateOfBirth)) next.dateOfBirth = t(language, 'dobInvalid');
    if (!role || !selectedLanguage) next.save = t(language, 'checkDetails');
    setErrors(next);
    if (!Object.keys(next).length) router.push(role === 'caregiver' ? '/onboarding/caregiver' : '/onboarding/region');
  };

  return (
    <OnboardingScreen
      description={t(language, 'profileIntro')}
      language={language}
      onBack={() => router.dismissTo('/onboarding/accessibility')}
      showReadAloud={accessibility.voiceGuidance}
      step={4}
      title={t(language, 'profileTitle')}>
      <View style={styles.form}>
        <Field label={t(language, 'preferredName')} autoCapitalize="words" maxLength={80}
          value={profile.preferredName} onChangeText={preferredName => setProfileDraft({ preferredName })}
          placeholder={t(language, 'preferredNamePlaceholder')} />
        {errors.preferredName && <ThemedText accessibilityRole="alert">{errors.preferredName}</ThemedText>}
        <DateOfBirthField language={language} value={profile.dateOfBirth}
          onChange={dateOfBirth => setProfileDraft({ dateOfBirth })} error={errors.dateOfBirth} />
        <Field label={`${t(language, 'emergencyName')} (${t(language, 'optional')})`} autoCapitalize="words" maxLength={80}
          value={profile.emergencyName} onChangeText={emergencyName => setProfileDraft({ emergencyName })}
          placeholder={t(language, 'emergencyNamePlaceholder')} />
        {errors.emergencyName && <ThemedText accessibilityRole="alert">{errors.emergencyName}</ThemedText>}
        <Field label={`${t(language, 'emergencyPhone')} (${t(language, 'optional')})`} keyboardType="phone-pad" maxLength={24}
          value={profile.emergencyPhone} onChangeText={emergencyPhone => setProfileDraft({ emergencyPhone })}
          placeholder={t(language, 'emergencyPhonePlaceholder')} />
        {errors.emergencyPhone && <ThemedText accessibilityRole="alert">{errors.emergencyPhone}</ThemedText>}
      </View>

      {errors.save ? (
        <ThemedText accessibilityRole="alert">
          {errors.save}
        </ThemedText>
      ) : null}

      <SmaranButton accessibilityLabel={t(language, 'continue')} label={t(language, 'continue')}
        onPress={saveProfile} size="large" />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({ form: { gap: Spacing.lg } });
