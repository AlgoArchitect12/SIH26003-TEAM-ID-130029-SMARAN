export const LOCATION_TTL = 24 * 60 * 60 * 1000;
export const LOCATION_LIMIT = 288;
export const STALE_AFTER = 5 * 60 * 1000;
export type LocationPoint = { id: string; latitude: number; longitude: number; accuracy: number | null; recorded_at: string };
export type SafeZone = { latitude: number; longitude: number; radius: number };
export type LocationSnapshot = { owner: boolean; consent: boolean; enabled: boolean; epoch: string;
  display_name?: string | null;
  zone: SafeZone | null; point: LocationPoint | null; history: LocationPoint[];
  event: { kind: 'entry' | 'exit'; at: string } | null; device_status: string; revision: number };
export function validPoint(point: LocationPoint, now = Date.now()) {
  return !!point && typeof point.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(point.id) &&
    Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
    (point.accuracy === null || (Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 10000000)) &&
    typeof point.recorded_at === 'string' && Number.isFinite(Date.parse(point.recorded_at)) && Date.parse(point.recorded_at) <= now + 60000 &&
    Date.parse(point.recorded_at) >= now - LOCATION_TTL;
}
export function freshness(point: LocationPoint | null, now = Date.now()) {
  return !point || !validPoint(point, now) ? 'gpsUnavailable' : now - Date.parse(point.recorded_at) > STALE_AFTER ? 'gpsStale' : 'gpsCurrent';
}
export function newerSnapshot(old: LocationSnapshot | null, next: LocationSnapshot) {
  return old && old.revision > next.revision ? old : next;
}
export function validZone(zone: SafeZone) {
  return Number.isFinite(zone.latitude) && Math.abs(zone.latitude) <= 90 && Number.isFinite(zone.longitude) &&
    Math.abs(zone.longitude) <= 180 && Number.isFinite(zone.radius) && zone.radius >= 100 && zone.radius <= 10000;
}
