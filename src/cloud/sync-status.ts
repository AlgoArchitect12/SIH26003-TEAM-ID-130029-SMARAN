// Keep the established account-screen names: current = synced, waiting = pending,
// attention = error, signed-in = online but not yet confirmed by a full sync.
export type SyncStatus = 'local' | 'paused' | 'signed-in' | 'offline' | 'syncing' | 'current' | 'waiting' | 'attention';
export type SyncState = {
  status: SyncStatus;
  ownerId: string | null;
  linked: boolean;
  paused: boolean;
  unlinked: number;
  pending: number;
  failed: number;
  lastSuccess: string | null;
  connected: boolean | null;
  active: boolean;
  error: 'network' | 'sync' | null;
  needsSync: boolean;
};
export const initialSyncState: SyncState = {
  status: 'local', ownerId: null, linked: false, paused: false, unlinked: 0,
  pending: 0, failed: 0, lastSuccess: null, connected: null, active: false,
  error: null, needsSync: true,
};
export function deriveSyncStatus(state: SyncState): SyncStatus {
  if (!state.ownerId) return 'local';
  if (state.error === 'sync' && !state.linked && !state.paused) return 'attention';
  if (!state.linked) return state.paused ? 'paused' : 'local';
  if (state.connected === false) return 'offline';
  if (state.active) return 'syncing';
  if (state.error === 'network') return 'offline';
  if (state.error || state.failed) return 'attention';
  if (state.pending) return 'waiting';
  if (state.needsSync) return 'signed-in';
  return state.lastSuccess ? 'current' : 'signed-in';
}
