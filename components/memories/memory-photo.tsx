import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { PageLayout, Radius } from '@constants/layout';
import { t } from '@i18n/index';
import { memoryMedia } from '@services/memory-media.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import type { Language } from '@db/schema.types';
import type { SelectedMemoryPhoto } from '@/src/memories/types';

export function MemoryPhoto({ patientId, path, name, language, selected }: {
  patientId: string; path: string | null; name: string; language: Language; selected?: SelectedMemoryPhoto;
}) {
  const colors = useThemeColors();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useFocusEffect(useCallback(() => {
    setFailed(false); setLoaded(false);
    setUri(selected?.uri ?? memoryMedia.resolve(patientId, path));
  }, [patientId, path, selected?.uri]));
  const hasImage = uri !== null && !failed;
  return <View style={styles.group}>
    <View style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {hasImage && <Image source={{ uri }} accessibilityLabel={name.trim() ? t(language, 'memoryPhotoOf', { name }) : t(language, 'memorySelectedPhoto')} accessible
        contentFit="contain" cachePolicy="none" transition={0} style={StyleSheet.absoluteFill}
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
      {(!hasImage || !loaded) && <View style={styles.placeholder}>
        <MaterialIcons name="portrait" size={64} color={colors.textSecondary} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        {hasImage && <ThemedText>{t(language, 'memoryPhotoLoading')}</ThemedText>}
      </View>}
    </View>
    {!hasImage && <ThemedText>{t(language, path || selected ? 'memoryPhotoMissing' : 'memoryNoPhoto')}</ThemedText>}
  </View>;
}
export const memoryStyles = StyleSheet.create({
  content: PageLayout.content,
  heading: PageLayout.heading,
  group: PageLayout.group,
});
const styles = StyleSheet.create({
  group: { gap: 12 },
  photo: { width: '100%', aspectRatio: 4/3, borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
  placeholder: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
});
