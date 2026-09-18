import { patientRepository } from '../db/repositories/patient.repository';
import type { PatientSettings, UpdatePatientSettingsInput } from '../db/schema.types';
import { useCognitiveSessionStore } from '../stores/cognitive-session.store';
import { useOnboardingStore, type ProfileDraft } from '../stores/onboarding.store';
import { setWorkspace, usePatientSessionStore } from '../stores/patient-session.store';
import { parseDateOfBirth } from '../utils/date-of-birth';
import { validateCreatePatientProfile, validateRecordId, validateUpdatePatientSettings } from '../utils/validation';
import { getDateOfBirth, saveDateOfBirth } from './profile-details.service';
import { deleteSecureValue, getSecureValue, SecureStorageKeys, setSecureValue } from './secure-storage.service';
import { stopSpeech } from './speech.service';

export async function listLocalPatients() {
  // Read failures must not look like an empty device or authorize creation.
  const [activeId, completion] = await Promise.all([
    getSecureValue(SecureStorageKeys.activeProfileId), getSecureValue(SecureStorageKeys.onboardingCompleted),
  ]);
  if (completion !== null && completion !== 'true' && completion !== 'false') throw new Error('Invalid saved setup state.');
  const profiles = await patientRepository.listProfiles();
  if (!profiles.length && (activeId !== null || completion === 'true')) throw new Error('Saved patient setup could not be loaded.');
  return { profiles, activeId: profiles.some(profile => profile.id === activeId) ? activeId : null };
}

export function applyPatientSettings(settings: PatientSettings) {
  const store = useOnboardingStore.getState();
  store.setLanguage(settings.language);
  store.setRegion(settings.region);
  store.setAccessibilityPreferences({ highContrast: settings.highContrast, reducedMotion: settings.reducedMotion,
    textSize: settings.textSize, voiceGuidance: settings.voiceGuidance });
}

export function leavePatientForSelection() {
  setWorkspace('patient');
  usePatientSessionStore.setState(state => ({ revision: state.revision + 1, patientId: null }));
  useCognitiveSessionStore.getState().clear();
  useOnboardingStore.getState().resetOnboarding();
  void stopSpeech();
}

export async function selectActivePatient(patientId: string) {
  if (usePatientSessionStore.getState().switching) throw new Error('A patient switch is already in progress.');
  patientId = validateRecordId(patientId);
  usePatientSessionStore.setState(state => ({ revision: state.revision + 1, switching: true }));
  useCognitiveSessionStore.getState().clear();
  try {
    await stopSpeech(true);
    // Validate before writing either routing flag. A failing read preserves the old selection.
    await listLocalPatients();
    const profile = await patientRepository.getProfileById(patientId);
    const settings = await patientRepository.getSettings(patientId);
    if (!profile || !settings) throw new Error('Saved patient setup could not be loaded.');
    validateUpdatePatientSettings(settings);
    await getDateOfBirth(patientId);
    // Clearing a completed creation marker never removes its profile or DOB.
    if (await getSecureValue(SecureStorageKeys.pendingPersonId) === patientId) {
      await deleteSecureValue(SecureStorageKeys.pendingPersonId);
    }
    // Active ID is the final persistent write: failed completion writes cannot switch patients.
    await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
    await setSecureValue(SecureStorageKeys.activeProfileId, patientId);
    useOnboardingStore.getState().resetOnboarding();
    applyPatientSettings(settings);
    usePatientSessionStore.setState({ patientId });
    return profile;
  } finally {
    usePatientSessionStore.setState({ switching: false });
  }
}

// A single shared-device creation at a time. The marker holds only a reserved ID, never form data.
let adding = false;
let preparing: Promise<{ id: string; profile: Awaited<ReturnType<typeof patientRepository.getProfileById>> }> | null = null;
export function beginAddPerson() {
  preparing ??= prepareAddPerson().finally(() => { preparing = null; });
  return preparing;
}

async function prepareAddPerson() {
  const { profiles, activeId } = await listLocalPatients();
  if (!profiles.length) throw new Error('Use first-time onboarding.');
  let id = await getSecureValue(SecureStorageKeys.pendingPersonId);
  if (id !== null) validateRecordId(id);
  // A previous successful activation may have been interrupted before marker cleanup.
  if (id === activeId) {
    await deleteSecureValue(SecureStorageKeys.pendingPersonId);
    id = null;
  }
  if (id === null) {
    id = await patientRepository.newProfileId();
    if (await patientRepository.getProfileById(id) || await getDateOfBirth(id) !== null) {
      throw new Error('Could not reserve a new person ID.');
    }
    await setSecureValue(SecureStorageKeys.pendingPersonId, id);
  }
  return { id, profile: await patientRepository.getProfileById(id) };
}

export async function saveAdditionalPerson(id: string, draft: ProfileDraft, settings: UpdatePatientSettingsInput) {
  if (adding) throw new Error('A person is already being saved.');
  adding = true;
  try {
    id = validateRecordId(id);
    if (await getSecureValue(SecureStorageKeys.pendingPersonId) !== id) throw new Error('Reopen Add Person.');
    const existing = await patientRepository.getProfileById(id);
    if (!existing) {
      const input = validateCreatePatientProfile({ ...draft, id });
      validateUpdatePatientSettings(settings);
      const dob = parseDateOfBirth(draft.dateOfBirth);
      if (!dob || !settings.language || !settings.region) throw new Error('Incomplete setup.');
      // Stage DOB for this reserved ID before committing the profile/settings transaction.
      // A crash here leaves no selectable half-profile; retry reuses the same reserved ID.
      await saveDateOfBirth(id, dob);
      await patientRepository.createAdditionalProfileWithSettings({ ...input, id }, settings);
    }
    const profile = await patientRepository.getProfileById(id);
    if (!profile || !await patientRepository.getSettings(id) || !await getDateOfBirth(id)) throw new Error('Incomplete saved person.');
    return profile;
  } finally { adding = false; }
}

export async function finishAddPerson(id: string) {
  if (!await patientRepository.getProfileById(id)) throw new Error('Person is not saved.');
  if (await getSecureValue(SecureStorageKeys.pendingPersonId) === id) {
    await deleteSecureValue(SecureStorageKeys.pendingPersonId);
  }
}
