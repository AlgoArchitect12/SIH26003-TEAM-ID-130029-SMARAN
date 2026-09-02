import {
  AgeBrackets,
  Languages,
  Regions,
  TextSizes,
  type AgeBracket,
  type CreatePatientProfileInput,
  type UpdatePatientProfileInput,
  type UpdatePatientSettingsInput,
} from '../db/schema.types';

const NAME_MAX_LENGTH = 80;
const IDENTIFIER_MAX_LENGTH = 128;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function cleanText(value: string) {
  return value
    .normalize('NFC')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '')
    .replace(/<[^>]*>/gu, '')
    .replace(/[<>]/gu, '')
    .trim()
    .replace(/\s+/gu, ' ');
}

function validateLength(value: string, label: string, maxLength: number) {
  if ([...value].length > maxLength) {
    throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }
}

export function validatePreferredName(value: unknown) {
  if (typeof value !== 'string') {
    throw new ValidationError('Preferred name is required.');
  }

  const name = cleanText(value);
  if (!name) {
    throw new ValidationError('Preferred name is required.');
  }
  validateLength(name, 'Preferred name', NAME_MAX_LENGTH);
  return name;
}

export function validateOptionalName(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('Emergency contact name must be text.');
  }

  const name = cleanText(value);
  if (!name) {
    return null;
  }
  validateLength(name, 'Emergency contact name', NAME_MAX_LENGTH);
  return name;
}

export function normalizeIndianPhone(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('Emergency phone number is invalid.');
  }

  const phone = value.trim().replace(/[\s()-]/gu, '');
  const match = phone.match(/^(?:\+91)?([6-9]\d{9})$/u);
  if (!match) {
    throw new ValidationError('Enter a valid Indian mobile number.');
  }
  return `+91${match[1]}`;
}

export function validateAgeBracket(value: unknown): AgeBracket | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !AgeBrackets.includes(value as AgeBracket)) {
    throw new ValidationError('Age bracket is invalid.');
  }
  return value as AgeBracket;
}

export function validateRecordId(value: unknown, label = 'Record ID') {
  if (typeof value !== 'string') {
    throw new ValidationError(`${label} is required.`);
  }
  const id = value.trim();
  if (!id) {
    throw new ValidationError(`${label} is required.`);
  }
  validateLength(id, label, IDENTIFIER_MAX_LENGTH);
  return id;
}

function validateOptionalRecordId(value: unknown, label: string) {
  return value === undefined || value === null ? null : validateRecordId(value, label);
}

export function validateCreatePatientProfile(input: CreatePatientProfileInput) {
  return {
    id: input.id === undefined ? undefined : validateRecordId(input.id),
    userId: validateOptionalRecordId(input.userId, 'User ID'),
    preferredName: validatePreferredName(input.preferredName),
    ageBracket: validateAgeBracket(input.ageBracket),
    emergencyName: validateOptionalName(input.emergencyName),
    emergencyPhone: normalizeIndianPhone(input.emergencyPhone),
  };
}

export function validateUpdatePatientProfile(input: UpdatePatientProfileInput) {
  return {
    ...(input.userId !== undefined
      ? { userId: validateOptionalRecordId(input.userId, 'User ID') }
      : {}),
    ...(input.preferredName !== undefined
      ? { preferredName: validatePreferredName(input.preferredName) }
      : {}),
    ...(input.ageBracket !== undefined ? { ageBracket: validateAgeBracket(input.ageBracket) } : {}),
    ...(input.emergencyName !== undefined
      ? { emergencyName: validateOptionalName(input.emergencyName) }
      : {}),
    ...(input.emergencyPhone !== undefined
      ? { emergencyPhone: normalizeIndianPhone(input.emergencyPhone) }
      : {}),
  };
}

export function validateUpdatePatientSettings(input: UpdatePatientSettingsInput) {
  if (input.language !== undefined && !Languages.includes(input.language)) {
    throw new ValidationError('Language is invalid.');
  }
  if (input.region !== undefined && !Regions.includes(input.region)) {
    throw new ValidationError('Region is invalid.');
  }
  if (input.textSize !== undefined && !TextSizes.includes(input.textSize)) {
    throw new ValidationError('Text size is invalid.');
  }
  for (const value of [input.highContrast, input.voiceGuidance, input.reducedMotion]) {
    if (value !== undefined && typeof value !== 'boolean') {
      throw new ValidationError('Accessibility settings must be true or false.');
    }
  }
  return input;
}
