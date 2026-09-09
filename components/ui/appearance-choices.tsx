import { useRef, useState } from 'react';
import { View } from 'react-native';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import type { Language } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { useAppearance } from '@/hooks/use-theme-color';
import { AppearanceModes, saveAppearance, type AppearanceMode } from '@/src/stores/appearance.store';

export const appearanceKeys: Record<AppearanceMode, TranslationKey> = {
  system: 'appearanceSystem', light: 'appearanceLight', dark: 'appearanceDark',
  'high-contrast-light': 'appearanceContrastLight', 'high-contrast-dark': 'appearanceContrastDark',
};
export function AppearanceChoices({ language }: { language: Language }) {
  const { mode } = useAppearance();
  const locked = useRef(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const select = async (next: AppearanceMode) => {
    if (locked.current) return;
    locked.current = true; setStatus('saving');
    try { await saveAppearance(next); setStatus('saved'); }
    catch { setStatus('failed'); }
    finally { locked.current = false; }
  };
  return <View style={{ gap: 12 }}>
    {AppearanceModes.map(option => <SelectionCard key={option} icon={option.includes('dark') ? 'dark-mode' : option === 'system' ? 'settings-brightness' : 'light-mode'}
      disabled={status === 'saving'}
      title={t(language, appearanceKeys[option])} selected={mode === option} selectedLabel={t(language, 'selected')}
      onPress={() => void select(option)} />)}
    {status !== 'idle' && <ThemedText accessibilityLiveRegion="polite" accessibilityRole={status === 'failed' ? 'alert' : undefined}>
      {t(language, status === 'saving' ? 'saving' : status === 'saved' ? 'saved' : 'settingsSaveFailed')}
    </ThemedText>}
  </View>;
}
