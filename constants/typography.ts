import type { TextStyle } from 'react-native';

export type TextSizePreference = 'normal' | 'large' | 'extraLarge';

export const TextSizeMultipliers: Record<TextSizePreference, number> = {
  normal: 1,
  large: 1.15,
  extraLarge: 1.3,
};

export const Typography = {
  screenTitle: { fontSize: 34, fontWeight: '700', lineHeight: 42 },
  cardHeading: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  action: { fontSize: 22, fontWeight: '600', lineHeight: 30 },
  body: { fontSize: 20, fontWeight: '400', lineHeight: 30 },
  secondary: { fontSize: 18, fontWeight: '500', lineHeight: 26 },
  caption: { fontSize: 17, fontWeight: '500', lineHeight: 24 },
  link: { fontSize: 20, fontWeight: '600', lineHeight: 30, textDecorationLine: 'underline' },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

export function getScaledTypography(
  variant: TypographyVariant,
  textSize: TextSizePreference = 'normal'
): TextStyle {
  const style = Typography[variant];
  const multiplier = TextSizeMultipliers[textSize];

  return {
    ...style,
    fontSize: Math.round(style.fontSize * multiplier),
    lineHeight: Math.round(style.lineHeight * multiplier),
  };
}
