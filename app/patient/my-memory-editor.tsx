import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto, memoryStyles as styles } from '@components/memories/memory-photo';
import { Field, useMyDayPatient as usePatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { memoriesService } from '@services/memories.service';
import { memoryMedia } from '@services/memory-media.service';
import { t, type TranslationKey } from '@i18n/index';
import { MemoryError, validateMemory, type MemoryPhotoChange } from '@/src/memories/types';
import type { Language } from '@db/schema.types';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { stopSpeech } from '@services/speech.service';

function MemoryAudioRecorder({ language, onRecorded }: { language: Language; onRecorded: (uri: string | null) => void }) {
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const alive = useRef(true);
  const recordingRef = useRef(false);
  const foreground = useRef(AppState.currentState === 'active');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, status => {
    if (status.isFinished && recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      setHasRecording(true);
      onRecorded(status.url);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    if (status.hasError && alive.current) setMessage('voiceUnavailable');
  });

  const state = useAudioRecorderState(recorder, 500);

  useEffect(() => {
    alive.current = true;
    const app = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (next !== 'active' && recordingRef.current) {
        void recorder.stop().catch(() => {});
      }
    });
    return () => {
      alive.current = false;
      app.remove();
      if (recordingRef.current) void recorder.stop().catch(() => {});
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [recorder]);

  const start = async () => {
    if (recordingRef.current) return;
    setMessage(null);
    try {
      if (Platform.OS === 'web') throw new Error('Native recording required');
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) { setMessage('voiceDenied'); return; }
      if (!foreground.current) return;
      await stopSpeech(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!alive.current || !foreground.current) { await recorder.stop(); return; }
      recorder.record({ forDuration: 300 });
      recordingRef.current = true;
      setRecording(true);
      setHasRecording(false);
      onRecorded(null);
    } catch {
      if (alive.current) setMessage('voiceUnavailable');
      if (!recordingRef.current) void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  const stop = async () => {
    if (!recordingRef.current) return;
    try {
      await recorder.stop();
    } catch {
      if (alive.current) setMessage('voiceFailed');
    }
  };

  const discard = () => {
    setHasRecording(false);
    onRecorded(null);
  };

  return (
    <View style={{ gap: 12 }}>
      <ThemedText>{t(language, 'voiceLocal')}</ThemedText>
      {recording && <ThemedText>{t(language, 'voiceRecording', { seconds: String(Math.floor(state.durationMillis / 1000)) })}</ThemedText>}
      {recording ? (
        <SmaranButton label={t(language, 'voiceStop')} accessibilityLabel={t(language, 'voiceStop')} onPress={() => void stop()} />
      ) : hasRecording ? (
        <>
          <ThemedText>{t(language, 'voiceSaved')}</ThemedText>
          <SmaranButton label={t(language, 'voiceRetry')} accessibilityLabel={t(language, 'voiceRetry')} onPress={() => void start()} />
          <SmaranButton label={t(language, 'voiceDiscard')} accessibilityLabel={t(language, 'voiceDiscard')} variant="outline" onPress={discard} />
        </>
      ) : (
        <SmaranButton label={t(language, 'voiceRecord')} accessibilityLabel={t(language, 'voiceRecord')} onPress={() => void start()} />
      )}
      {message && <ThemedText accessibilityRole="alert">{t(language, message)}</ThemedText>}
    </View>
  );
}

export default function MemoryEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { patientId, language, failed: patientFailed, retry: retryPatient } = usePatient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [description, setDescription] = useState('');
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [originalAudioPath, setOriginalAudioPath] = useState<string | null>(null);
  const [photo, setPhoto] = useState<MemoryPhotoChange>({ kind: 'keep' });
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDeleted, setAudioDeleted] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [photoNotice, setPhotoNotice] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    if (!patientId || id === undefined) return;
    setLoaded(false);
    void memoriesRepository.get(patientId, id).then(memory => {
      if (!active) return;
      if (!memory) throw new MemoryError('missing');
      setName(memory.name); setRelationship(memory.relationship); setDescription(memory.description);
      setOriginalPath(memory.photoPath); setOriginalAudioPath(memory.audioPath); setPhoto({ kind: 'keep' }); setLoaded(true); setError(null);
    }).catch(reason => { if (active) setError(reason instanceof MemoryError && reason.code === 'missing' ? 'memoryMissing' : 'memoryFailed'); });
    return () => { active = false; };
  }, [patientId, id, attempt]);
  const pick = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setPhotoNotice(null);
    try {
      const result = await memoryMedia.pick();
      if (result.status === 'selected') setPhoto({ kind: 'replace', photo: result.photo });
      else if (result.status !== 'canceled') setPhotoNotice(result.status === 'denied' ? 'memoryPhotoDenied' : result.status === 'unavailable' ? 'memoryPhotoUnavailable' : 'memoryPhotoFailed');
    } catch { setPhotoNotice('memoryPhotoFailed'); }
    finally { locked.current = false; setBusy(false); }
  };
  const save = async () => {
    const current = capturePatientRequest();
    if (!current()) return;
    if (!patientId || locked.current) return;
    setError(null); locked.current = true; setBusy(true);
    try {
      const input = validateMemory({ name, relationship, description });
      const result = await memoriesService.save(patientId, input, photo, id);
      if (!current()) return;
      let cleanupFailed = result.cleanupFailed;
      if (audioUri || audioDeleted) {
        const audioResult = await memoriesService.saveRecording(patientId, result.memory.id, audioUri, current);
        cleanupFailed = cleanupFailed || audioResult.cleanupFailed;
      }
      if (!current()) return;
      router.dismissTo({ pathname: '/patient/my-memory', params: { id: result.memory.id, cleanup: cleanupFailed ? '1' : '0' } });
    } catch (reason) { setError(reason instanceof MemoryError ? reason.code === 'invalid' ? 'memoryInvalid' : reason.code === 'photo' ? 'memoryPhotoFailed' : reason.code === 'cleanup' ? 'memorySaveCleanup' : reason.code === 'missing' ? 'memoryMissing' : 'memoryFailed' : 'memoryFailed'); }
    finally { locked.current = false; setBusy(false); }
  };
  const heading: TranslationKey = step === 0 ? 'memoryChoosePhoto' : step === 1 ? 'memoryName' : step === 2 ? 'memoryRelationship' : step === 3 ? 'memoryDescription' : 'voiceMemory';
  const hasPhoto = photo.kind === 'replace' || (photo.kind === 'keep' && originalPath !== null);
  return <ScreenWrapper scroll key={step}><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} variant="outline" disabled={busy}
      onPress={() => { if (step > 0) { setStep(step - 1); setError(null); } else if (id) router.dismissTo({ pathname: '/patient/my-memory', params: { id } }); else router.dismissTo('/patient/my-memories'); }} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, id ? 'memoryEdit' : 'memoryAdd')}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{t(language, 'stepProgress', { current: String(step + 1), total: '5' })}</ThemedText>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(language, heading)}</ThemedText>
    {(error || patientFailed) && <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, error ?? 'memoryFailed')}</ThemedText>
      {(!loaded || patientFailed) && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} disabled={busy} onPress={() => { retryPatient(); setAttempt(n => n + 1); }} />}
    </View>}
    {!patientId || !loaded ? (!error && !patientFailed && <SmaranLoading label={t(language, 'loadingSetup')} />) : <>
      {step === 0 && <>
        <ThemedText>{t(language, 'memoryPhotoHelp')}</ThemedText>
        <MemoryPhoto patientId={patientId} path={photo.kind === 'keep' ? originalPath : null} selected={photo.kind === 'replace' ? photo.photo : undefined} name={name} language={language} />
        {photoNotice && <ThemedText accessibilityRole="alert">{t(language, photoNotice)}</ThemedText>}
        <SmaranButton label={t(language, hasPhoto ? 'memoryChangePhoto' : 'memoryChoosePhoto')} accessibilityLabel={t(language, hasPhoto ? 'memoryChangePhoto' : 'memoryChoosePhoto')}
          size="large" disabled={busy} loading={busy} onPress={() => void pick()} />
        {hasPhoto && <SmaranButton label={t(language, 'memoryRemovePhoto')} accessibilityLabel={t(language, 'memoryRemovePhoto')} disabled={busy} variant="outline" onPress={() => { setPhoto({ kind: 'remove' }); setPhotoNotice(null); }} />}
      </>}
      {step === 1 && <Field label={t(language, 'memoryName')} value={name} onChangeText={setName} maxLength={100} multiline editable={!busy} />}
      {step === 2 && <Field label={t(language, 'memoryRelationship')} value={relationship} onChangeText={setRelationship} maxLength={100} multiline editable={!busy} />}
      {step === 3 && <>
        <ThemedText>{t(language, 'memoryDetailsHelp')}</ThemedText>
        <Field label={t(language, 'memoryDescription')} value={description} onChangeText={setDescription} maxLength={500}
          multiline style={{ minHeight: 144, maxHeight: 200 }} scrollEnabled editable={!busy} />
      </>}
      {step === 4 && <>
        {originalAudioPath && !audioDeleted && !audioUri && (
          <View style={styles.group}>
             <ThemedText>{t(language, 'voiceSaved')}</ThemedText>
             <SmaranButton label={t(language, 'voiceDelete')} accessibilityLabel={t(language, 'voiceDelete')} variant="outline" onPress={() => setAudioDeleted(true)} disabled={busy} />
          </View>
        )}
        {(!originalAudioPath || audioDeleted || audioUri) && (
          <MemoryAudioRecorder language={language} onRecorded={setAudioUri} />
        )}
      </>}
      <SmaranButton label={t(language, step === 4 ? 'memorySave' : step === 0 && !hasPhoto ? 'memoryWithoutPhoto' : 'continue')}
        accessibilityLabel={t(language, step === 4 ? 'memorySave' : step === 0 && !hasPhoto ? 'memoryWithoutPhoto' : 'continue')}
        size="large" disabled={busy} loading={busy} onPress={() => {
          if (step === 4) void save();
          else if (step === 1 && !name.trim()) setError('memoryInvalid');
          else { setError(null); setStep(step + 1); }
        }} />
      <ReadScreenButton language={language} text={[t(language, heading), step === 0 ? t(language, 'memoryPhotoHelp') : step === 1 ? name : step === 2 ? relationship : `${t(language, 'memoryDetailsHelp')} ${description}`].join(' ')} />
    </>}
  </View></ScreenWrapper>;
}
