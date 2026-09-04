import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { speakScreenText, stopSpeech, type SpeechOutcome } from '@services/speech.service';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ReadScreenButtonProps = {
  language: Language;
  text: string;
};

export function ReadScreenButton({ language, text }: ReadScreenButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outcome, setOutcome] = useState<SpeechOutcome | null>(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setIsSpeaking(false);
    setOutcome(null);
    return () => {
      active.current = false;
      void stopSpeech();
    };
  }, [language, text]);

  const handlePress = async () => {
    if (isSpeaking) {
      await stopSpeech();
      if (active.current) setIsSpeaking(false);
      return;
    }

    setIsStarting(true);
    const nextOutcome = await speakScreenText(text, language, {
      onDone: () => {
        if (active.current) setIsSpeaking(false);
      },
      onError: () => {
        if (active.current) {
          setIsSpeaking(false);
          setOutcome('failed');
        }
      },
    });
    if (active.current) {
      setOutcome(nextOutcome);
      setIsSpeaking(nextOutcome === 'started');
      setIsStarting(false);
    }
  };

  const label = t(language, isSpeaking ? 'stopReading' : 'readScreen');

  return (
    <View style={styles.container}>
      <SmaranButton
        accessibilityLabel={label}
        disabled={isStarting}
        icon={
          <MaterialIcons
            accessible={false}
            color={Colors[colorScheme].text}
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
