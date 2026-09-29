import { patientRepository } from '@db/repositories/patient.repository';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { validateRecordId, validateUpdatePatientSettings } from '@/src/utils/validation';
import { capturePatientRequest } from '../stores/patient-session.store';
import { withTimeout } from '../utils/with-timeout';

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

export class PatientSelectionRequiredError extends Error {}

export function resolveActivePatient(): Promise<ActivePatientResolution> {
  return withTimeout(readActivePatient());
}

async function readActivePatient(): Promise<ActivePatientResolution> {
  const current = capturePatientRequest();
  const [completionFlag, activeProfileId] = await Promise.all([
    getSecureValue(SecureStorageKeys.onboardingCompleted),
    getSecureValue(SecureStorageKeys.activeProfileId),
  ]);
  if (!current()) throw new Error('Patient selection changed.');

  if (completionFlag !== null && completionFlag !== 'true' && completionFlag !== 'false') {
    throw new Error('Invalid saved setup state.');
  }
  // A committed profile can outlive its routing flags after an interrupted setup.
  // Only a sole local profile is safe to recover; never guess between patients.
  let profile: PatientProfile | null;
  if (activeProfileId === null) {
    const profiles = await patientRepository.listProfiles();
    if (profiles.length > 1) throw new PatientSelectionRequiredError('More than one local patient needs selection.');
    profile = profiles[0] ?? null;
  } else {
    try {
      if (validateRecordId(activeProfileId) !== activeProfileId) throw new Error('Invalid ID.');
    } catch { throw new PatientSelectionRequiredError('Saved patient setup could not be loaded.'); }
    profile = await patientRepository.getProfileById(activeProfileId);
    if (!profile) throw new PatientSelectionRequiredError('Saved patient setup could not be loaded.');
  }
  if (!profile && activeProfileId === null && completionFlag !== 'true') return { status: 'fresh' };
  const settings = profile ? await patientRepository.getSettings(profile.id) : null;

  if (!profile || !settings) {
    throw new Error('Saved patient setup could not be loaded.');
  }

  validateUpdatePatientSettings(settings);
  if (!current()) throw new Error('Patient selection changed.');

  return {
    completionConfirmed: completionFlag === 'true' && activeProfileId !== null,
    profile,
    settings,
    status: 'ready',
  };
}
