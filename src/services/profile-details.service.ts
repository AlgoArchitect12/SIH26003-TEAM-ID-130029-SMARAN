import { getSecureValue, setSecureValue } from './secure-storage.service';
import { validateRecordId } from '../utils/validation';
import { displayDateOfBirth, parseDateOfBirth } from '../utils/date-of-birth';

const key = (patientId: string) => `smaran.dob.${validateRecordId(patientId)}` as const;

export async function getDateOfBirth(patientId: string) {
  const value = await getSecureValue(key(patientId));
  if (value !== null && parseDateOfBirth(displayDateOfBirth(value)) !== value) throw new Error('Invalid saved date of birth.');
  return value;
}

export async function saveDateOfBirth(patientId: string, iso: string) {
  if (parseDateOfBirth(displayDateOfBirth(iso)) !== iso) throw new Error('Invalid date of birth.');
  await setSecureValue(key(patientId), iso);
}
