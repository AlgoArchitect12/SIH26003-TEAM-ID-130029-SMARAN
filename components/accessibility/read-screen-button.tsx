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
import { speakScreenText, stopSpeech, type SpeechOutcome } from '@services/speech.service';
import { useThemeColors } from '@/hooks/use-theme-color';

type ReadScreenButtonProps = {
  language: Language;
  speechLanguage?: Language;
  text: string;
  labelKey?: TranslationKey;
};

export function ReadScreenButton({ language, speechLanguage = language, text, labelKey = 'readScreen' }: ReadScreenButtonProps) {
  const colors = useThemeColors();
  const voiceGuidance = useOnboardingStore(s => s.accessibility.voiceGuidance);
  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outcome, setOutcome] = useState<SpeechOutcome | null>(null);
  const requestId = useRef(0);
  const reading = useRef(false);
  const currentPatient = useRef(capturePatientRequest()).current;

  useEffect(() => {
    setIsStarting(false);
    setIsSpeaking(false);
    setOutcome(null);
    reading.current = false;
    return () => {
      requestId.current += 1;
      reading.current = false;
      void stopSpeech();
    };
  }, [language, speechLanguage, text, voiceGuidance]);

  useFocusEffect(useCallback(() => {
    setIsStarting(false);
    setIsSpeaking(false);
    setOutcome(null);
    reading.current = false;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        requestId.current += 1;
        reading.current = false;
        setIsStarting(false); setIsSpeaking(false);
        void stopSpeech();
      }
    });
    return () => {
      requestId.current += 1;
      reading.current = false;
      subscription.remove();
      void stopSpeech();
    };
  }, []));

  const handlePress = async () => {
    if (!currentPatient()) return;
    const request = ++requestId.current;
    if (reading.current) {
      reading.current = false;
      setIsStarting(false);
      setIsSpeaking(false);
      await stopSpeech();
      return;
    }

    setOutcome(null);
    reading.current = true;
    setIsStarting(true);
    let finished = false;
    const nextOutcome = await speakScreenText(text, speechLanguage, {
      onStart: () => {
        if (request === requestId.current) { setIsStarting(false); setIsSpeaking(true); }
      },
      onDone: () => {
        finished = true;
        if (request === requestId.current) { reading.current = false; setIsStarting(false); setIsSpeaking(false); }
      },
      onError: () => {
        finished = true;
        if (request === requestId.current) {
          reading.current = false;
          setIsStarting(false);
          setIsSpeaking(false);
          setOutcome('failed');
        }
      },
    });
    if (request === requestId.current && !finished) {
      setOutcome(nextOutcome);
      if (nextOutcome !== 'started') { reading.current = false; setIsSpeaking(false); setIsStarting(false); }
    }
  };

  if (!voiceGuidance) return null;

  const label = t(language, isSpeaking || isStarting ? 'stopReading' : labelKey);

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
