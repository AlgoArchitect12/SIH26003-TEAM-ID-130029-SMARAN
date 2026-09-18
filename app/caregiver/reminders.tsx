import { Redirect } from 'expo-router';
import { MyDayContent } from '@components/my-day/my-day-content';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';

export default function CaregiverReminders() {
  const workspace = usePatientSessionStore(state => state.workspace);
  return workspace === 'caregiver' ? <MyDayContent caregiver /> : <Redirect href="/patient/my-day" />;
}
