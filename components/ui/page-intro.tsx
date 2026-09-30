import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageLayout } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';

export function PageIntro({ title, description, icon, children }: PropsWithChildren<{
  title: string;
  description?: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
}>) {
  const colors = useThemeColors();
  return <SmaranCard style={[PageLayout.group, { backgroundColor: colors.surfaceSelected }]}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
      <View style={{ flex: 1, gap: 8 }}>
        <ThemedText type="screenTitle">{title}</ThemedText>
        {description && <ThemedText type="secondary">{description}</ThemedText>}
      </View>
      <MaterialIcons name={icon} size={32} color={colors.primary} accessible={false} aria-hidden />
    </View>
    {children}
  </SmaranCard>;
}
