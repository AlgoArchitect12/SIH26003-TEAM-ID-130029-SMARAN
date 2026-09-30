import { Linking, Platform } from 'react-native';
import { patientRepository } from '../db/repositories/patient.repository';
import { normalizeIndianPhone } from '../utils/validation';
import { capturePatientRequest } from '../stores/patient-session.store';

export async function readEmergencyContact(patientId: string) {
  const profile = await patientRepository.getProfileById(patientId);
  const phone = normalizeIndianPhone(profile?.emergencyPhone);
  return phone ? { name: profile?.emergencyName ?? '', phone } : null;
}

// Called only after confirmation; reread to reject edited contacts and switched profiles.
export async function openEmergencyDialer(patientId: string, confirmedPhone: string, current = capturePatientRequest()) {
  if (!current() || Platform.OS === 'web') throw new Error('Dialer unavailable');
  const contact = await readEmergencyContact(patientId);
  if (!current() || !contact || contact.phone !== confirmedPhone) throw new Error('Contact changed');
  await Linking.openURL(`tel:${contact.phone}`);
}
