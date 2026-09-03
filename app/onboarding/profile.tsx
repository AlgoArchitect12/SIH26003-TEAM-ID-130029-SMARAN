import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Colors } from '@constants/colors';
import { Radius, Spacing } from '@constants/layout';
import { AgeBrackets } from '@db/schema.types';
import { patientRepository } from '@db/repositories/patient.repository';
import { t } from '@i18n/index';
import {
  SecureStorageKeys,
  setSecureValue,
} from '@services/secure-storage.service';
import {
  normalizeIndianPhone,
  validateOptionalName,
  validatePreferredName,
} from '@/src/utils/validation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type ProfileErrors = Partial<
  Record<'emergencyName' | 'emergencyPhone' | 'preferredName' | 'save', string>
>;

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const accessibility = useOnboardingStore((state) => state.accessibility);
  const selectedLanguage = useOnboardingStore((state) => state.language);
  const language = selectedLanguage ?? 'en';
  const profile = useOnboardingStore((state) => state.profile);
  const region = useOnboardingStore((state) => state.region);
  const role = useOnboardingStore((state) => state.role);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const setProfileDraft = useOnboardingStore((state) => state.setProfileDraft);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const submissionLocked = useRef(false);
  const colors = Colors[colorScheme];

  const saveProfile = async () => {
    if (submissionLocked.current) {
      return;
    }

    const validationErrors: ProfileErrors = {};
    let preferredName = '';
    let emergencyName: string | null = null;
    let emergencyPhone: string | null = null;

    try {
      preferredName = validatePreferredName(profile.preferredName);
    } catch {
      validationErrors.preferredName = t(language, 'nameRequired');
    }

    try {
      emergencyName = validateOptionalName(profile.emergencyName);
    } catch {
      validationErrors.emergencyName = t(language, 'checkDetails');
    }

    try {
      emergencyPhone = normalizeIndianPhone(profile.emergencyPhone);
    } catch {
      validationErrors.emergencyPhone = t(language, 'invalidPhone');
    }

    if (
      role !== 'patient' ||
      !selectedLanguage ||
      !region ||
      !preferredName ||
      Object.keys(validationErrors).length
    ) {
      if (role !== 'patient' || !selectedLanguage || !region) {
        validationErrors.save = t(language, 'checkDetails');
      }
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    submissionLocked.current = true;
    setIsSaving(true);

    try {
      const reusableProfile = savedProfileId ? null : await patientRepository.getProfile();
      const result = await patientRepository.upsertProfileWithSettings(
        {
          ageBracket: profile.ageBracket,
          emergencyName,
          emergencyPhone,
          id: savedProfileId ?? reusableProfile?.id,
          preferredName,
        },
        {
          highContrast: accessibility.highContrast,
          language: selectedLanguage,
          reducedMotion: accessibility.reducedMotion,
          region,
          textSize: accessibility.textSize,
          voiceGuidance: accessibility.voiceGuidance,
        }
      );

      setSavedProfileId(result.profile.id);
      await setSecureValue(SecureStorageKeys.activeProfileId, result.profile.id);
      await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
      resetOnboarding();
      router.replace('/onboarding/complete');
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('Onboarding finalization failed', error);
      }
      setErrors({ save: t(language, 'saveFailed') });
      submissionLocked.current = false;
      setIsSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  return (
    <OnboardingScreen
      description={t(language, 'profileIntro')}
      language={language}
      title={t(language, 'profileTitle')}>
      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText type="cardHeading">{t(language, 'preferredName')}</ThemedText>
          <TextInput
            accessibilityHint={errors.preferredName}
            accessibilityLabel={t(language, 'preferredName')}
            autoCapitalize="words"
            maxLength={80}
            onChangeText={(preferredName) => setProfileDraft({ preferredName })}
            placeholder={t(language, 'preferredNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[inputStyle, errors.preferredName && { borderColor: colors.error }]}
            value={profile.preferredName}
          />
          {errors.preferredName ? (
            <ThemedText accessibilityRole="alert" lightColor={colors.error} darkColor={colors.error}>
              {errors.preferredName}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText type="cardHeading">
            {t(language, 'ageBracket')} ({t(language, 'optional')})
          </ThemedText>
          <View style={styles.choices}>
            {AgeBrackets.map((ageBracket) => (
              <SelectionCard
                icon="calendar-today"
                key={ageBracket}
                onPress={() => setProfileDraft({ ageBracket })}
                reducedMotionOverride={accessibility.reducedMotion || undefined}
                selected={profile.ageBracket === ageBracket}
                selectedLabel={t(language, 'selected')}
                title={ageBracket}
              />
            ))}
          </View>
          {profile.ageBracket ? (
            <SmaranButton
              accessibilityLabel={t(language, 'skipAge')}
              label={t(language, 'skipAge')}
              onPress={() => setProfileDraft({ ageBracket: null })}
              reducedMotionOverride={accessibility.reducedMotion ? true : null}
              variant="outline"
            />
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText type="cardHeading">
            {t(language, 'emergencyName')} ({t(language, 'optional')})
          </ThemedText>
          <TextInput
            accessibilityHint={errors.emergencyName}
            accessibilityLabel={t(language, 'emergencyName')}
            autoCapitalize="words"
            maxLength={80}
            onChangeText={(emergencyName) => setProfileDraft({ emergencyName })}
            placeholder={t(language, 'emergencyNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[inputStyle, errors.emergencyName && { borderColor: colors.error }]}
            value={profile.emergencyName}
          />
          {errors.emergencyName ? (
            <ThemedText accessibilityRole="alert" lightColor={colors.error} darkColor={colors.error}>
              {errors.emergencyName}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText type="cardHeading">
            {t(language, 'emergencyPhone')} ({t(language, 'optional')})
          </ThemedText>
          <TextInput
            accessibilityHint={errors.emergencyPhone}
            accessibilityLabel={t(language, 'emergencyPhone')}
            autoComplete="tel"
            keyboardType="phone-pad"
            maxLength={24}
            onChangeText={(emergencyPhone) => setProfileDraft({ emergencyPhone })}
            placeholder={t(language, 'emergencyPhonePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[inputStyle, errors.emergencyPhone && { borderColor: colors.error }]}
            textContentType="telephoneNumber"
            value={profile.emergencyPhone}
          />
          {errors.emergencyPhone ? (
            <ThemedText accessibilityRole="alert" lightColor={colors.error} darkColor={colors.error}>
              {errors.emergencyPhone}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {errors.save ? (
        <ThemedText accessibilityRole="alert" lightColor={colors.error} darkColor={colors.error}>
          {errors.save}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <SmaranButton
          accessibilityLabel={t(language, 'back')}
          disabled={isSaving}
          label={t(language, 'back')}
          onPress={() => router.back()}
          reducedMotionOverride={accessibility.reducedMotion ? true : null}
          variant="outline"
        />
        <SmaranButton
          accessibilityLabel={errors.save ? t(language, 'retrySave') : t(language, 'saveFinish')}
          disabled={isSaving}
          label={
            isSaving
              ? t(language, 'saving')
              : errors.save
                ? t(language, 'retrySave')
                : t(language, 'saveFinish')
          }
          onPress={() => void saveProfile()}
          reducedMotionOverride={accessibility.reducedMotion ? true : null}
          size="large"
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.xl,
  },
  field: {
    gap: Spacing.sm,
  },
  input: {
    borderRadius: Radius.card,
    borderWidth: 2,
    fontSize: 20,
    lineHeight: 28,
    minHeight: 60,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  choices: {
    gap: Spacing.md,
  },
  actions: {
    gap: Spacing.md,
  },
});
