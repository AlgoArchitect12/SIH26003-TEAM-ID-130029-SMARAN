import { SYNC_COLUMNS as previous } from './care-sync-columns';
export const LOCATION_COLUMNS = ['id', 'patient_id', 'latitude', 'longitude', 'accuracy', 'recorded_at', 'source'] as const;
export const SYNC_COLUMNS = { ...previous, patient_locations: LOCATION_COLUMNS } as const;
export type SyncEntity = keyof typeof SYNC_COLUMNS;
