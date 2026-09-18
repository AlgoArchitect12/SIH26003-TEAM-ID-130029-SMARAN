import { MaterialIcons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranBrand } from '@components/ui/smaran-brand';
import { SmaranButton } from '@components/ui/smaran-button';
import { useThemeColors } from '@/hooks/use-theme-color';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type OnboardingScreenProps = PropsWithChildren<{
  backDisabled?: boolean;
  description: string;
  language: Language;
  onBack?: () => void;
  showReadAloud?: boolean;
  speechText?: string;
  step?: number;
  title: string;
}>;

export function OnboardingScreen({
  backDisabled = false,
  children,
  description,
  language,
  onBack,
  showReadAloud = true,
  speechText,
  step,
  title,
}: OnboardingScreenProps) {
  const colors = useThemeColors();
  const role = useOnboardingStore(state => state.role);

  return (
    <ScreenWrapper contentContainerStyle={styles.scrollContent} scroll>
      <View style={styles.content}>
        {step === 1 && <>
          <SmaranBrand />
          <ThemedText type="secondary" style={{ textAlign: 'center' }}>{t(language, 'appTagline')}</ThemedText>
        </>}
        {onBack ? (
          <SmaranButton
            accessibilityLabel={t(language, 'back')}
            disabled={backDisabled}
            icon={<MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.text} name="arrow-back" size={26} />}
            label={t(language, 'back')}
            onPress={onBack}
            style={styles.backButton}
            variant="outline"
          />
        ) : null}
        <View style={styles.introduction}>
          {step ? (
            <ThemedText type="caption">
              {t(language, 'stepProgress', { current: String(step), total: role === 'caregiver' ? '6' : '5' })}
            </ThemedText>
          ) : null}
          <ThemedText accessibilityRole="header" type="screenTitle">
            {title}
          </ThemedText>
          <ThemedText>{description}</ThemedText>
        </View>
        {children}
        {showReadAloud ? (
          <ReadScreenButton language={language} text={speechText ?? `${title}. ${description}`} />
        ) : null}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    alignSelf: 'center',
    gap: Spacing.lg,
    maxWidth: 680,
    width: '100%',
  },
  introduction: {
    gap: Spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
});
