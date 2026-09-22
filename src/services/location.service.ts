import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { locationRepository as repo } from '../db/repositories/location.repository';
import { trackingStatus, type PatientLocation } from '../location/types';
import { captureReminderManagement } from '../stores/patient-session.store';
import { resolveActivePatient } from './active-patient.service';
import { useAuthStore } from '../cloud/auth';
import { syncNow } from '../cloud/sync';

export const LOCATION_TASK = 'smaran-patient-location-v1';
export const useLocationStore = create(() => ({ revision: 0 }));
const changed = () => useLocationStore.setState(s => ({ revision: s.revision + 1 }));
let work: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = work.then(action, action); work = next.catch(() => {}); return next;
}
function point(value: Location.LocationObject, source: PatientLocation['source']) {
  return { latitude: value.coords.latitude, longitude: value.coords.longitude, accuracy: value.coords.accuracy,
    recorded_at: new Date(value.timestamp).toISOString(), source };
}
async function stop() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
async function reconcile(requestPermissions = false) {
  const state = await repo.enabled();
  if (!state) { await stop(); return; }
  try {
    if (!await TaskManager.isAvailableAsync()) throw new Error('Use a native development build.');
    const services = await Location.hasServicesEnabledAsync();
    const foreground = services && (requestPermissions ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync()).granted;
    const background = foreground && (requestPermissions ? await Location.requestBackgroundPermissionsAsync() : await Location.getBackgroundPermissionsAsync()).granted;
    const status = trackingStatus(true, services, foreground, background);
    if (status !== 'ACTIVE') { await stop(); await repo.status(state.patient_id, status); return; }
    if (!await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 60000,
        deferredUpdatesDistance: 50, deferredUpdatesInterval: 60000,
        pausesUpdatesAutomatically: true, showsBackgroundLocationIndicator: true,
        foregroundService: { notificationTitle: 'SMARAN AI location tracking',
          notificationBody: 'Patient location tracking is enabled. Pause it in Caregiver → Location.', killServiceOnDestroy: true },
      });
    }
    await repo.status(state.patient_id, 'ACTIVE');
    const fallback = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60000 }).catch(() => null);
    if (fallback) await repo.record(state.patient_id, state.consented_at, [point(fallback, 'last_known')]);
  } catch {
    await repo.status(state.patient_id, 'ERROR');
  } finally { changed(); }
}

// Defined at module scope so the OS can deliver a headless background batch.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    await serial(async () => {
      const state = await repo.enabled();
      if (!state) return;
      try {
        if (error) { await repo.status(state.patient_id, 'ERROR'); return; }
        const services = await Location.hasServicesEnabledAsync();
        const fg = await Location.getForegroundPermissionsAsync(), bg = await Location.getBackgroundPermissionsAsync();
        const status = trackingStatus(true, services, fg.granted, bg.granted);
        await repo.status(state.patient_id, status);
        if (status !== 'ACTIVE') { await stop(); return; }
        await repo.record(state.patient_id, state.consented_at, (data?.locations ?? []).map(value => point(value, 'background')));
      } catch { await repo.status(state.patient_id, 'ERROR'); }
      finally { changed(); }
    });
    // Local commit comes first. Existing consent/auth gates decide whether sync can run.
    await syncNow();
  });
}

export function setPatientTracking(patientId: string, enabled: boolean) {
  const current = captureReminderManagement();
  return serial(async () => {
    if (Platform.OS === 'web') throw new Error('Tracking requires a native build.');
    const active = await resolveActivePatient();
    if (!current() || active.status !== 'ready' || active.profile.id !== patientId) throw new Error('Location patient changed.');
    // Stop the old device subscription before rebinding it to another patient.
    await stop();
    await repo.setEnabled(patientId, enabled, current);
    await reconcile(enabled);
    changed();
  });
}
export function refreshTracking() {
  if (Platform.OS === 'web') return Promise.resolve();
  return serial(() => reconcile());
}
export function startLocationLifecycle() {
  if (Platform.OS === 'web') return () => {};
  const refresh = () => { void refreshTracking().catch(() => changed()); };
  const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
  const account = useAuthStore.subscribe((next, before) => {
    if (before.ownerId && next.ownerId !== before.ownerId) void serial(async () => {
      const state = await repo.enabled();
      if (state) await repo.setEnabled(state.patient_id, false, () => true);
      await stop(); changed();
    }).catch(() => changed());
  });
  refresh();
  return () => { app.remove(); account(); };
}
