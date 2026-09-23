const assert = require('node:assert/strict');
const { create } = require('zustand');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, seed, A, B } = require('./check-auth-sync-migration.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const { initialSyncState, deriveSyncStatus } = load('src/cloud/sync-status.ts');

function modelChecks() {
  const base = { ...initialSyncState, ownerId: A, linked: true, connected: true };
  for (const [patch, expected] of [
    [{}, 'signed-in'], [{ connected: false }, 'offline'], [{ connected: false, pending: 4 }, 'offline'],
    [{ pending: 4 }, 'waiting'], [{ active: true, pending: 4, failed: 1, error: 'sync' }, 'syncing'],
    [{ error: 'sync' }, 'attention'], [{ failed: 1 }, 'attention'], [{ error: 'network' }, 'offline'],
    [{ lastSuccess: '2026-09-01T00:00:00Z', needsSync: false }, 'current'],
    [{ lastSuccess: '2026-09-01T00:00:00Z', needsSync: true }, 'signed-in'],
    [{ lastSuccess: '2026-09-01T00:00:00Z', needsSync: false, pending: 1 }, 'waiting'],
    [{ linked: false, paused: true, connected: false }, 'paused'], [{ ownerId: null, pending: 4 }, 'local'],
  ]) assert.equal(deriveSyncStatus({ ...base, ...patch }), expected);
  console.log('PASS sync status model: offline/online/pending/active/error/synced/consent precedence; no false success.');
}

async function lifecycleChecks() {
  const { sqlite, db } = createDatabase();
  const repo = load('src/db/repositories/sync.repository.ts', { '../client': { getDatabase: async () => db } }).syncRepository;
  await load('src/db/migrations/index.ts').runMigrations(db);
  const domain = await seed(db);
  await repo.link(A, () => true);
  assert.equal(await repo.includesPatient(A, 'one'), true);
  assert.equal(await repo.includesPatient(B, 'one'), false);
  const auth = create(() => ({ ownerId: A, revision: 0, status: 'signed-in', busy: false }));
  let controller = new AbortController();
  const captureAccount = () => {
    const { ownerId, revision } = auth.getState(), signal = controller.signal;
    return { ownerId, signal, current: () => !!ownerId && !signal.aborted && auth.getState().ownerId === ownerId &&
      auth.getState().revision === revision && auth.getState().status === 'signed-in' };
  };
  const switchAccount = ownerId => {
    controller.abort(); controller = new AbortController();
    auth.setState(s => ({ ownerId, revision: s.revision + 1, status: ownerId ? 'signed-in' : 'local' }));
  };
  let mode = 'ok', blocked = null, calls = [], networkListener, appListener, removedNetwork = false, removedApp = false;
  let networkState = { isConnected: false, isInternetReachable: false };
  const initialNetwork = deferred();
  let networkRead = () => initialNetwork.promise;
  const app = { currentState: 'active', addEventListener: (_event, cb) => { appListener = cb; return { remove() { removedApp = true; } }; } };
  const rpc = (name, args) => ({ abortSignal: async () => {
    calls.push({ name, owner: auth.getState().ownerId });
    if (blocked) { const waiting = blocked; blocked = null; await waiting.promise; }
    if (mode === 'error') return { error: {}, status: 503 };
    if (name === 'push_mutations') return { error: null, data: args.events.map(e => ({ mutation_id: e.mutation_id, status: 'applied' })) };
    if (mode === 'local-during-pull') { mode = 'ok'; await domain.patient.updateProfile('one', { preferredName: 'Newer local edit' }); }
    return { error: null, data: { records: [], parents: [], cursor: args.after_version, has_more: false } };
  } });
  const timers = new Map(), originalInterval = global.setInterval, originalClear = global.clearInterval;
  const sync = load('src/cloud/sync.ts', {
    'react-native': { AppState: app },
    'expo-network': {
      getNetworkStateAsync: () => networkRead(),
      addNetworkStateListener: cb => { networkListener = cb; return { remove() { removedNetwork = true; } }; },
    },
    './auth': { captureAccount, useAuthStore: auth, getCloudClient: () => ({ rpc }),
      validateSession: async () => { auth.setState({ status: 'signed-in' }); },
      sessionExpired: () => switchAccount(null),
      invalidateCloudWork: () => switchAccount(auth.getState().ownerId) },
    '../db/repositories/sync.repository': { syncRepository: repo },
  });
  let stop;
  const settle = async () => { await tick(); await sync.syncNow(); await tick(); };
  try {
    global.setInterval = (fn, delay) => { timers.set(delay, fn); return delay; };
    global.clearInterval = id => timers.delete(id);
    stop = sync.startSyncLifecycle();
    networkListener(networkState);
    // An old initial read must not overwrite a newer connectivity event.
    initialNetwork.resolve({ isConnected: true, isInternetReachable: true });
    await tick(); await tick();
    assert.equal(sync.useSyncStore.getState().connected, false);
    assert.equal(sync.useSyncStore.getState().status, 'offline');
    assert.equal(calls.length, 0, 'no cloud attempt on known offline network');
    const before = (await repo.status(A)).pending;
    await domain.patient.updateProfile('one', { preferredName: 'Offline saved locally' });
    timers.get(2000)(); await tick();
    assert.equal(sync.useSyncStore.getState().pending, before + 1, 'offline metadata poll reads real committed queue');
    assert.equal(sqlite.prepare("SELECT preferred_name FROM patient_profiles WHERE id='one'").get().preferred_name, 'Offline saved locally');
    networkState = { isConnected: true, isInternetReachable: true };
    networkRead = async () => networkState;
    const wait = deferred(); blocked = wait;
    networkListener(networkState); await tick();
    assert.equal(sync.useSyncStore.getState().status, 'syncing');
    assert.equal(calls.length, 1, 'reconnection starts existing pipeline without advancing timer');
    timers.get(2000)(); await tick();
    assert.equal(sync.useSyncStore.getState().status, 'syncing', 'metadata refresh cannot hide active sync');
    const coalesced = sync.syncNow(true); assert.equal(calls.length, 1, 'manual retry coalesces');
    wait.resolve(); await coalesced; await tick();
    assert.equal(sync.useSyncStore.getState().status, 'current');
    assert.equal((await repo.status(A)).pending, 0);
    const success = sync.useSyncStore.getState().lastSuccess; assert.ok(success);
    mode = 'error'; await sync.syncNow();
    assert.equal(sync.useSyncStore.getState().status, 'attention');
    assert.equal(sync.useSyncStore.getState().lastSuccess, success, 'failed pull does not update success timestamp');
    timers.get(2000)(); await tick(); assert.equal(sync.useSyncStore.getState().status, 'attention');
    mode = 'ok'; await sync.syncNow(true); assert.equal(sync.useSyncStore.getState().status, 'current');
    // Success/poll race: a routine poll starting during the authoritative
    // success read must not discard the error clearing.
    mode = 'error'; await sync.syncNow();
    assert.equal(sync.useSyncStore.getState().status, 'attention');
    mode = 'ok';
    const wrappedStatus = repo.status;
    let successReads = 0;
    try {
      repo.status = async owner => {
        successReads++;
        const state = await wrappedStatus(owner);
        // Third metadata read of a clean manual pass is the success commit
        // (initial, post-push, commit). Fire a routine poll while in flight.
        if (successReads === 3) { timers.get(2000)(); await tick(); await tick(); }
        return state;
      };
      await sync.syncNow(true);
    } finally { repo.status = wrappedStatus; }
    await tick(); await tick();
    assert.equal(sync.useSyncStore.getState().status, 'current', 'routine poll cannot overwrite success');
    assert.equal(sync.useSyncStore.getState().error, null);
    assert.equal((await repo.status(A)).pending, 0);
    mode = 'local-during-pull'; await sync.syncNow();
    assert.equal((await repo.status(A)).pending, 1, 'concurrent local write blocks pull and is retained');
    assert.notEqual(sync.useSyncStore.getState().status, 'current');
    await sync.syncNow(true);
    auth.setState({ status: 'offline' }); await tick();
    assert.equal(sync.useSyncStore.getState().status, 'offline');
    assert.equal(sync.useSyncStore.getState().ownerId, A, 'offline session can read its own metadata');
    await sync.syncNow(); assert.equal(sync.useSyncStore.getState().status, 'current', 'session validation resumes sync');
    await sync.pauseCloudSync();
    const pausedCalls = calls.length;
    networkListener({ isConnected: false }); networkListener(networkState); await settle();
    assert.equal(calls.length, pausedCalls, 'reconnect cannot enable paused consent');
    assert.equal(sync.useSyncStore.getState().status, 'paused');
    await sync.enableCloudSync();
    app.currentState = 'background';
    networkListener({ isConnected: false }); networkListener(networkState);
    const backgroundCalls = calls.length; timers.get(30000)(); timers.get(2000)(); await tick();
    assert.equal(calls.length, backgroundCalls, 'no automatic background passes');
    app.currentState = 'active'; appListener('active'); await settle();
    assert.ok(calls.length > backgroundCalls, 'foreground rechecks connectivity and sync');
    await domain.patient.updateProfile('one', { preferredName: 'A pending at logout' });
    const old = deferred(); blocked = old;
    const inFlight = sync.syncNow(); await tick();
    switchAccount(null);
    assert.equal(sync.useSyncStore.getState().ownerId, null);
    assert.equal(sync.useSyncStore.getState().pending, 0);
    assert.equal(sync.useSyncStore.getState().lastSuccess, null);
    await repo.link(B, () => true); switchAccount(B);
    old.resolve(); await inFlight; await settle();
    assert.equal((await repo.status(A)).pending, 1, 'stale acknowledgement cannot clear A queue');
    assert.equal(sync.useSyncStore.getState().ownerId, B);
    assert.equal(sync.useSyncStore.getState().pending, 0);
    assert.ok(calls.some(c => c.owner === B), 'B gets a pass after the old writer finishes');
    assert.ok(calls.filter(c => c.owner === B).every(c => c.name !== 'push_mutations'));
    const late = deferred(); const originalStatus = repo.status;
    repo.status = async owner => { const state = await originalStatus(owner); await late.promise; return state; };
    const lateRefresh = sync.refreshSyncStatus(); switchAccount(null); late.resolve(); await lateRefresh;
    assert.equal(sync.useSyncStore.getState().ownerId, null, 'late metadata cannot restore logged-out owner');
    const beforeStop = calls.length; stop(); stop = null;
    networkListener(networkState); appListener('active'); await tick();
    assert.equal(calls.length, beforeStop); assert.equal(timers.size, 0); assert.ok(removedNetwork && removedApp);
    console.log('PASS sync lifecycle: real SQLite offline counts, reconnect, foreground, serialized retries, pull/write race, errors, consent, offline auth, logout/account switch, stale reads and listener cleanup.');
  } finally {
    stop?.(); global.setInterval = originalInterval; global.clearInterval = originalClear; sqlite.close();
  }
}

async function uiChecks() {
  const { t, strings } = load('src/i18n/index.ts');
  const { syncStrings } = load('src/i18n/sync-strings.ts');
  for (const language of Object.keys(strings)) {
    assert.deepEqual(Object.keys(syncStrings[language]).sort(), Object.keys(syncStrings.en).sort());
    let auth = { ownerId: A, revision: 0, status: 'signed-in', busy: false };
    let patient = { patientId: 'one', revision: 0, switching: false };
    let state = { ...initialSyncState, ownerId: A, linked: true, connected: true, pending: 3 };
    const presses = [];
    const props = { language, patientId: 'one' };
    let patientRead = async (_owner, patientId) => patientId === 'one';
    const render = screen('components/caregiver/sync-status.tsx', {
      '@/src/cloud/auth': { useAuthStore: () => auth },
      '@/src/stores/patient-session.store': { usePatientSessionStore: () => patient },
      '@/src/cloud/sync': { useSyncStore: () => state, syncNow: async manual => presses.push(manual) },
      '@/src/cloud/sync-status': { initialSyncState },
      '@/src/db/repositories/sync.repository': { syncRepository: { includesPatient: (...args) => patientRead(...args) } },
    }, props);
    render(); await tick();
    for (const [status, key] of [['offline', 'syncOfflinePending'], ['waiting', 'accountPending'], ['syncing', 'accountSyncing'],
      ['current', 'accountCurrent'], ['attention', 'syncIssue'], ['signed-in', 'syncOnline'], ['paused', 'accountPaused'], ['local', 'accountLocalStatus']]) {
      state = { ...state, status, active: status === 'syncing', connected: status !== 'offline' };
      const tree = nodes(render());
      const label = t(language, key, { count: new Intl.NumberFormat(language).format(3) });
      assert.ok(tree.some(n => n.props?.children === label), language + status);
      const live = tree.find(n => n.props?.accessibilityLiveRegion === 'polite');
      assert.ok(live.props.accessible && live.props.accessibilityLabel.includes(label));
      assert.ok(live.props.accessibilityLabel.includes(t(language, 'syncScope')));
      assert.ok(!/[{}]/.test(live.props.accessibilityLabel));
      const button = tree.find(n => n.type === 'SmaranButton');
      if (status === 'offline') { assert.equal(button, undefined); assert.ok(live.props.accessibilityLabel.includes(t(language, 'syncOfflineHelp'))); }
      if (status === 'syncing') assert.ok(button.props.disabled && button.props.loading);
      if (status === 'attention') { assert.ok(button.props.accessibilityLabel.includes(t(language, 'retry'))); button.props.onPress(); }
    }
    assert.deepEqual(presses, [true], 'UI uses existing manual pipeline');
    state = { ...state, status: 'current', lastSuccess: '2026-09-01T00:00:00Z' };
    patient = { patientId: 'two', revision: 1, switching: true };
    assert.ok(!nodes(render()).some(n => n.props?.children === t(language, 'accountCurrent')), 'switching session hides status even before screen props refresh');
    patient = { ...patient, switching: false };
    const pendingPatient = deferred(); patientRead = () => pendingPatient.promise;
    props.patientId = 'two';
    assert.ok(!nodes(render()).some(n => n.props?.children === t(language, 'accountCurrent')), 'patient switch hides old status immediately');
    props.patientId = 'unlinked'; patientRead = async () => false;
    render(); await tick(); pendingPatient.resolve(true); await tick();
    assert.ok(!nodes(render()).some(n => n.props?.children === t(language, 'accountCurrent')), 'late prior-patient lookup cannot expose old status');
    props.patientId = 'one'; patientRead = async () => true;
    patient = { patientId: 'one', revision: 2, switching: false };
    render(); await tick();
    state = { ...state, status: 'current', lastSuccess: '2026-09-01T00:00:00Z' }; auth = { ...auth, ownerId: B };
    const tree = nodes(render());
    assert.ok(tree.some(n => n.props?.children === t(language, 'accountLocalStatus')));
    assert.ok(!tree.some(n => n.props?.children === t(language, 'accountCurrent')));
    assert.ok(!tree.some(n => String(n.props?.accessibilityLabel).includes('2026')));
    render.unmount();
  }
  console.log('PASS caregiver UI: all eight display states, seven languages, interpolated counts, live screen-reader labels, busy/disabled controls, manual retry and stale-owner suppression.');
}

async function main() { modelChecks(); await lifecycleChecks(); await uiChecks(); }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
