import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { PatientPage } from '@components/patient/patient-page';
import { Field, useMyDayPatient } from '@components/my-day/shared';
import { DateOfBirthField } from '@components/onboarding/date-of-birth-field';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { ThemedText } from '@components/themed-text';
import { patientRepository } from '@db/repositories/patient.repository';
import { t } from '@i18n/index';
import { getDateOfBirth, saveDateOfBirth } from '@services/profile-details.service';
import { displayDateOfBirth, parseDateOfBirth } from '@/src/utils/date-of-birth';
import { validatePreferredName, validateOptionalName, normalizeIndianPhone } from '@/src/utils/validation';

export default function ProfileScreen() {
  const patient = useMyDayPatient();
  const { patientId, language } = patient;
  const [profile, setProfile] = useState<{ preferredName: string; emergencyName: string; emergencyPhone: string; dob: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void attempt;
    if (patientId) {
      setLoadFailed(false);
      void Promise.all([patientRepository.getProfileById(patientId), getDateOfBirth(patientId)]).then(([saved, dob]) => {
        if (!saved) throw new Error('Missing profile.');
        if (active) setProfile({ preferredName: saved.preferredName, emergencyName: saved.emergencyName ?? '',
          emergencyPhone: saved.emergencyPhone ?? '', dob: dob ? displayDateOfBirth(dob) : '' });
      }).catch(() => { if (active) setLoadFailed(true); });
    }
    return () => { active = false; };
  }, [patientId, attempt]));
  const save = async () => {
    if (!patientId || !profile || locked.current) return;
    const dob = parseDateOfBirth(profile.dob);
    if (!dob) { setMessage(t(language, 'dobInvalid')); return; }
    let input;
    try { input = { preferredName: validatePreferredName(profile.preferredName),
      emergencyName: validateOptionalName(profile.emergencyName), emergencyPhone: normalizeIndianPhone(profile.emergencyPhone) }; }
    catch { setMessage(t(language, 'checkDetails')); return; }
    locked.current = true; setBusy(true); setMessage('');
    try {
      await patientRepository.updateProfile(patientId, input);
      await saveDateOfBirth(patientId, dob);
      setMessage(t(language, 'saved'));
    } catch { setMessage(t(language, 'saveFailed')); }
    finally { locked.current = false; setBusy(false); }
  };
  return <PatientPage {...patient} title={t(language, 'myProfile')} failed={patient.failed || loadFailed}
    retry={() => { patient.retry(); setAttempt(n => n + 1); }}>
    {!profile ? <SmaranLoading label={t(language, 'loadingSetup')} /> : <>
      <Field label={t(language, 'preferredName')} value={profile.preferredName} editable={!busy} autoCapitalize="words" maxLength={80}
        onChangeText={preferredName => setProfile({ ...profile, preferredName })} />
      <DateOfBirthField disabled={busy} language={language} value={profile.dob} onChange={dob => setProfile({ ...profile, dob })} />
      <Field label={`${t(language, 'emergencyName')} (${t(language, 'optional')})`} value={profile.emergencyName} editable={!busy} maxLength={80}
        onChangeText={emergencyName => setProfile({ ...profile, emergencyName })} />
      <Field label={`${t(language, 'emergencyPhone')} (${t(language, 'optional')})`} value={profile.emergencyPhone} editable={!busy} keyboardType="phone-pad" maxLength={24}
        onChangeText={emergencyPhone => setProfile({ ...profile, emergencyPhone })} />
      {!!message && <ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>}
      <SmaranButton label={t(language, busy ? 'saving' : 'saveChanges')} accessibilityLabel={t(language, 'saveChanges')}
        onPress={() => void save()} disabled={busy} loading={busy} />
    </>}
  </PatientPage>;
}
