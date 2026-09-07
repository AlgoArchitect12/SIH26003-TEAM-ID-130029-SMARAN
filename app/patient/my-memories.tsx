import { SmaranLoading } from '@components/ui/smaran-loading';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto, memoryStyles as styles } from '@components/memories/memory-photo';
import { useMyDayPatient as usePatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { t } from '@i18n/index';
import type { PersonalMemory } from '@/src/memories/types';

export default function MyMemoriesScreen() {
  const router = useRouter();
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
    if (patientId) { setFailed(false); void memoriesRepository.list(patientId).then(rows => {
      if (active) { setMemories(rows); setLoaded(true); }
    }).catch(() => { if (active) setFailed(true); }); }
    return () => { active = false; };
  }, [focused, patientId, attempt]);
  const speech = [t(language, 'homeMemoriesTitle'), t(language, 'memoryIntro'),
    ...memories.map(memory => `${memory.name}. ${memory.relationship}`),
    loaded && !memories.length ? `${t(language, 'memoryEmpty')} ${t(language, 'memoryEmptyHelp')}` : ''].join(' ');
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeMemoriesTitle')}</ThemedText>
    <ThemedText>{t(language, 'memoryIntro')}</ThemedText>
    <ReadScreenButton language={language} text={speech} />
    {cleanup === '1' && <ThemedText accessibilityRole="alert">{t(language, 'memoryRemovedCleanup')}</ThemedText>}
    {(failed || patientFailed) ? <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, 'memoryFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => { retryPatient(); setAttempt(n => n + 1); }} />
    </View> : !loaded && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {loaded && !failed && !memories.length && <View style={styles.group}>
      <ThemedText type="cardHeading">{t(language, 'memoryEmpty')}</ThemedText>
      <ThemedText>{t(language, 'memoryEmptyHelp')}</ThemedText>
    </View>}
    {patientId && <SmaranButton label={t(language, 'memoryAdd')} accessibilityLabel={t(language, 'memoryAdd')} size="large" onPress={() => router.push('/patient/my-memory-editor')} />}
    {memories.map(memory => <SmaranCard key={memory.id} accessibilityLabel={`${memory.name}. ${memory.relationship}. ${t(language, 'memoryOpen')}`}
      onPress={() => router.push({ pathname: '/patient/my-memory', params: { id: memory.id } })}>
      <View style={styles.group}>
        <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />
        <ThemedText type="cardHeading">{memory.name}</ThemedText>
        {!!memory.relationship && <ThemedText type="secondary">{memory.relationship}</ThemedText>}
        <ThemedText type="defaultSemiBold">{t(language, 'memoryOpen')}</ThemedText>
      </View>
    </SmaranCard>)}
  </View></ScreenWrapper>;
}
