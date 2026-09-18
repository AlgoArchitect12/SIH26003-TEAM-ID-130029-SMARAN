import { resolveActivePatient } from './active-patient.service';
import { capturePatientRequest } from '../stores/patient-session.store';
import { careCircleRepository as repo, checkCareRequest } from '../db/repositories/care-circle.repository';
import type { CareMemberInput } from '../caregiver/care-circle';

// Only used while completing a newly created local profile. Reuse a committed member on retry.
export async function saveOnboardingCareMember(patientId: string, input: CareMemberInput) {
  const current = capturePatientRequest();
  const members = await repo.list(patientId);
  checkCareRequest(current);
  if (members.length > 1 || members.some(member => member.status !== 'local')) throw new Error('Reopen Care Circle.');
  return repo.save(patientId, input, current, members[0]?.id);
}

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
