import { patientRepository } from '@db/repositories/patient.repository';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { validateUpdatePatientSettings } from '@/src/utils/validation';

import {
  deleteSecureValue,
  getSecureValue,
  SecureStorageKeys,
} from './secure-storage.service';

export type ActivePatientResolution =
  | { status: 'fresh' }
  | { status: 'inconsistent' }
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

  if (!activeProfileId) {
    return completionFlag === 'true' ? { status: 'inconsistent' } : { status: 'fresh' };
  }

  const [profile, settings] = await Promise.all([
    patientRepository.getProfileById(activeProfileId),
    patientRepository.getSettings(activeProfileId),
  ]);

  if (!profile || !settings) {
    return { status: 'inconsistent' };
  }

  try {
    validateUpdatePatientSettings(settings);
  } catch {
    return { status: 'inconsistent' };
  }

  return {
    completionConfirmed: completionFlag === 'true',
    profile,
    settings,
    status: 'ready',
  };
}

export async function clearActivePatientFlags() {
  await Promise.all([
    deleteSecureValue(SecureStorageKeys.activeProfileId),
    deleteSecureValue(SecureStorageKeys.onboardingCompleted),
  ]);
}
