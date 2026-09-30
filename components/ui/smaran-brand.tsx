import { Image, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-color';

export function SmaranBrand() {
  const colors = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, maxWidth: '100%' }}>
    <Image source={require('../../assets/images/stitch-emblem.png')} accessible={false} aria-hidden
      style={{ width: 44, height: 44 }} />
    <ThemedText type="action" style={{ color: colors.primary, letterSpacing: 0.5 }}>SMARAN AI</ThemedText>
  </View>;
}
