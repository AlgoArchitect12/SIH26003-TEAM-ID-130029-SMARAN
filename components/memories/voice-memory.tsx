import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { t, type TranslationKey } from '@i18n/index';
import type { Language } from '@db/schema.types';
import type { PersonalMemory } from '@/src/memories/types';
import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { memoryMedia } from '@services/memory-media.service';
import { memoriesService } from '@services/memories.service';
import { stopSpeech } from '@services/speech.service';

export function VoiceMemory({ memory, language, onBusy }: { memory: PersonalMemory; language: Language; onBusy: (busy: boolean) => void }) {
  const focused = useIsFocused();
  const [audioPath, setAudioPath] = useState(memory.audioPath);
  const [recording, setRecording] = useState(false), [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'delete' | 'discard' | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const current = useRef(capturePatientRequest()).current;
  const alive = useRef(true), lock = useRef(false), recordingRef = useRef(false), pendingRef = useRef<string | null>(null);
  const foreground = useRef(AppState.currentState === 'active');
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, status => {
    if (status.isFinished && recordingRef.current && !lock.current) {
      recordingRef.current = false; setRecording(false);
      pendingRef.current = status.url; setPending(status.url);
      void stopRef.current();
    }
    if (status.hasError && alive.current) setMessage('voiceUnavailable');
  });
  const state = useAudioRecorderState(recorder, 500);
  const uri = memoryMedia.resolve(memory.patientId, audioPath);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  useEffect(() => {
    try { player.replace(uri); } catch { setMessage('voiceUnavailable'); }
  }, [player, uri]);
  const valid = () => alive.current && current();
  const dirty = busy || recording || !!pending;
  usePreventRemove(dirty, () => setMessage('voiceRetry'));
  useEffect(() => { onBusy(dirty || playback.playing); return () => onBusy(false); }, [dirty, playback.playing, onBusy]);
  useEffect(() => {
    alive.current = true;
    const app = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (next !== 'active') { player.pause(); if (recordingRef.current) void stopRef.current(); }
    });
    return () => {
      alive.current = false; app.remove(); player.pause();
      // The hook releases native resources; a lost patient context never receives a late save.
      if (recordingRef.current) void recorder.stop().catch(() => undefined);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, [player, recorder]);
  useEffect(() => { if (!focused) { player.pause(); if (recordingRef.current) void stopRef.current(); } }, [focused, player]);

  const save = async (source: string) => {
    const result = await memoriesService.saveRecording(memory.patientId, memory.id, source, valid);
    pendingRef.current = null;
    if (valid()) { setPending(null); setConfirm(null); setAudioPath(result.audioPath); setMessage(result.cleanupFailed ? 'voiceCleanup' : 'voiceSaved'); }
  };
  const stop = async () => {
    if (lock.current || !valid()) return;
    lock.current = true; setBusy(true);
    try {
      if (recordingRef.current) {
        await recorder.stop(); recordingRef.current = false; setRecording(false);
        pendingRef.current = recorder.uri;
        setPending(recorder.uri);
      }
      await setAudioModeAsync({ allowsRecording: false });
      if (!pendingRef.current) throw new Error('No recording');
      await save(pendingRef.current);
    } catch { if (valid()) setMessage('voiceFailed'); }
    finally { lock.current = false; if (valid()) setBusy(false); }
  };
  stopRef.current = stop;
  const start = async () => {
    if (lock.current || !valid() || pendingRef.current || recordingRef.current) return;
    lock.current = true; setBusy(true); setMessage(null); setConfirm(null);
    try {
      if (Platform.OS === 'web') throw new Error('Native recording required');
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!valid()) return;
      if (!permission.granted) { setMessage('voiceDenied'); return; }
      if (!focused || !foreground.current) return;
      player.pause(); await stopSpeech(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!valid() || !foreground.current) { await recorder.stop(); return; }
      recorder.record({ forDuration: 300 }); recordingRef.current = true; setRecording(true);
    } catch { if (valid()) setMessage('voiceUnavailable'); }
    finally {
      if (!recordingRef.current) await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      lock.current = false; if (valid()) setBusy(false);
    }
  };
  const erase = async () => {
    if (lock.current || !valid()) return;
    lock.current = true; setBusy(true); player.pause();
    try {
      if (confirm === 'discard') {
        if (pendingRef.current) memoryMedia.discardRecording(pendingRef.current);
        pendingRef.current = null; setPending(null);
      } else if (confirm === 'delete') {
        const result = await memoriesService.saveRecording(memory.patientId, memory.id, null, valid);
        if (valid()) { setAudioPath(null); setMessage(result.cleanupFailed ? 'voiceCleanup' : null); }
      }
      if (valid()) setConfirm(null);
    } catch { if (valid()) setMessage('voiceUnavailable'); }
    finally { lock.current = false; if (valid()) setBusy(false); }
  };
  const play = async (reset = false) => {
    if (lock.current || !valid() || !focused || !foreground.current) return;
    lock.current = true; setBusy(true);
    try {
      if (playback.playing || reset) player.pause();
      if (reset) { await player.seekTo(0); return; }
      if (!playback.playing) {
        await stopSpeech(true); await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
        if (!valid() || !foreground.current) return;
        if (playback.didJustFinish || playback.currentTime >= playback.duration) await player.seekTo(0);
        player.play();
      }
    } catch { if (valid()) setMessage('voiceUnavailable'); }
    finally { lock.current = false; if (valid()) setBusy(false); }
  };
  const button = (key: TranslationKey, action: () => void) => <SmaranButton label={t(language, key)} accessibilityLabel={t(language, key)} variant="outline" disabled={busy} onPress={action} />;
  return <View style={{ gap: 12 }}>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(language, 'voiceMemory')}</ThemedText>
    <ThemedText>{t(language, 'voiceLocal')}</ThemedText>
    {recording && <ThemedText>{t(language, 'voiceRecording', { seconds: String(Math.floor(state.durationMillis / 1000)) })}</ThemedText>}
    {recording ? button('voiceStop', () => void stop()) : pending ? <>
      {button('voiceRetry', () => void stop())}
      {button('voiceDiscard', () => setConfirm('discard'))}
    </> : <>
      {!audioPath && button('voiceRecord', () => void start())}
      {audioPath && <>
        {uri ? <>{button(playback.playing ? 'voicePause' : 'voicePlay', () => void play())}{button('voicePlaybackStop', () => void play(true))}</> : <ThemedText>{t(language, 'voiceUnavailable')}</ThemedText>}
        {button('voiceDelete', () => setConfirm('delete'))}
      </>}
    </>}
    {confirm && <>
      <ThemedText>{t(language, confirm === 'delete' ? 'voiceDeleteConfirm' : 'voiceDiscardConfirm')}</ThemedText>
      {button(confirm === 'delete' ? 'voiceDelete' : 'voiceDiscard', () => void erase())}
      {button('circleCancel', () => setConfirm(null))}
    </>}
    {message && <ThemedText accessibilityLiveRegion="polite">{t(language, message)}</ThemedText>}
  </View>;
}
