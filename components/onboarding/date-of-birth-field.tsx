import { View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { Field } from '@components/ui/smaran-field';
import { t } from '@i18n/index';
import type { Language } from '@db/schema.types';
import { ageFromDateOfBirth, parseDateOfBirth } from '@/src/utils/date-of-birth';

export function DateOfBirthField({ value, onChange, language, error, disabled = false }: {
  value: string; onChange: (value: string) => void; language: Language; error?: string; disabled?: boolean;
}) {
  const parts = value.split('/');
  const iso = parseDateOfBirth(value);
  return <View style={{ gap: 12 }}>
    <ThemedText type="cardHeading">{t(language, 'dob')}</ThemedText>
    <ThemedText type="secondary">{t(language, 'dobHint')}</ThemedText>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {(['dobDay', 'dobMonth', 'dobYear'] as const).map((key, index) => <View key={key} style={{ flex: 1, minWidth: 88 }}>
        <Field editable={!disabled} label={t(language, key)} keyboardType="number-pad" inputMode="numeric" maxLength={index === 2 ? 4 : 2}
          placeholder={index === 2 ? 'YYYY' : index === 1 ? 'MM' : 'DD'} value={parts[index] ?? ''}
          accessibilityHint={t(language, 'dobHint')}
          onBlur={() => {
            if (/^\d$/u.test(parts[index] ?? '') && index < 2) {
              const next = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
              next[index] = next[index].padStart(2, '0'); onChange(next.join('/'));
            }
          }}
          onChangeText={part => {
            const next = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
            next[index] = part;
            onChange(next.join('/'));
          }} />
      </View>)}
    </View>
    {iso && <ThemedText accessibilityLiveRegion="polite" type="defaultSemiBold">{t(language, 'ageYears', { age: String(ageFromDateOfBirth(iso)) })}</ThemedText>}
    {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
  </View>;
}
