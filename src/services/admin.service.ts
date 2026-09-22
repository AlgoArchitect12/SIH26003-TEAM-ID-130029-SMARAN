import { AppState } from 'react-native';
import { create } from 'zustand';
import { captureAccount, getCloudClient, useAuthStore } from '../cloud/auth';
import { validateLocation, type PatientLocation } from '../location/types';
import { parseReportFacts, type ActivityReport } from '../caregiver/reports';
import { validateRecordId } from '../utils/validation';
import { getDatabase } from '../db/client';
import { selectActivePatient } from './profile-switching.service';

type AdminPatient = { patient: { id: string; preferred_name: string }; location: PatientLocation | null; reports: ActivityReport[] };
export const useAdminStore = create<{
  mode: 'normal' | 'authenticating' | 'admin'; ownerId: string | null; patients: AdminPatient[]; failed: boolean;
}>(() => ({ mode: 'normal', ownerId: null, patients: [], failed: false }));
let generation = 0;
export function exitAdmin() {
  generation++;
  useAdminStore.setState({ mode: 'normal', ownerId: null, patients: [], failed: false });
}
export async function enterAdmin() {
  const account = captureAccount(), request = ++generation;
  useAdminStore.setState({ mode: 'authenticating', patients: [], ownerId: null, failed: false });
  try {
    if (!account.current()) throw new Error('Sign in first.');
    const result = await getCloudClient().rpc('admin_patients').abortSignal(account.signal);
    if (request !== generation || !account.current()) return false;
    if (result.error || !Array.isArray(result.data)) throw new Error('Admin authorization unavailable.');
    const patients = result.data as AdminPatient[];
    for (const row of patients) {
      validateRecordId(row.patient.id);
      if (typeof row.patient.preferred_name !== 'string' || !Array.isArray(row.reports)) throw new Error('Invalid admin data.');
      if (row.location) {
        validateLocation(row.location);
        if (row.location.patient_id !== row.patient.id) throw new Error('Location ownership mismatch.');
      }
      for (const report of row.reports) {
        if (report.patient_id !== row.patient.id) throw new Error('Report ownership mismatch.');
        parseReportFacts(report.snapshot);
      }
    }
    useAdminStore.setState({ mode: 'admin', ownerId: account.ownerId, patients });
    return true;
  } catch {
    if (request === generation) useAdminStore.setState({ mode: 'normal', ownerId: null, patients: [], failed: true });
    return false;
  }
}
export async function manageAdminPatient(patientId: string) {
  if (!await enterAdmin()) throw new Error('Admin authorization required.');
  const account = captureAccount();
  if (!useAdminStore.getState().patients.some(row => row.patient.id === patientId)) throw new Error('Patient is not authorized.');
  const owner = await (await getDatabase()).getFirstAsync<{ owner_id: string }>('SELECT owner_id FROM sync_patient_owners WHERE patient_id=?',validateRecordId(patientId));
  if (!account.current() || owner?.owner_id !== account.ownerId) throw new Error('Sync this patient to this phone first.');
  await selectActivePatient(patientId);
}
export function startAdminLifecycle() {
  const account = useAuthStore.subscribe((next, before) => {
    if (next.revision !== before.revision || next.status !== 'signed-in' || next.ownerId !== before.ownerId) exitAdmin();
  });
  // Revalidate server role on return; no cached admin access while offline.
  const app = AppState.addEventListener('change', value => {
    if (value !== 'active') exitAdmin();
  });
  return () => { account(); app.remove(); exitAdmin(); };
}
