export const TrackingStatuses = ['ACTIVE', 'PAUSED', 'PERMISSION_REQUIRED', 'LOCATION_DISABLED', 'ERROR'] as const;
export type TrackingStatus = typeof TrackingStatuses[number];
export type TrackingState = { patient_id: string; enabled: number; status: TrackingStatus; consented_at: string; updated_at: string };
export type PatientLocation = { id: string; patient_id: string; latitude: number; longitude: number; accuracy: number | null; recorded_at: string; source: 'background' | 'last_known' };

export function trackingStatus(enabled: boolean, services: boolean, foreground: boolean, background: boolean): TrackingStatus {
  if (!enabled) return 'PAUSED';
  if (!services) return 'LOCATION_DISABLED';
  return foreground && background ? 'ACTIVE' : 'PERMISSION_REQUIRED';
}
export function validateLocation(point: Omit<PatientLocation, 'id' | 'patient_id'>) {
  if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 ||
    (point.accuracy !== null && (!Number.isFinite(point.accuracy) || point.accuracy < 0)) ||
    typeof point.recorded_at !== 'string' || !Number.isFinite(Date.parse(point.recorded_at)) || !['background', 'last_known'].includes(point.source)) {
    throw new Error('Invalid location.');
  }
}
