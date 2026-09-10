import { patientRepository } from '@db/repositories/patient.repository';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { validateUpdatePatientSettings } from '@/src/utils/validation';

import {
  getSecureValue,
  SecureStorageKeys,
} from './secure-storage.service';

export type ActivePatientResolution =
  | { status: 'fresh' }
  | {
      completionConfirmed: boolean;
      profile: PatientProfile;
      settings: PatientSettings;
      status: 'ready';
    };

export async function resolveActivePatient(): Promise<ActivePatientResolution> {
  const [completionFlag, activeProfileId] = await Promise.all([
    getSecureValue(SecureStorageKeys.onboardingCompleted),
    getSecureValue(SecureStorageKeys.activeProfileId),
  ]);

  if (completionFlag !== null && completionFlag !== 'true' && completionFlag !== 'false') {
    throw new Error('Invalid saved setup state.');
  }
  // A committed profile can outlive its routing flags after an interrupted setup.
  // Only a sole local profile is safe to recover; never guess between patients.
  const profile = activeProfileId === null
    ? await patientRepository.getProfile()
    : await patientRepository.getProfileById(activeProfileId);
  if (!profile && activeProfileId === null && completionFlag !== 'true') return { status: 'fresh' };
  const settings = profile ? await patientRepository.getSettings(profile.id) : null;

  if (!profile || !settings) {
    throw new Error('Saved patient setup could not be loaded.');
  }

  validateUpdatePatientSettings(settings);

  return {
    completionConfirmed: completionFlag === 'true' && activeProfileId !== null,
    profile,
    settings,
    status: 'ready',
  };
}
