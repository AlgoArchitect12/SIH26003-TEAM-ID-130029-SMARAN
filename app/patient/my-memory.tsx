import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto, memoryStyles as styles } from '@components/memories/memory-photo';
import { useMyDayPatient as usePatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { memoriesService } from '@services/memories.service';
import { t } from '@i18n/index';
import { MemoryError, type PersonalMemory } from '@/src/memories/types';

export default function MemoryDetailScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { id, cleanup } = useLocalSearchParams<{ id?: string; cleanup?: string }>();
  const { patientId, language, failed: patientFailed, retry: retryPatient } = usePatient();
  const [memory, setMemory] = useState<PersonalMemory | null>(null);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setMemory(null); setConfirm(false); setFailed(false); setMissing(false);
    if (typeof id !== 'string' || !id) setMissing(true);
    else if (patientId) void memoriesRepository.get(patientId, id).then(value => {
      if (active) { setMemory(value); setMissing(!value); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [focused, id, patientId, attempt]);
  const remove = async () => {
    if (!memory || !patientId || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const result = await memoriesService.remove(patientId, memory.id);
      router.replace({ pathname: '/patient/my-memories', params: { cleanup: result.cleanupFailed ? '1' : '0' } });
    } catch (error) { setFailed(true); if (error instanceof MemoryError && error.code === 'missing') setMissing(true); }
    finally { locked.current = false; setBusy(false); }
  };
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'memoryBack')} variant="outline" disabled={busy} onPress={() => router.replace('/patient/my-memories')} />
    {(failed || patientFailed || missing) && <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, missing ? 'memoryMissing' : 'memoryFailed')}</ThemedText>
      {!missing && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} disabled={busy} onPress={() => { retryPatient(); setAttempt(n => n + 1); }} />}
    </View>}
    {!memory && !failed && !patientFailed && !missing && <ThemedText>{t(language, 'loadingSetup')}</ThemedText>}
    {memory && !missing && <>
      <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />
      <ThemedText type="screenTitle" accessibilityRole="header">{memory.name}</ThemedText>
      {!!memory.relationship && <ThemedText type="cardHeading">{memory.relationship}</ThemedText>}
      {!!memory.description && <ThemedText>{memory.description}</ThemedText>}
      <ReadScreenButton language={language} labelKey="memoryHear" text={[t(language, 'memorySpeakIntro', { name: memory.name }), memory.relationship, memory.description].filter(Boolean).join(' ')} />
      {cleanup === '1' && <ThemedText accessibilityRole="alert">{t(language, 'memorySavedCleanup')}</ThemedText>}
      <SmaranButton label={t(language, 'memoryEdit')} accessibilityLabel={t(language, 'memoryEdit')} variant="outline" disabled={busy}
        onPress={() => router.push({ pathname: '/patient/my-memory-editor', params: { id: memory.id } })} />
      {confirm ? <View style={styles.group} accessibilityRole="alert">
        <ThemedText type="cardHeading">{t(language, 'memoryRemoveConfirm')}</ThemedText>
        <ThemedText>{t(language, 'memoryRemoveExplain')}</ThemedText>
        <SmaranButton label={t(language, 'memoryKeep')} accessibilityLabel={t(language, 'memoryKeep')} disabled={busy} onPress={() => setConfirm(false)} />
        <SmaranButton label={t(language, 'memoryRemove')} accessibilityLabel={t(language, 'memoryRemove')} disabled={busy} loading={busy} variant="outline" onPress={() => void remove()} />
      </View> : <SmaranButton label={t(language, 'memoryRemove')} accessibilityLabel={t(language, 'memoryRemove')} variant="outline" onPress={() => setConfirm(true)} />}
    </>}
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" disabled={busy} onPress={() => router.replace('/patient/home')} />
  </View></ScreenWrapper>;
}
