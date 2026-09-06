import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { speakScreenText, stopSpeech, type SpeechOutcome } from '@services/speech.service';
import { useThemeColors } from '@/hooks/use-theme-color';

type ReadScreenButtonProps = {
  language: Language;
  text: string;
  labelKey?: TranslationKey;
};

export function ReadScreenButton({ language, text, labelKey = 'readScreen' }: ReadScreenButtonProps) {
  const colors = useThemeColors();
  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outcome, setOutcome] = useState<SpeechOutcome | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    setIsStarting(false);
    setIsSpeaking(false);
    setOutcome(null);
    return () => {
      requestId.current += 1;
      void stopSpeech();
    };
  }, [language, text]);

  useFocusEffect(useCallback(() => {
    setIsStarting(false);
    setIsSpeaking(false);
    setOutcome(null);
    return () => {
      requestId.current += 1;
      void stopSpeech();
    };
  }, []));

  const handlePress = async () => {
    const request = ++requestId.current;
    if (isSpeaking || isStarting) {
      setIsStarting(false);
      setIsSpeaking(false);
      await stopSpeech();
      return;
    }

    setOutcome(null);
    setIsStarting(true);
    setIsSpeaking(true);
    const nextOutcome = await speakScreenText(text, language, {
      onDone: () => {
        if (request === requestId.current) setIsSpeaking(false);
      },
      onError: () => {
        if (request === requestId.current) {
          setIsSpeaking(false);
          setOutcome('failed');
        }
      },
    });
    if (request === requestId.current) {
      setOutcome(nextOutcome);
      if (nextOutcome !== 'started') setIsSpeaking(false);
      setIsStarting(false);
    }
  };

  const label = t(language, isSpeaking ? 'stopReading' : labelKey);

  return (
    <View style={styles.container}>
      <SmaranButton
        accessibilityLabel={label}
        loading={isStarting}
        icon={
          <MaterialIcons
            accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            color={colors.text}
            name={isSpeaking ? 'volume-off' : 'volume-up'}
            size={24}
          />
        }
        label={label}
        onPress={() => void handlePress()}
        variant="outline"
      />
      {outcome === 'unavailable' || outcome === 'failed' ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.status} type="secondary">
          {t(language, outcome === 'unavailable' ? 'speechUnavailable' : 'speechFailed')}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  status: {
    textAlign: 'center',
  },
});
