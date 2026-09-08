import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { resolveActivePatient } from '@services/active-patient.service';
import { myDayService } from '@services/my-day.service';

export const unstable_settings = { initialRouteName: 'home' };

export default function PatientLayout() {
  useEffect(() => {
    const sync = () => { void resolveActivePatient().then(result => {
      if (result.status === 'ready') return myDayService.sync(result.profile.id);
    }).catch(() => { /* My Day provides the visible retry state. */ }); };
    sync();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => subscription.remove();
  }, []);
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />;
}
