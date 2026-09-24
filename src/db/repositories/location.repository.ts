import { getDatabase } from '../client';
import { LOCATION_LIMIT, LOCATION_TTL, validPoint, type LocationPoint } from '../../location/live';
export type LocationDevice = { patient_id: string; owner_id: string; epoch: string; enabled: number; pending_control: 'pause' | 'revoke' | null };
const check = (current: () => boolean) => { if (!current()) throw new Error('gpsSignIn'); };
export const locationRepository = {
  async controls(owner: string) {
    return (await getDatabase()).getAllAsync<LocationDevice>('SELECT * FROM location_device WHERE owner_id=? AND pending_control IS NOT NULL',owner);
  },
  async device(patient: string, owner: string) {
    return (await getDatabase()).getFirstAsync<LocationDevice>('SELECT * FROM location_device WHERE patient_id=? AND owner_id=?',patient,owner);
  },
  async configure(patient: string, owner: string, epoch: string, enabled: boolean, current: () => boolean) {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async tx => {
      check(current);
      if (!await tx.getFirstAsync('SELECT 1 FROM sync_patient_owners WHERE patient_id=? AND owner_id=?',patient,owner)) throw new Error('gpsSignIn');
      await tx.runAsync('DELETE FROM location_queue WHERE patient_id=? AND (epoch<>? OR ?=0)',patient,epoch,Number(enabled));
      await tx.runAsync(`INSERT INTO location_device(patient_id,owner_id,epoch,enabled,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(patient_id) DO UPDATE SET owner_id=excluded.owner_id,epoch=excluded.epoch,enabled=excluded.enabled,pending_control=NULL,updated_at=excluded.updated_at`,
      patient,owner,epoch,Number(enabled),new Date().toISOString());
      check(current);
    });
  },
  async stop(patient: string, owner: string, action: 'pause' | 'revoke', current: () => boolean) {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async tx => {
      check(current);
      await tx.runAsync('UPDATE location_device SET enabled=0,pending_control=? WHERE patient_id=? AND owner_id=?',action,patient,owner);
      await tx.runAsync('DELETE FROM location_queue WHERE patient_id=? AND owner_id=?',patient,owner);
      check(current);
    });
  },
  async enqueue(device: LocationDevice, point: LocationPoint, current: () => boolean) {
    if (!validPoint(point)) return;
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async tx => {
      check(current);
      await tx.runAsync(`INSERT OR IGNORE INTO location_queue(id,patient_id,owner_id,epoch,payload,recorded_at)
        SELECT ?,patient_id,owner_id,epoch,?,? FROM location_device WHERE patient_id=? AND owner_id=? AND epoch=? AND enabled=1 AND pending_control IS NULL`,
      point.id,JSON.stringify(point),point.recorded_at,device.patient_id,device.owner_id,device.epoch);
      await tx.runAsync(`DELETE FROM location_queue WHERE recorded_at<? OR id IN
        (SELECT id FROM location_queue WHERE patient_id=? ORDER BY recorded_at DESC LIMIT -1 OFFSET ?)`,
      new Date(Date.now()-LOCATION_TTL).toISOString(),device.patient_id,LOCATION_LIMIT);
      check(current);
    });
  },
  async pending(device: LocationDevice) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM location_queue WHERE recorded_at<?',new Date(Date.now()-LOCATION_TTL).toISOString());
    const rows = await db.getAllAsync<{payload:string}>(`SELECT payload FROM location_queue WHERE patient_id=? AND owner_id=? AND epoch=? ORDER BY recorded_at LIMIT 25`,device.patient_id,device.owner_id,device.epoch);
    return rows.map(row=>JSON.parse(row.payload) as LocationPoint);
  },
  async acknowledge(device: LocationDevice, points: LocationPoint[]) {
    const db = await getDatabase();
    for (const point of points) await db.runAsync('DELETE FROM location_queue WHERE id=? AND owner_id=? AND epoch=?',point.id,device.owner_id,device.epoch);
  },
};
