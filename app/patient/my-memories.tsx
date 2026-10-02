import { SmaranLoading } from '@components/ui/smaran-loading';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { VoiceMemory } from '@components/memories/voice-memory';
import { useThemeColors } from '@/hooks/use-theme-color';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto, memoryStyles as styles } from '@components/memories/memory-photo';
import { useMyDayPatient as usePatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageIntro } from '@components/ui/page-intro';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { t } from '@i18n/index';
import type { PersonalMemory } from '@/src/memories/types';
import { withTimeout } from '@/src/utils/with-timeout';

export default function MyMemoriesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const focused = useIsFocused();
  const { cleanup } = useLocalSearchParams<{ cleanup?: string }>();
  const { patientId, language, failed: patientFailed, retry: retryPatient } = usePatient();
  const [memories, setMemories] = useState<PersonalMemory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setLoaded(false); setMemories([]); setFailed(false);
    if (patientId) { void withTimeout(memoriesRepository.list(patientId)).then(rows => {
      if (active) { setMemories(rows); setLoaded(true); }
    }).catch(() => { if (active) setFailed(true); }); }
    return () => { active = false; };
  }, [focused, patientId, attempt]);
  const speech = [t(language, 'homeMemoriesTitle'), t(language, 'memoryIntro'),
    ...memories.map(memory => `${memory.name}. ${memory.relationship}`),
    loaded && !memories.length ? `${t(language, 'memoryEmpty')} ${t(language, 'memoryEmptyHelp')}` : ''].join(' ');
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />
    <PageIntro title={t(language, 'homeMemoriesTitle')} description={t(language, 'memoryIntro')} icon="photo-library">
      <ReadScreenButton language={language} text={speech} />
    </PageIntro>
    {cleanup === '1' && <ThemedText accessibilityRole="alert">{t(language, 'memoryMediaCleanup')}</ThemedText>}
    {(failed || patientFailed) ? <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, 'memoryFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => { retryPatient(); setAttempt(n => n + 1); }} />
    </View> : !loaded && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {loaded && !failed && !memories.length && <SmaranCard style={styles.group}>
      <ThemedText type="cardHeading">{t(language, 'memoryEmpty')}</ThemedText>
      <ThemedText>{t(language, 'memoryEmptyHelp')}</ThemedText>
    </SmaranCard>}
    {patientId && <SmaranButton label={t(language, 'memoryAdd')} accessibilityLabel={t(language, 'memoryAdd')} size="large" onPress={() => router.push('/patient/my-memory-editor')} />}
    {memories.map(memory => {
      return (
        <View key={memory.id} style={{ 
          backgroundColor: colors.surface, 
          borderRadius: 16, 
          overflow: 'hidden',
          marginBottom: 24,
          shadowColor: colors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 
        }}>
          <View style={{ position: 'relative' }}>
            <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.surfaceRaised, opacity: 0.9, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="favorite" size={16} color={colors.actionAccent} />
              <ThemedText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 'bold' }}>{memory.relationship || t(language, 'memoryPhotoMissing')}</ThemedText>
            </View>
            <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: colors.surfaceMuted, opacity: 0.9, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="calendar-today" size={16} color={colors.success} />
              <ThemedText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 'bold' }}>
                {memory.createdAt && !isNaN(new Date(memory.createdAt).getTime()) ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(memory.createdAt)) : t(language, 'memoryNoPhoto')}
              </ThemedText>
            </View>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <View>
              <ThemedText type="cardHeading" style={{ fontSize: 20 }}>{memory.name}</ThemedText>
              {!!memory.relationship && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MaterialIcons name="location-on" size={16} color={colors.primary} />
                  <ThemedText type="secondary">{memory.relationship}</ThemedText>
                </View>
              )}
            </View>

            {memory.audioPath && (
              <View style={{ backgroundColor: colors.surfaceSelected, borderRadius: 12, padding: 8 }}>
                <VoiceMemory memory={memory} language={language} onBusy={() => {}} />
              </View>
            )}

            {!!memory.description && (
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="lightbulb" size={16} color={colors.primary} />
                  <ThemedText style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>Cherished Detail:</ThemedText>
                </View>
                <ThemedText style={{ fontSize: 16, lineHeight: 24, fontStyle: 'italic' }}>&quot;{memory.description}&quot;</ThemedText>
              </View>
            )}

            <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <SmaranButton 
                label={t(language, 'memoryOpen')} 
                accessibilityLabel={`${memory.name}. ${t(language, 'memoryOpen')}`}
                variant="outline"
                onPress={() => router.push({ pathname: '/patient/my-memory', params: { id: memory.id } })} 
              />
            </View>
          </View>
        </View>
      )
    })}
  </View></ScreenWrapper>;
}
