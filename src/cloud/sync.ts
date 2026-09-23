import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { create } from 'zustand';
import { captureAccount, getCloudClient, invalidateCloudWork, sessionExpired, useAuthStore, validateSession } from './auth';
import { syncRepository as repo } from '../db/repositories/sync.repository';
import type { PullBatch, PushReceipt } from './sync-contract';
import { deriveSyncStatus, initialSyncState, type SyncState } from './sync-status';

export const useSyncStore = create<SyncState>(() => ({ ...initialSyncState }));
function updateStatus(patch: Partial<SyncState>) {
  useSyncStore.setState(previous => {
    const next = { ...previous, ...patch };
    const status = deriveSyncStatus(next);
    if (status === previous.status && (Object.keys(patch) as (keyof SyncState)[]).every(key => next[key] === previous[key])) return previous;
    return { ...next, status };
  });
}
function resetStatus() {
  refreshRevision++;
  updateStatus({ ...initialSyncState, connected: useSyncStore.getState().connected });
}
let running: Promise<void> | null = null;
let runningOwner: string | null = null;
let runningRevision = -1;
let refreshRevision = 0;
let pausing = false;

// Authoritative success commit. A routine 2s metadata poll that starts during
// the final read must never discard the error clearing that proves the outbox
// drained and the full pull applied. Invalidate in-flight polls before the
// read, then invalidate polls started during the read and write
// unconditionally (still gated on the same signed-in account). SQLite remains
// the source of truth; this only publishes the already-committed DB state.
async function commitSyncSuccess(owner: string, account: { current: () => boolean }) {
  refreshRevision++;
  const committed = await repo.status(owner);
  if (!account.current()) return;
  refreshRevision++;
  if (!account.current() || useAuthStore.getState().ownerId !== owner) return;
  updateStatus({ ownerId: owner, linked: committed.linked, paused: committed.paused,
    unlinked: committed.unlinked, pending: committed.pending, failed: committed.failed,
    lastSuccess: committed.lastSuccess, error: null, needsSync: committed.pending > 0 });
}

export async function refreshSyncStatus(completed = false) {
  const { ownerId, revision, status } = useAuthStore.getState();
  const account = captureAccount();
  // Reading local queue metadata is safe during an offline session. Cloud writes
  // still require captureAccount().current() and a validated signed-in session.
  if (!ownerId || !['signed-in', 'offline', 'unavailable'].includes(status) ||
      (status === 'signed-in' && !account.current())) { resetStatus(); return; }
  if (completed) {
    if (status !== 'signed-in' || !account.current()) { resetStatus(); return; }
    await commitSyncSuccess(ownerId, account);
    return;
  }
  const request = ++refreshRevision;
  const current = () => request === refreshRevision && ownerId === useAuthStore.getState().ownerId &&
    revision === useAuthStore.getState().revision && status === useAuthStore.getState().status &&
    (status !== 'signed-in' || account.current());
  try {
    const state = await repo.status(ownerId);
    if (current()) updateStatus({ ownerId, linked: state.linked, paused: state.paused,
      unlinked: state.unlinked, pending: state.pending, failed: state.failed, lastSuccess: state.lastSuccess,
      ...(status === 'offline' ? { error: 'network' } : status === 'unavailable' ? { error: 'sync' } : {}),
    });
  } catch {
    // No exception text or payload enters the UI or diagnostics.
    if (current()) updateStatus({ ownerId, error: 'sync', needsSync: true });
  }
}
export async function pauseCloudSync() {
  pausing = true;
  invalidateCloudWork();
  const account = captureAccount();
  try {
    if (!account.current()) throw new Error('Account changed.');
    await repo.pause(account.ownerId!, account.current);
    await refreshSyncStatus();
  } finally { pausing = false; }
}
export async function enableCloudSync() {
  const account = captureAccount();
  if (!account.current()) throw new Error('Sign in to enable cloud sync.');
  await repo.link(account.ownerId!, account.current);
  await syncNow();
}
async function synchronize(manual: boolean) {
  if (useAuthStore.getState().busy) return;
  if (useSyncStore.getState().connected === false) { await refreshSyncStatus(); return; }
  if (['offline', 'unavailable'].includes(useAuthStore.getState().status)) await validateSession();
  const account = captureAccount();
  if (!account.current()) return;
  const owner = account.ownerId!;
  try {
    const status = await repo.status(owner);
    if (!account.current()) return;
    if (!status.linked) { await refreshSyncStatus(); return; }
    await repo.activate(owner, account.current);
    if (manual) await repo.retry(owner, account.current);
    if (!account.current()) return;
    updateStatus({ ownerId: owner, active: true, linked: true, pending: status.pending,
      failed: status.failed, lastSuccess: status.lastSuccess, needsSync: true });
    const cloud = getCloudClient();
    // ponytail: at most 10 batches per pass; the foreground timer resumes large backlogs without monopolizing SQLite.
    for (let i = 0; i < 10 && account.current(); i++) {
      const head = await repo.pending(owner);
      if (!account.current()) return;
      if (!head.length) break;
      const eligible = head.findIndex(event => event.state === 'failed' || event.next_attempt_at > Date.now());
      const events = eligible < 0 ? head : head.slice(0, eligible);
      if (!events.length) { await refreshSyncStatus(); return; }
      const result = await cloud.rpc('push_mutations', { events: events.map(event => ({
        mutation_id: event.mutation_id, patient_id: event.patient_id, entity_type: event.entity_type,
        entity_id: event.entity_id, operation: event.operation, payload: JSON.parse(event.payload),
      })) }).abortSignal(account.signal);
      if (!account.current()) return;
      if (result.error) {
        const reason = result.status === 401 || result.status === 403 ? 'auth' : result.status === 0 ? 'network' : 'server';
        await repo.fail(owner, events, reason, account.current);
        await refreshSyncStatus();
        if (account.current()) updateStatus({ error: reason === 'network' ? 'network' : 'sync' });
        if (reason === 'auth' && account.current()) sessionExpired();
        return;
      }
      try { await repo.acknowledge(owner, events, result.data as PushReceipt[], account.current); }
      catch (error) {
        if (account.current()) await repo.fail(owner, events, 'server', account.current);
        throw error;
      }
    }
    if (!account.current()) return;
    const afterPush = await repo.status(owner);
    if (afterPush.pending) { await refreshSyncStatus(); return; }
    let cursor = afterPush.cursor;
    for (let i = 0; i < 10 && account.current(); i++) {
      const result = await cloud.rpc('pull_changes', { after_version: cursor }).abortSignal(account.signal);
      if (!account.current()) return;
      if (result.error) {
        await refreshSyncStatus();
        if (account.current()) updateStatus({ error: result.status === 0 ? 'network' : 'sync' });
        if ((result.status === 401 || result.status === 403) && account.current()) sessionExpired();
        return;
      }
      const batch = result.data as PullBatch;
      await repo.apply(owner, batch, cursor, account.current);
      if (!account.current()) return;
      cursor = batch.cursor;
      if (!batch.has_more) {
        await repo.success(owner, account.current);
        if (account.current()) await refreshSyncStatus(true);
        return;
      }
    }
    if (account.current()) updateStatus({ needsSync: true });
  } catch {
    if (account.current()) {
      await refreshSyncStatus().catch(() => {});
      if (account.current()) updateStatus({ error: 'sync' });
    }
  } finally {
    if (account.current()) updateStatus({ active: false });
  }
}
export function syncNow(manual = false): Promise<void> {
  if (pausing) return Promise.resolve();
  const { ownerId, revision } = useAuthStore.getState();
  if (running && (ownerId !== runningOwner || revision !== runningRevision)) {
    // A new account waits for cancellation of the old pass, then gets its own
    // pass. Never run two writers, or lose the new account's sign-in trigger.
    return running.then(() => {
      const now = useAuthStore.getState();
      if (now.ownerId === ownerId && now.revision === revision) return syncNow(manual);
    });
  }
  if (!running) {
    runningOwner = ownerId; runningRevision = revision;
    // Install the lock before validation can synchronously notify auth listeners.
    running = Promise.resolve().then(() => synchronize(manual)).finally(() => { running = null; });
  }
  return running;
}
export function startSyncLifecycle() {
  let live = true;
  let networkRevision = 0;
  let refreshing = false;
  const run = () => { if (live && AppState.currentState === 'active') void syncNow().catch(() => {}); };
  const refresh = () => {
    if (!live || refreshing || AppState.currentState !== 'active') return;
    refreshing = true;
    void refreshSyncStatus().finally(() => { refreshing = false; });
  };
  const networkChanged = (state: Network.NetworkState) => {
    if (!live) return;
    networkRevision++;
    const connected = state.isConnected === false || state.isInternetReachable === false ? false
      : state.isConnected === true || state.isInternetReachable === true ? true : null;
    const previous = useSyncStore.getState().connected;
    updateStatus({ connected, ...(connected === false ? { needsSync: true } : {}) });
    refresh();
    if (connected === true && previous !== true) run();
  };
  const readNetwork = async () => {
    const revision = networkRevision;
    try {
      const state = await Network.getNetworkStateAsync();
      if (state && live && revision === networkRevision) networkChanged(state);
    } catch { /* Unknown connectivity never means successful sync. The RPC can still be retried. */ }
  };
  const auth = useAuthStore.subscribe((next, before) => {
    if (next.revision !== before.revision || next.ownerId !== before.ownerId ||
        !['signed-in', 'offline', 'unavailable'].includes(next.status)) {
      resetStatus();
    }
    if (next.status === 'offline' || next.status === 'unavailable') {
      updateStatus({ active: false, needsSync: true, error: next.status === 'offline' ? 'network' : 'sync' });
    }
    refresh();
    if (next.ownerId && !next.busy && next.status === 'signed-in') run();
  });
  const app = AppState.addEventListener('change', state => {
    if (state === 'active') void readNetwork().finally(() => { refresh(); run(); });
  });
  const network = Network.addNetworkStateListener(networkChanged);
  // Metadata reads continue offline, independent of the cloud pass/backoff.
  const statusTimer = setInterval(refresh, 2000);
  const timer = setInterval(run, 30000);
  void readNetwork().finally(() => { refresh(); run(); });
  return () => { live = false; refreshRevision++; clearInterval(timer); clearInterval(statusTimer); auth(); app.remove(); network?.remove(); };
}
