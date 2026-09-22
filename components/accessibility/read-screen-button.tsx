import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import {
  speakScreenText,
  stopSpeech,
  type SpeechOutcome,
} from '@services/speech.service';
import { useThemeColors } from '@/hooks/use-theme-color';

type ReadScreenButtonProps = {
  language: Language;
  speechLanguage?: Language;
  text: string;
  labelKey?: TranslationKey;
};

const START_TIMEOUT_MS = 5000;

export function ReadScreenButton({
  language,
  speechLanguage = language,
  text,
  labelKey = 'readScreen',
}: ReadScreenButtonProps) {
  const colors = useThemeColors();
  const voiceGuidance = useOnboardingStore(
    (s) => s.accessibility.voiceGuidance,
  );

  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outcome, setOutcome] = useState<SpeechOutcome | null>(null);

  const requestId = useRef(0);
  const reading = useRef(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPatient = useRef(capturePatientRequest()).current;

  const clearStartTimer = useCallback(() => {
    if (startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
  }, []);

  const resetReadingState = useCallback(() => {
    clearStartTimer();
    reading.current = false;
    setIsStarting(false);
    setIsSpeaking(false);
  }, [clearStartTimer]);

  const invalidateReading = useCallback(() => {
    requestId.current += 1;
    resetReadingState();
    void stopSpeech();
  }, [resetReadingState]);

  useEffect(() => {
    setOutcome(null);
    resetReadingState();

    return () => {
      requestId.current += 1;
      resetReadingState();
      void stopSpeech();
    };
  }, [
    language,
    speechLanguage,
    text,
    voiceGuidance,
    resetReadingState,
  ]);

  useFocusEffect(
    useCallback(() => {
      setOutcome(null);
      resetReadingState();

      const subscription = AppState.addEventListener(
        'change',
        (state) => {
          if (state !== 'active') {
            invalidateReading();
          }
        },
      );

      return () => {
        subscription.remove();
        invalidateReading();
      };
    }, [invalidateReading, resetReadingState]),
  );

  const handlePress = async () => {
    if (!currentPatient()) {
      return;
    }

    const request = ++requestId.current;

    if (reading.current) {
      invalidateReading();
      return;
    }

    setOutcome(null);
    reading.current = true;
    setIsStarting(true);
    setIsSpeaking(false);

    let terminalCallback = false;

    const isCurrent = () =>
      request === requestId.current && currentPatient();

    startTimer.current = setTimeout(() => {
      if (!isCurrent() || !reading.current) {
        return;
      }

      terminalCallback = true;
      reading.current = false;
      setIsStarting(false);
      setIsSpeaking(false);
      setOutcome('failed');

      if (__DEV__) {
        console.warn(
          '[SMARAN][TTS] Native speech did not report onStart within 5 seconds.',
        );
      }

      void stopSpeech();
    }, START_TIMEOUT_MS);

    const nextOutcome = await speakScreenText(
      text,
      speechLanguage,
      {
        onStart: () => {
          if (!isCurrent()) {
            return;
          }

          clearStartTimer();
          setIsStarting(false);
          setIsSpeaking(true);
        },

        onDone: () => {
          if (!isCurrent()) {
            return;
          }

          terminalCallback = true;
          clearStartTimer();
          reading.current = false;
          setIsStarting(false);
          setIsSpeaking(false);
        },

        onError: () => {
          if (!isCurrent()) {
            return;
          }

          terminalCallback = true;
          clearStartTimer();
          reading.current = false;
          setIsStarting(false);
          setIsSpeaking(false);
          setOutcome('failed');
        },
      },
    );

    if (!isCurrent() || terminalCallback) {
      return;
    }

    if (nextOutcome !== 'started') {
      clearStartTimer();
      reading.current = false;
      setIsStarting(false);
      setIsSpeaking(false);
      setOutcome(nextOutcome);
    }
  };

  if (!voiceGuidance) {
    return null;
  }

  const active = isStarting || isSpeaking;
  const label = t(
    language,
    active ? 'stopReading' : labelKey,
  );

  return (
    <View style={styles.container}>
      <SmaranButton
        accessibilityLabel={label}
        loading={isStarting}
        icon={
          <MaterialIcons
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
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
        <ThemedText
          accessibilityLiveRegion="polite"
          style={styles.status}
          type="secondary"
        >
          {t(
            language,
            outcome === 'unavailable'
              ? 'speechUnavailable'
              : 'speechFailed',
          )}
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
