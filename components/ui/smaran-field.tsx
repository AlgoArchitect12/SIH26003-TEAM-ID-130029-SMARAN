import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { getScaledTypography } from '@constants/typography';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useThemeColors();
  const size = useTextSize();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    <ThemedText type="defaultSemiBold">{label}</ThemedText>
    <TextInput autoComplete="off" textContentType="none" importantForAutofill="no" autoCorrect={false} {...props}
      accessibilityLabel={label} placeholderTextColor={colors.textSecondary}
      onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      style={[styles.input, getScaledTypography('body', size), { color: colors.text, backgroundColor: colors.surface,
        borderColor: focused ? colors.focus : colors.border }, focused && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 }, props.style]} />
  </View>;
}
const styles = StyleSheet.create({ input: { minHeight: 60, borderWidth: 2, borderRadius: 12, padding: 12, width: '100%' } });
