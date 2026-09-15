import { resolveActivePatient } from './active-patient.service';
import { capturePatientRequest } from '../stores/patient-session.store';
import { careCircleRepository as repo, checkCareRequest } from '../db/repositories/care-circle.repository';

export async function loadActiveCare() {
  const current = capturePatientRequest();
  const active = await resolveActivePatient();
  checkCareRequest(current);
  if (active.status !== 'ready') return null;
  const [members,reports,preference] = await Promise.all([repo.list(active.profile.id),repo.reports(active.profile.id),repo.preference(active.profile.id)]);
  checkCareRequest(current);
  return {patient:active.profile,settings:active.settings,members,reports,preference,current};
}
export type ActiveCare = NonNullable<Awaited<ReturnType<typeof loadActiveCare>>>;
