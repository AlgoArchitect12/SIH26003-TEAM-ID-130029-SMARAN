import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  AgeBracket,
  CreatePatientProfileInput,
  Language,
  PatientProfile,
  PatientSettings,
  Region,
  TextSize,
  UpdatePatientProfileInput,
  UpdatePatientSettingsInput,
} from '../schema.types';
import { getDatabase } from '../client';
import {
  validateCreatePatientProfile,
  validateRecordId,
  validateUpdatePatientProfile,
  validateUpdatePatientSettings,
} from '../../utils/validation';

type PatientProfileRow = {
  id: string;
  user_id: string | null;
  preferred_name: string;
  age_bracket: AgeBracket | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  created_at: string;
  updated_at: string;
};

type PatientSettingsRow = {
  id: string;
  patient_id: string;
  language: Language;
  region: Region;
  text_size: TextSize;
  high_contrast: number;
  voice_guidance: number;
  reduced_motion: number;
  updated_at: string;
};

function mapProfile(row: PatientProfileRow): PatientProfile {
  return {
    id: row.id,
    userId: row.user_id,
    preferredName: row.preferred_name,
    ageBracket: row.age_bracket,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row: PatientSettingsRow): PatientSettings {
  return {
    id: row.id,
    patientId: row.patient_id,
    language: row.language,
    region: row.region,
    textSize: row.text_size,
    highContrast: row.high_contrast === 1,
    voiceGuidance: row.voice_guidance === 1,
    reducedMotion: row.reduced_motion === 1,
    updatedAt: row.updated_at,
  };
}

async function generateRecordId(database: SQLiteDatabase) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const row = await database.getFirstAsync<{ id: string }>(`
    SELECT lower(hex(randomblob(4))) || '-' ||
      lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2, 3) || '-' ||
      '8' ||
      substr(lower(hex(randomblob(2))), 2, 3) || '-' ||
      lower(hex(randomblob(6))) AS id
  `);
  if (!row?.id) {
    throw new Error('Could not generate a local record ID.');
  }
  return row.id;
}

async function getProfileByIdFrom(database: SQLiteDatabase, id: string) {
  const row = await database.getFirstAsync<PatientProfileRow>(
    'SELECT * FROM patient_profiles WHERE id = ?',
    validateRecordId(id)
  );
  return row ? mapProfile(row) : null;
}

async function upsertProfileIn(database: SQLiteDatabase, input: CreatePatientProfileInput) {
  const profile = validateCreatePatientProfile(input);
  const id = profile.id ?? (await generateRecordId(database));
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO patient_profiles (
      id, user_id, preferred_name, age_bracket, emergency_name, emergency_phone, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      preferred_name = excluded.preferred_name,
      age_bracket = excluded.age_bracket,
      emergency_name = excluded.emergency_name,
      emergency_phone = excluded.emergency_phone,
      updated_at = excluded.updated_at`,
    id,
    profile.userId,
    profile.preferredName,
    profile.ageBracket,
    profile.emergencyName,
    profile.emergencyPhone,
    now,
    now
  );

  const saved = await getProfileByIdFrom(database, id);
  if (!saved) {
    throw new Error('Patient profile could not be read after saving.');
  }
  return saved;
}

async function getSettingsFrom(database: SQLiteDatabase, patientId: string) {
  const row = await database.getFirstAsync<PatientSettingsRow>(
    'SELECT * FROM patient_settings WHERE patient_id = ?',
    validateRecordId(patientId, 'Patient ID')
  );
  return row ? mapSettings(row) : null;
}

async function upsertSettingsIn(
  database: SQLiteDatabase,
  patientId: string,
  input: UpdatePatientSettingsInput = {}
) {
  const id = validateRecordId(patientId, 'Patient ID');
  const settings = validateUpdatePatientSettings(input);
  const current = await getSettingsFrom(database, id);
  const recordId = current?.id ?? (await generateRecordId(database));
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO patient_settings (
      id, patient_id, language, region, text_size,
      high_contrast, voice_guidance, reduced_motion, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(patient_id) DO UPDATE SET
      language = excluded.language,
      region = excluded.region,
      text_size = excluded.text_size,
      high_contrast = excluded.high_contrast,
      voice_guidance = excluded.voice_guidance,
      reduced_motion = excluded.reduced_motion,
      updated_at = excluded.updated_at`,
    recordId,
    id,
    settings.language ?? current?.language ?? 'en',
    settings.region ?? current?.region ?? 'assam',
    settings.textSize ?? current?.textSize ?? 'large',
    Number(settings.highContrast ?? current?.highContrast ?? false),
    Number(settings.voiceGuidance ?? current?.voiceGuidance ?? true),
    Number(settings.reducedMotion ?? current?.reducedMotion ?? false),
    now
  );

  const saved = await getSettingsFrom(database, id);
  if (!saved) {
    throw new Error('Patient settings could not be read after saving.');
  }
  return saved;
}

async function getProfile() {
  const database = await getDatabase();
  // MVP-2 supports one active local patient. Profile selection is deferred to onboarding.
  const row = await database.getFirstAsync<PatientProfileRow>(
    'SELECT * FROM patient_profiles ORDER BY created_at ASC LIMIT 1'
  );
  return row ? mapProfile(row) : null;
}

async function getProfileById(id: string) {
  return getProfileByIdFrom(await getDatabase(), id);
}

async function upsertProfile(input: CreatePatientProfileInput) {
  return upsertProfileIn(await getDatabase(), input);
}

async function updateProfile(id: string, input: UpdatePatientProfileInput) {
  const database = await getDatabase();
  const current = await getProfileByIdFrom(database, id);
  if (!current) {
    throw new Error('Patient profile was not found.');
  }
  const update = validateUpdatePatientProfile(input);
  return upsertProfileIn(database, {
    id: current.id,
    userId: update.userId === undefined ? current.userId : update.userId,
    preferredName:
      update.preferredName === undefined ? current.preferredName : update.preferredName,
    ageBracket: update.ageBracket === undefined ? current.ageBracket : update.ageBracket,
    emergencyName:
      update.emergencyName === undefined ? current.emergencyName : update.emergencyName,
    emergencyPhone:
      update.emergencyPhone === undefined ? current.emergencyPhone : update.emergencyPhone,
  });
}

async function getSettings(patientId: string) {
  return getSettingsFrom(await getDatabase(), patientId);
}

async function upsertSettings(patientId: string, input: UpdatePatientSettingsInput = {}) {
  return upsertSettingsIn(await getDatabase(), patientId, input);
}

async function updateSettings(patientId: string, input: UpdatePatientSettingsInput) {
  const database = await getDatabase();
  if (!(await getSettingsFrom(database, patientId))) {
    throw new Error('Patient settings were not found.');
  }
  return upsertSettingsIn(database, patientId, input);
}

async function upsertProfileWithSettings(
  profileInput: CreatePatientProfileInput,
  settingsInput: UpdatePatientSettingsInput = {}
) {
  const database = await getDatabase();
  let result: { profile: PatientProfile; settings: PatientSettings } | null = null;

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const profile = await upsertProfileIn(transaction, profileInput);
    const settings = await upsertSettingsIn(transaction, profile.id, settingsInput);
    result = { profile, settings };
  });

  if (!result) {
    throw new Error('Patient profile and settings could not be saved.');
  }
  return result;
}

export const patientRepository = {
  getProfile,
  getProfileById,
  getSettings,
  updateProfile,
  updateSettings,
  upsertProfile,
  upsertProfileWithSettings,
  upsertSettings,
} as const;
