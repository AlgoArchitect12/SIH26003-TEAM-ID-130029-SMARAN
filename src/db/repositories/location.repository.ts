import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import { validateRecordId } from '../../utils/validation';
import { validateLocation, type PatientLocation, type TrackingState, type TrackingStatus } from '../../location/types';

export const locationRepository = {
  async state(patientId: string) {
    return (await getDatabase()).getFirstAsync<TrackingState>('SELECT * FROM patient_tracking WHERE patient_id=?', validateRecordId(patientId));
  },
  async enabled() {
    return (await getDatabase()).getFirstAsync<TrackingState>('SELECT * FROM patient_tracking WHERE enabled=1');
  },
  async setEnabled(patientId: string, enabled: boolean, current: () => boolean) {
    patientId = validateRecordId(patientId);
    await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
      if (!current()) throw new Error('Location patient changed.');
      const now = new Date().toISOString();
      if (enabled) await tx.runAsync("UPDATE patient_tracking SET enabled=0,status='PAUSED',updated_at=? WHERE enabled=1", now);
      await tx.runAsync(`INSERT INTO patient_tracking(patient_id,enabled,status,consented_at,updated_at) VALUES(?,?,'PAUSED',?,?)
        ON CONFLICT(patient_id) DO UPDATE SET enabled=excluded.enabled,status='PAUSED',
        consented_at=CASE WHEN excluded.enabled=1 THEN excluded.consented_at ELSE patient_tracking.consented_at END,updated_at=excluded.updated_at`,patientId,Number(enabled),now,now);
      if (!current()) throw new Error('Location patient changed.');
    });
  },
  async status(patientId: string, status: TrackingStatus) {
    await (await getDatabase()).runAsync("UPDATE patient_tracking SET status=?,updated_at=? WHERE patient_id=? AND enabled=1",status,new Date().toISOString(),validateRecordId(patientId));
  },
  async record(patientId: string, consentedAt: string, points: readonly Omit<PatientLocation, 'id' | 'patient_id'>[]) {
    patientId = validateRecordId(patientId);
    points.forEach(validateLocation);
    await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
      const state = await tx.getFirstAsync<TrackingState>('SELECT * FROM patient_tracking WHERE patient_id=? AND enabled=1',patientId);
      if (!state || state.consented_at !== consentedAt) return;
      for (const point of points) {
        // OS batches from before consent or an earlier patient must never be relabelled.
        if (point.recorded_at < consentedAt) continue;
        await tx.runAsync(`INSERT INTO patient_locations(id,patient_id,latitude,longitude,accuracy,recorded_at,source) VALUES(?,?,?,?,?,?,?)
          ON CONFLICT(patient_id,recorded_at,latitude,longitude) DO NOTHING`,Crypto.randomUUID(),patientId,point.latitude,point.longitude,point.accuracy,point.recorded_at,point.source);
      }
    });
  },
  async recent(patientId: string) {
    return (await getDatabase()).getAllAsync<PatientLocation>('SELECT * FROM patient_locations WHERE patient_id=? ORDER BY recorded_at DESC,id DESC LIMIT 50',validateRecordId(patientId));
  },
  async latest(patientId: string) { return (await this.recent(patientId))[0] ?? null; },
};
