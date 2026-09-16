import { AppState } from 'react-native';
import { create } from 'zustand';
import { captureAccount, getCloudClient, invalidateCloudWork, sessionExpired, useAuthStore, validateSession } from './auth';
import { syncRepository as repo } from '../db/repositories/sync.repository';
import type { PullBatch, PushReceipt } from './sync-contract';

type SyncStatus = 'local' | 'signed-in' | 'offline' | 'syncing' | 'current' | 'waiting' | 'attention';
export const useSyncStore = create<{
  status: SyncStatus; linked: boolean; unlinked: number; pending: number; lastSuccess: string | null;
}>(() => ({ status: 'local', linked: false, unlinked: 0, pending: 0, lastSuccess: null }));
let running: Promise<void> | null = null;
let pausing = false;

export async function refreshSyncStatus() {
  const account = captureAccount();
  if (!account.current()) { useSyncStore.setState({ status: 'local', linked: false, unlinked: 0, pending: 0, lastSuccess: null }); return; }
  const state = await repo.status(account.ownerId!);
  if (account.current()) useSyncStore.setState({ linked: state.linked, unlinked: state.unlinked, pending: state.pending, lastSuccess: state.lastSuccess,
    status: !state.linked ? 'local' : state.failed ? 'attention' : state.pending ? 'waiting' : state.lastSuccess ? 'current' : 'signed-in' });
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
    useSyncStore.setState({ status: 'syncing', linked: true });
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
        if (account.current()) useSyncStore.setState({ status: reason === 'network' ? 'offline' : 'attention' });
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
        if (account.current()) useSyncStore.setState({ status: result.status === 0 ? 'offline' : 'attention' });
        if ((result.status === 401 || result.status === 403) && account.current()) sessionExpired();
        return;
      }
      const batch = result.data as PullBatch;
      await repo.apply(owner, batch, cursor, account.current);
      if (!account.current()) return;
      cursor = batch.cursor;
      if (!batch.has_more) { await repo.success(owner, account.current); await refreshSyncStatus(); return; }
    }
    if (account.current()) useSyncStore.setState({ status: 'waiting' });
  } catch {
    if (account.current()) {
      await refreshSyncStatus().catch(() => {});
      if (account.current()) useSyncStore.setState({ status: 'attention' });
    }
  }
}
export function syncNow(manual = false) {
  if (pausing) return Promise.resolve();
  running ??= synchronize(manual).finally(() => { running = null; });
  return running;
}
export function startSyncLifecycle() {
  const run = () => { if (AppState.currentState === 'active') void syncNow(); };
  const auth = useAuthStore.subscribe((next, before) => {
    if (next.revision !== before.revision || next.status === 'storage-error') {
      useSyncStore.setState({ status: 'local', linked: false, unlinked: 0, pending: 0, lastSuccess: null });
    }
    if (next.ownerId && !next.busy && next.status === 'signed-in') run();
  });
  const app = AppState.addEventListener('change', state => { if (state === 'active') run(); });
  // Native AppState plus bounded polling handles reconnect without another native networking dependency.
  const timer = setInterval(run, 30000);
  run();
  return () => { clearInterval(timer); auth(); app.remove(); };
}
