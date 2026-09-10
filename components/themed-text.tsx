import { StyleSheet, Text, type TextProps } from 'react-native';

import {
  getScaledTypography,
  type TextSizePreference,
  type TypographyVariant,
} from '@constants/typography';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: TypographyVariant | 'default' | 'defaultSemiBold' | 'subtitle' | 'title';
  textSize?: TextSizePreference;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'body',
  textSize,
  ...rest
}: ThemedTextProps) {
  const preferredTextSize = useTextSize();
  const variant: TypographyVariant =
    type === 'default' || type === 'defaultSemiBold'
      ? 'body'
      : type === 'subtitle'
        ? 'cardHeading'
        : type === 'title'
          ? 'screenTitle'
          : type;
  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    rest.accessibilityRole === 'alert' ? 'error' : variant === 'link' ? 'link' : variant === 'secondary' || variant === 'caption' ? 'textSecondary' : 'text'
  );

  return (
    <Text
      accessibilityRole={variant === 'screenTitle' || variant === 'cardHeading' ? 'header' : undefined}
      style={[
        styles.base,
        { color },
        getScaledTypography(variant, textSize ?? preferredTextSize),
        type === 'defaultSemiBold' && styles.semiBold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
  semiBold: {
    fontWeight: '600',
  },
});
