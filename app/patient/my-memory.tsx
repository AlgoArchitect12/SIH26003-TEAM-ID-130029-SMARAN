import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto, memoryStyles as styles } from '@components/memories/memory-photo';
import { useMyDayPatient as usePatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { memoriesService } from '@services/memories.service';
import { t, type TranslationKey } from '@i18n/index';
import { MemoryError, type PersonalMemory } from '@/src/memories/types';
import { memoryMedia } from '@services/memory-media.service';
import { stopSpeech } from '@services/speech.service';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Language } from '@db/schema.types';

function MemoryAudioPlayer({ patientId, audioPath, language, onPlayingChange }: { patientId: string; audioPath: string; language: Language; onPlayingChange?: (playing: boolean) => void }) {
  const focused = useIsFocused();
  const [message, setMessage] = useState<TranslationKey | null>(null);

  const uri = memoryMedia.resolve(patientId, audioPath);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);

  const alive = useRef(true);
  const foreground = useRef(AppState.currentState === 'active');
  const lock = useRef(false);

  useEffect(() => {
    try { player.replace(uri); } catch { setMessage('voiceUnavailable'); }
  }, [player, uri]);

  useEffect(() => {
    alive.current = true;
    const app = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (next !== 'active') { player.pause(); }
    });
    return () => {
      alive.current = false;
      app.remove();
      player.pause();
    };
  }, [player]);

  useEffect(() => {
    if (!focused) player.pause();
  }, [focused, player]);

  useEffect(() => {
    if (onPlayingChange) onPlayingChange(playback.playing);
  }, [playback.playing, onPlayingChange]);

  const play = async (reset = false) => {
    if (lock.current || !alive.current || !focused || !foreground.current) return;
    lock.current = true;
    try {
      if (playback.playing || reset) player.pause();
      if (reset) { await player.seekTo(0); return; }
      if (!playback.playing) {
        await stopSpeech(true);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
        if (!alive.current || !foreground.current) return;
        if (playback.didJustFinish || playback.currentTime >= playback.duration) await player.seekTo(0);
        player.play();
      }
    } catch {
      if (alive.current) setMessage('voiceUnavailable');
    } finally {
      lock.current = false;
    }
  };

  const button = (key: TranslationKey, action: () => void) => <SmaranButton label={t(language, key)} accessibilityLabel={t(language, key)} variant="outline" onPress={action} />;

  if (!uri) {
    return <ThemedText>{t(language, 'voiceUnavailable')}</ThemedText>;
  }

  return (
    <View style={{ gap: 12 }}>
      {button(playback.playing ? 'voicePause' : 'voicePlay', () => void play())}
      {button('voicePlaybackStop', () => void play(true))}
      {message && <ThemedText accessibilityRole="alert">{t(language, message)}</ThemedText>}
    </View>
  );
}

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
  const [audioBusy, setAudioBusy] = useState(false);
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
    const current = capturePatientRequest();
    if (!current()) return;
    if (!memory || !patientId || locked.current || audioBusy) return;
    locked.current = true; setBusy(true);
    try {
      const result = await memoriesService.remove(patientId, memory.id);
      if (!current()) return;
      router.dismissTo({ pathname: '/patient/my-memories', params: { cleanup: result.cleanupFailed ? '1' : '0' } });
    } catch (error) { setFailed(true); if (error instanceof MemoryError && error.code === 'missing') setMissing(true); }
    finally { locked.current = false; setBusy(false); }
  };
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'memoryBack')} variant="outline" disabled={busy} onPress={() => router.dismissTo('/patient/my-memories')} />
    {(failed || patientFailed || missing) && <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, missing ? 'memoryMissing' : 'memoryFailed')}</ThemedText>
      {!missing && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} disabled={busy} onPress={() => { retryPatient(); setAttempt(n => n + 1); }} />}
    </View>}
    {!memory && !failed && !patientFailed && !missing && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {memory && memory.patientId === patientId && !missing && <>
      <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />
      <ThemedText type="screenTitle" accessibilityRole="header">{memory.name}</ThemedText>
      {!!memory.relationship && <ThemedText type="secondary">{memory.relationship}</ThemedText>}
      {!!memory.description && <ThemedText>{memory.description}</ThemedText>}
      {!audioBusy && <ReadScreenButton language={language} labelKey="memoryHear" text={[t(language, 'memorySpeakIntro', { name: memory.name }), memory.relationship, memory.description].filter(Boolean).join(' ')} />}
      {focused && memory.audioPath && <MemoryAudioPlayer key={memory.patientId + memory.id} patientId={memory.patientId} audioPath={memory.audioPath} language={language} onPlayingChange={setAudioBusy} />}
      {cleanup === '1' && <ThemedText accessibilityRole="alert">{t(language, 'memorySavedCleanup')}</ThemedText>}
      <SmaranButton label={t(language, 'memoryEdit')} accessibilityLabel={t(language, 'memoryEdit')} variant="outline" disabled={busy || audioBusy}
        onPress={() => router.push({ pathname: '/patient/my-memory-editor', params: { id: memory.id } })} />
      {confirm ? <View style={styles.group} accessibilityRole="alert">
        <ThemedText type="cardHeading">{t(language, 'memoryRemoveConfirm')}</ThemedText>
        <ThemedText>{t(language, 'memoryRemoveExplain')}</ThemedText>
        <SmaranButton label={t(language, 'memoryKeep')} accessibilityLabel={t(language, 'memoryKeep')} disabled={busy} onPress={() => setConfirm(false)} />
        <SmaranButton label={t(language, 'memoryRemove')} accessibilityLabel={t(language, 'memoryRemove')} disabled={busy || audioBusy} loading={busy} variant="outline" onPress={() => void remove()} />
      </View> : <SmaranButton label={t(language, 'memoryRemove')} accessibilityLabel={t(language, 'memoryRemove')} variant="outline" disabled={audioBusy} onPress={() => setConfirm(true)} />}
    </>}
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" disabled={busy} onPress={() => router.dismissTo('/patient/home')} />
  </View></ScreenWrapper>;
}
