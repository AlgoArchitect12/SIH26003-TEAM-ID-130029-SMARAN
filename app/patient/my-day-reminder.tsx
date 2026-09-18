import { Redirect } from 'expo-router';

// Legacy patient links never open administrative schedule controls.
export default function PatientReminderRoute() {
  return <Redirect href="/patient/my-day" />;
}
