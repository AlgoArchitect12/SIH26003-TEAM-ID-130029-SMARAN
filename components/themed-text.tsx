import { StyleSheet, Text, type TextProps } from 'react-native';

import {
  getScaledTypography,
  type TextSizePreference,
  type TypographyVariant,
} from '@constants/typography';
import { useThemeColor } from '@/hooks/use-theme-color';

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
  textSize = 'normal',
  ...rest
}: ThemedTextProps) {
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
    variant === 'link' ? 'link' : 'text'
  );

  return (
    <Text
      style={[
        styles.base,
        { color },
        getScaledTypography(variant, textSize),
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
