import { Image, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-color';

export function SmaranBrand() {
  const colors = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, maxWidth: '100%' }}>
    <Image source={require('../../assets/images/splash-icon.png')} accessible={false} aria-hidden tintColor={colors.primary}
      style={{ width: 48, height: 48 }} />
    <ThemedText type="defaultSemiBold">SMARAN AI</ThemedText>
  </View>;
}
