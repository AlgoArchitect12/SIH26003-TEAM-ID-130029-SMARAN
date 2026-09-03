import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
  const [outcome, setOutcome] = useState<SpeechOutcome | null>(null);

  useEffect(() => {
    setOutcome(null);
    return () => void stopSpeech();
  }, [language, text]);

  const handlePress = async () => {
    setIsStarting(true);
    setOutcome(await speakScreenText(text, language));
    setIsStarting(false);
  };

  return (
    <View style={styles.container}>
      <SmaranButton
        accessibilityLabel={t(language, 'readScreen')}
        disabled={isStarting}
        icon={<MaterialIcons color={Colors[colorScheme].text} name="volume-up" size={24} />}
        label={t(language, 'readScreen')}
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
