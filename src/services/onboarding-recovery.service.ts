import { patientRepository } from '../db/repositories/patient.repository';
import { careCircleRepository } from '../db/repositories/care-circle.repository';
import { useOnboardingStore } from '../stores/onboarding.store';
import { capturePatientRequest } from '../stores/patient-session.store';
import { validateRecordId } from '../utils/validation';
import { displayDateOfBirth } from '../utils/date-of-birth';
import { effectiveScopes } from '../caregiver/care-circle';
import { getDateOfBirth } from './profile-details.service';
import { getSecureValue, SecureStorageKeys } from './secure-storage.service';

export async function resumeOnboarding() {
  const current = capturePatientRequest();
  const marker = await getSecureValue(SecureStorageKeys.pendingOnboarding);
  if (marker === null) return null;
  const { id, role } = JSON.parse(marker);
  validateRecordId(id);
  if (role !== 'patient' && role !== 'caregiver') throw new Error('Invalid setup role.');
  const [profile, settings, dob, members] = await Promise.all([
    patientRepository.getProfileById(id), patientRepository.getSettings(id),
    getDateOfBirth(id), careCircleRepository.list(id),
  ]);
  if (!current()) throw new Error('Setup patient changed.');
  const store = useOnboardingStore.getState();
  store.resetOnboarding(); store.setRole(role); store.setSavedProfileId(id);
  if (!profile || !settings) return '/onboarding/language' as const;
  store.setLanguage(settings.language); store.setRegion(settings.region);
  store.setAccessibilityPreferences(settings);
  store.setProfileDraft({ preferredName: profile.preferredName, emergencyName: profile.emergencyName ?? '',
    emergencyPhone: profile.emergencyPhone ?? '', dateOfBirth: dob ? displayDateOfBirth(dob) : '' });
  const member = members.find(value => value.status === 'local');
  if (member) store.setCaregiverDraft({ ...member, scopes: effectiveScopes(member) });
  // Missing details are collected again; a partial profile must never bypass caregiver setup.
  return !dob ? '/onboarding/profile' as const : (role === 'caregiver' && !member) ? '/onboarding/caregiver' as const : '/onboarding/region' as const;
}
