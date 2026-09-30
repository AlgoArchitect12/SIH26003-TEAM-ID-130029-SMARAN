import { validateRecordId } from '../utils/validation';

export type PersonalMemoryInput = { name: string; relationship: string; description: string };
export type PersonalMemory = PersonalMemoryInput & {
  id: string; patientId: string; photoPath: string | null; audioPath: string | null; createdAt: string; updatedAt: string;
};
export type SelectedMemoryPhoto = { uri: string; extension: string };
export type MemoryPhotoChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; photo: SelectedMemoryPhoto };
export class MemoryError extends Error {
  constructor(public readonly code: 'invalid' | 'missing' | 'photo' | 'save' | 'cleanup') { super(code); }
}
export function validateMemory(input: PersonalMemoryInput): PersonalMemoryInput {
  const clean = (value: string, limit: number) => {
    if (typeof value !== 'string') throw new MemoryError('invalid');
    const result = value.normalize('NFC').trim();
    if ([...result].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) throw new MemoryError('invalid');
    return result;
  };
  const result = { name: clean(input.name, 100), relationship: clean(input.relationship, 100), description: clean(input.description, 500) };
  if (!result.name) throw new MemoryError('invalid');
  return result;
}
export function memoryPatientDirectory(patientId: string) {
  const id = validateRecordId(patientId);
  if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new MemoryError('photo');
  return `memories/${id}`;
}
export function validateMemoryPhotoPath(patientId: string, value: string | null) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.startsWith(memoryPatientDirectory(patientId) + '/') ||
    !/^memories\/[a-zA-Z0-9_-]+\/[a-f0-9]{32}\.(jpg|png|webp|heic|heif|avif|gif)$/u.test(value)) throw new MemoryError('photo');
  return value;
}

export function validateMemoryAudioPath(patientId: string, value: string | null) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.startsWith(memoryPatientDirectory(patientId) + '/') ||
    !/^memories\/[a-zA-Z0-9_-]+\/[a-f0-9]{32}\.m4a$/u.test(value)) throw new MemoryError('invalid');
  return value;
}
