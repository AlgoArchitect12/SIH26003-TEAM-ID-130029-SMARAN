
import { View } from 'react-native';
import { Field } from '@components/ui/smaran-field';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';


export function TimePicker({ value, onChange, language, disabled }: {
  value: string; onChange: (value: string) => void; language: Language; disabled?: boolean;
}) {
  return <View style={{ gap: 12 }}>
    <Field
      label={t(language, 'dayTime')}
      value={value}
      onChangeText={(text) => {
        // e.g., allow typing HH:MM directly
        onChange(text);
      }}
      placeholder="08:00"
      maxLength={5}
      editable={!disabled}
    />
  </View>;
}
