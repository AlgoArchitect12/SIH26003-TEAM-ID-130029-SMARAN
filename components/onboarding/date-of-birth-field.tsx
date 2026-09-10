import { useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { t } from '@i18n/index';
import type { Language } from '@db/schema.types';
import { ageFromDateOfBirth, chooseBirthPart, daysInBirthMonth, parseDateOfBirth } from '@/src/utils/date-of-birth';

export function DateOfBirthField({ value, onChange, language, error, disabled = false }: {
  value: string; onChange: (value: string) => void; language: Language; error?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const parts = value.split('/');
  const [, month, year] = parts.map(Number);
  const today = new Date();
  const iso = parseDateOfBirth(value, today);
  const labels = ['dobDay', 'dobMonth', 'dobYear'] as const;
  const months = t(language, 'dobMonths').split('|');
  const number = (n: number) => new Intl.NumberFormat(language, { useGrouping: false }).format(n);
  const groups = open === 2 && decade === null;
  const dayLimit = year === today.getFullYear() && month === today.getMonth() + 1
    ? today.getDate() : daysInBirthMonth(month || 1, year || 2000);
  const options = open === 0 ? Array.from({ length: dayLimit }, (_, n) => n + 1)
    : open === 1 ? Array.from({ length: year === today.getFullYear() ? today.getMonth() + 1 : 12 }, (_, n) => n + 1)
      : groups ? Array.from({ length: Math.floor(today.getFullYear() / 10) + 1 }, (_, n) => (Math.floor(today.getFullYear() / 10) - n) * 10)
        : Array.from({ length: 10 }, (_, n) => (decade ?? 0) + n).filter(n => n > 0 && n <= today.getFullYear());
  return <View style={{ gap: 12 }}>
    <ThemedText type="cardHeading">{t(language, 'dob')}</ThemedText>
    <ThemedText type="secondary">{t(language, 'dobPickHint')}</ThemedText>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {labels.map((key, index) => {
        const selected = Number(parts[index]);
        const label = selected ? index === 1 ? months[selected - 1] : number(selected) : t(language, 'dobChoose');
        return <View key={key} style={{ flexGrow: 1, flexBasis: 140, gap: 8 }}>
          <ThemedText type="defaultSemiBold">{t(language, key)}</ThemedText>
          <SmaranButton label={label + ' ▾'} accessibilityLabel={t(language, key) + ': ' + label}
            accessibilityState={{ expanded: open === index }} disabled={disabled} variant="outline" size="large"
            onPress={() => { setDecade(year ? Math.floor(year / 10) * 10 : null); setOpen(index); }} />
        </View>;
      })}
    </View>
    {iso && <ThemedText accessibilityLiveRegion="polite" type="defaultSemiBold">{t(language, 'ageYears', { age: String(ageFromDateOfBirth(iso)) })}</ThemedText>}
    {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
    <Modal visible={open !== null && !disabled} animationType="none" onRequestClose={() => setOpen(null)}>
      <ScreenWrapper><View accessibilityViewIsModal style={{ flex: 1, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} variant="outline" onPress={() => setOpen(null)} />
        <ThemedText type="screenTitle" accessibilityRole="header">{t(language, groups ? 'dobYearGroup' : labels[open ?? 0])}</ThemedText>
        {open === 2 && !groups && <SmaranButton label={t(language, 'dobYearGroup')} accessibilityLabel={t(language, 'dobYearGroup')}
          variant="outline" onPress={() => setDecade(null)} />}
        <FlatList key={String(open) + '-' + decade} data={options} keyExtractor={n => String(n)}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }} renderItem={({ item }) => {
            const label = groups ? number(Math.max(1, item)) + ' – ' + number(Math.min(item + 9, today.getFullYear()))
              : open === 1 ? months[item - 1] : number(item);
            return <SmaranButton label={label} accessibilityLabel={label} size="large"
              accessibilityState={{ selected: !groups && Number(parts[open ?? 0]) === item }} variant="outline"
              onPress={() => {
                if (groups) setDecade(item);
                else { onChange(chooseBirthPart(value, open!, item)); setOpen(null); }
              }} />;
          }} />
      </View></ScreenWrapper>
    </Modal>
  </View>;
}
