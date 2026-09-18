import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SmaranButton } from '@components/ui/smaran-button';
import { ThemedText } from '@components/themed-text';
import { patientRepository } from '@db/repositories/patient.repository';
import { t } from '@i18n/index';
import { saveDateOfBirth } from '@services/profile-details.service';
import { deleteSecureValue, SecureStorageKeys, setSecureValue } from '@services/secure-storage.service';
import { parseDateOfBirth } from '@/src/utils/date-of-birth';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { validateMember } from '@/src/caregiver/care-circle';
import { saveOnboardingCareMember } from '@services/care-circle.service';

export function FinishOnboarding() {
  const router = useRouter();
  const state = useOnboardingStore();
  const language = state.language ?? 'en';
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setFailed(false);
    try {
      const dob = parseDateOfBirth(state.profile.dateOfBirth);
      if (!dob || !state.role || !state.language || !state.region) throw new Error('Incomplete setup.');
      if (state.role === 'caregiver') validateMember(state.caregiver);
      const id = state.savedProfileId ?? await patientRepository.newProfileId();
      // Persist only the recovery identity/role before committing any profile data.
      await setSecureValue(SecureStorageKeys.pendingOnboarding, JSON.stringify({ id, role: state.role }));
      state.setSavedProfileId(id);
      // Keep the created ID across retries/back navigation; never overwrite another local patient.
      const result = await patientRepository.upsertProfileWithSettings({
        id, preferredName: state.profile.preferredName,
        emergencyName: state.profile.emergencyName, emergencyPhone: state.profile.emergencyPhone,
      }, { ...state.accessibility, language: state.language, region: state.region });
      state.setSavedProfileId(result.profile.id);
      await saveDateOfBirth(result.profile.id, dob);
      if (state.role === 'caregiver') await saveOnboardingCareMember(result.profile.id, state.caregiver);
      await setSecureValue(SecureStorageKeys.activeProfileId, result.profile.id);
      await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
      await deleteSecureValue(SecureStorageKeys.pendingOnboarding);
      router.replace({ pathname: '/onboarding/complete', params: { view: state.role } });
    } catch { setFailed(true); }
    finally { locked.current = false; setBusy(false); }
  };
  return <View style={{ gap: 16 }}>
    {failed && <ThemedText accessibilityRole="alert">{t(language, 'profileSaveFailed')}</ThemedText>}
    <SmaranButton label={t(language, busy ? 'saving' : failed ? 'retrySave' : 'saveFinish')}
      accessibilityLabel={t(language, 'saveFinish')} disabled={busy} loading={busy} onPress={() => void save()} size="large" />
  </View>;
}
