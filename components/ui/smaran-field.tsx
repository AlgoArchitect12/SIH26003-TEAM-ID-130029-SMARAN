import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { getScaledTypography } from '@constants/typography';
import { Layout, Radius, Spacing } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useThemeColors();
  const size = useTextSize();
  const [focused, setFocused] = useState(false);
  const disabled = props.editable === false;
  // Android's unfocused hint uses native font metrics; a Text lineHeight can clip it.
  const { lineHeight: _lineHeight, ...inputTypography } = getScaledTypography('body', size);

  return <View style={{ gap: Spacing.sm }}>
    <ThemedText type="defaultSemiBold">{label}</ThemedText>
    <TextInput
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
      autoCorrect={false}
      underlineColorAndroid="transparent"
      {...props}
      accessibilityLabel={label}
      accessibilityState={{ ...props.accessibilityState, disabled }}
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.primary}
      onFocus={event => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={event => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.input,
        inputTypography,
        {
          color: disabled ? colors.onDisabled : colors.text,
          backgroundColor: disabled ? colors.disabled : colors.surface,
          borderStyle: disabled ? 'dashed' : 'solid',
          textAlignVertical: props.multiline ? 'top' : 'center',
          includeFontPadding: true,
          borderColor: focused ? colors.focus : colors.border,
        },
        focused && {
          outlineColor: colors.focus,
          outlineStyle: 'solid',
          outlineWidth: 3,
          outlineOffset: 3,
        },
        props.style,
      ]}
    />
  </View>;
}

const styles = StyleSheet.create({
  input: {
    minHeight: Layout.buttonHeight,
    borderWidth: 2,
    borderRadius: Radius.button,
    padding: Spacing.md,
    width: '100%',
  },
});
