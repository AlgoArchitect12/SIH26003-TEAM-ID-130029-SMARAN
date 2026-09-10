import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
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

export default function MemoryEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { patientId, language, failed: patientFailed, retry: retryPatient } = usePatient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [description, setDescription] = useState('');
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [photo, setPhoto] = useState<MemoryPhotoChange>({ kind: 'keep' });
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
      setOriginalPath(memory.photoPath); setPhoto({ kind: 'keep' }); setLoaded(true); setError(null);
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
      router.dismissTo({ pathname: '/patient/my-memory', params: { id: result.memory.id, cleanup: result.cleanupFailed ? '1' : '0' } });
    } catch (reason) { setError(reason instanceof MemoryError ? reason.code === 'invalid' ? 'memoryInvalid' : reason.code === 'photo' ? 'memoryPhotoFailed' : reason.code === 'cleanup' ? 'memorySaveCleanup' : reason.code === 'missing' ? 'memoryMissing' : 'memoryFailed' : 'memoryFailed'); }
    finally { locked.current = false; setBusy(false); }
  };
  const heading: TranslationKey = step === 0 ? 'memoryChoosePhoto' : step === 1 ? 'memoryName' : step === 2 ? 'memoryRelationship' : 'memoryDescription';
  const hasPhoto = photo.kind === 'replace' || (photo.kind === 'keep' && originalPath !== null);
  return <ScreenWrapper scroll key={step}><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} variant="outline" disabled={busy}
      onPress={() => { if (step > 0) { setStep(step - 1); setError(null); } else if (id) router.dismissTo({ pathname: '/patient/my-memory', params: { id } }); else router.dismissTo('/patient/my-memories'); }} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, id ? 'memoryEdit' : 'memoryAdd')}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{t(language, 'stepProgress', { current: String(step + 1), total: '4' })}</ThemedText>
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
        <Field label={t(language, 'memoryDescription')} value={description} onChangeText={setDescription} maxLength={500} multiline editable={!busy} />
      </>}
      <SmaranButton label={t(language, step === 3 ? 'memorySave' : step === 0 && !hasPhoto ? 'memoryWithoutPhoto' : 'continue')}
        accessibilityLabel={t(language, step === 3 ? 'memorySave' : step === 0 && !hasPhoto ? 'memoryWithoutPhoto' : 'continue')}
        size="large" disabled={busy} loading={busy} onPress={() => {
          if (step === 3) void save();
          else if (step === 1 && !name.trim()) setError('memoryInvalid');
          else { setError(null); setStep(step + 1); }
        }} />
      <ReadScreenButton language={language} text={[t(language, heading), step === 0 ? t(language, 'memoryPhotoHelp') : step === 1 ? name : step === 2 ? relationship : `${t(language, 'memoryDetailsHelp')} ${description}`].join(' ')} />
    </>}
  </View></ScreenWrapper>;
}
