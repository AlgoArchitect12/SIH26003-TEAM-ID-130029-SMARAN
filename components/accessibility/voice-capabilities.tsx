import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { getLanguageName, t } from '@i18n/index';
import type { Language } from '@db/schema.types';
import { getVoiceCapabilities, type LanguageVoiceCapability } from '@services/speech.service';

export function VoiceCapabilities({ language }: { language: Language }) {
  const [capabilities, setCapabilities] = useState<LanguageVoiceCapability[]>([]);
  const request = useRef(0);
  const refresh = useCallback(() => {
    const next = ++request.current;
    setCapabilities([]);
    void getVoiceCapabilities().then(result => { if (next === request.current) setCapabilities(result); });
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { request.current++; subscription.remove(); };
  }, [refresh]));
  return <View style={{ gap: 16 }}>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(language, 'voiceLanguages')}</ThemedText>
    <ThemedText>{t(language, 'voiceInputUnavailable')}</ThemedText>
    <ThemedText>{t(language, 'voiceDeviceHelp')}</ThemedText>
    {!capabilities.length && <ThemedText>{t(language, 'voiceChecking')}</ThemedText>}
    {capabilities.map(item => <View key={item.language} style={{ gap: 8 }}>
      <ThemedText type="defaultSemiBold">{getLanguageName(item.language)}</ThemedText>
      <ThemedText>{t(language, 'voiceUiAvailable')}</ThemedText>
      <ThemedText>{t(language, item.tts === 'available' ? 'voiceTtsAvailable' : item.tts === 'unknown' ? 'voiceTtsUnknown' : 'speechUnavailable')}</ThemedText>
    </View>)}
    <SmaranButton variant="outline" label={t(language, 'voiceCheckAgain')} accessibilityLabel={t(language, 'voiceCheckAgain')}
      onPress={refresh} />
  </View>;
}
