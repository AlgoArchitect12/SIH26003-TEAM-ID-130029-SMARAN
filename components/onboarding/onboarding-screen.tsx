import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';

type OnboardingScreenProps = PropsWithChildren<{
  description: string;
  language: Language;
  speechText?: string;
  title: string;
}>;

export function OnboardingScreen({
  children,
  description,
  language,
  speechText,
  title,
}: OnboardingScreenProps) {
  return (
    <ScreenWrapper contentContainerStyle={styles.scrollContent} scroll>
      <View style={styles.content}>
        <View style={styles.introduction}>
          <ThemedText accessibilityRole="header" type="screenTitle">
            {title}
          </ThemedText>
          <ThemedText>{description}</ThemedText>
        </View>
        <ReadScreenButton language={language} text={speechText ?? `${title}. ${description}`} />
        {children}
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
});
