// Real SQLite + disposable PostgreSQL; only native storage and HTTP boundaries are adapted.
// Run: node scripts/check-live-database-sync.cjs [--hosted-audit]
// SMARAN_PG_BIN may name an installed PostgreSQL bin directory. No hosted writes are made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { parseEnv } = require('node:util');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { createDatabase, pre8, seed, A, B, stamp } = require('./check-auth-sync-migration.cjs');
const { harness } = require('./check-auth-cloud-hardening.cjs');
const root = path.resolve(__dirname, '..');
const games = ['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall',
  'remember_lights','number_path','sudoku_lite','chess_puzzle','word_match'];
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'";
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const record = (e, version) => ({ owner_id: e.owner_id, patient_id: e.patient_id, entity_type: e.entity_type,
  entity_id: e.entity_id, payload: JSON.parse(e.payload), deleted: e.operation === 'delete', version });

function disposablePath(directory) {
  const resolved = path.resolve(directory);
  assert.ok(resolved.startsWith(path.join(root, '.expo', 'live-database-')), 'cleanup restricted to this test directory');
  assert.equal(fs.lstatSync(resolved).isSymbolicLink(), false);
  return resolved;
}
function pgTools() {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const bin = process.env.SMARAN_PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
  return name => bin ? path.join(bin, name + suffix) : name;
}
function pgConnection(port) {
  assert.match(String(port), /^\d{4,5}$/);
  const executable = pgTools();
  const env = { ...process.env, PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8' };
  // Never inherit a developer's remote database configuration/password/service.
  for (const key of Object.keys(env)) if (/^PG/.test(key) && !['PGCONNECT_TIMEOUT','PGCLIENTENCODING'].includes(key)) delete env[key];
  const sql = input => execFileSync(executable('psql'), ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres'],
  { input, encoding: 'utf8', windowsHide: true, timeout: 30000, env, stdio: ['pipe','pipe','pipe'] }).trim();
  const rpc = (name, args, owner) => {
    assert.ok([A,B].includes(owner)); assert.ok(['push_mutations','pull_changes'].includes(name));
    const argument = name === 'push_mutations' ? sqlString(JSON.stringify(args.events)) + '::jsonb' : String(args.after_version);
    if (name === 'pull_changes') assert.ok(Number.isSafeInteger(args.after_version) && args.after_version >= 0);
    return JSON.parse(sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = ${sqlString(owner)};
      SELECT public.${name}(${argument}); COMMIT;`));
  };
  return { sql, rpc };
}
async function startPostgres(directory) {
  const executable = pgTools(), data = path.join(directory, 'postgres');
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  execFileSync(executable('initdb'), ['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C'],
    { windowsHide: true, timeout: 30000, stdio: 'pipe' });
  // Only synthetic data, on loopback, in a uniquely owned cluster; no installed service is touched.
  const stop = () => execFileSync(executable('pg_ctl'), ['-D',data,'-m','immediate','-w','stop'],
    { windowsHide: true, timeout: 30000, stdio: 'ignore' });
  try {
    // Inherited pipes can outlive pg_ctl on Windows; the server already writes its own log.
    execFileSync(executable('pg_ctl'), ['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'],
      { windowsHide: true, timeout: 30000, stdio: 'ignore' });
  } catch (error) { if(fs.existsSync(path.join(data,'postmaster.pid')))stop();throw error; }
  return { ...pgConnection(port), port, stop };
}
function postgresChecks(pg) {
  // Standalone Postgres supplies only the Supabase auth schema/claim function contract.
  // This is SQL/RLS execution, not a hosted JWT or GoTrue verification.
  pg.sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
  const grants = () => pg.sql(`SELECT json_agg(x ORDER BY table_name,grantee,privilege_type) FROM
    (SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public') x;`);
  let originalGrants;
  for (const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    pg.sql(source('supabase/migrations/' + file));
    originalGrants ??= grants();
    assert.equal(grants(), originalGrants, file + ' preserves table grants');
    console.log('PASS PostgreSQL migration ' + file);
  }
  for (const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(f => f.endsWith('.sql')).sort()) {
    pg.sql(source('supabase/tests/' + file)); console.log('PASS PostgreSQL fixture ' + file);
  }
  assert.equal(pg.sql("SELECT count(*) FROM pg_class WHERE relname IN ('sync_accounts','sync_patients','sync_records','sync_mutations') AND relrowsecurity"), '4');
  assert.equal(pg.sql("SELECT has_function_privilege('anon','public.push_mutations(jsonb)','EXECUTE') OR has_function_privilege('anon','public.pull_changes(bigint)','EXECUTE')"), 'f');
  assert.equal(pg.sql("SELECT has_function_privilege('authenticated','public.valid_sync_record(text,text,text,jsonb,text)','EXECUTE')"), 'f');
  assert.equal(pg.sql('SELECT count(*) FROM public.sync_accounts'), '0', 'SQL fixtures roll back');
  pg.sql(`INSERT INTO auth.users(id) VALUES (${sqlString(A)}),(${sqlString(B)});`);
  console.log('PASS PostgreSQL ' + pg.sql('SHOW server_version') + ': real SQL, RLS and RPC-only grants; all fixtures rolled back.');
}

async function runtime(filename) {
  const r = createDatabase(filename);
  const migrations = load('src/db/migrations/index.ts');
  let opens = 0;
  const client = load('src/db/client.ts', { 'expo-sqlite': { openDatabaseAsync: async () => { opens++; return r.db; } }, './migrations': migrations });
  await Promise.all([client.initializeDatabase(), client.getDatabase()]);
  assert.equal(opens,1,'production database initialization coalesces concurrent opens');
  const secure = new Map(), cache = new Map();
  const overrides = { '../client': client, '../db/client': client,
    '@/src/utils/validation': load('src/utils/validation.ts'),
    'expo-secure-store': { isAvailableAsync:async()=>true,getItemAsync:async key=>secure.get(key)??null,
      setItemAsync:async(key,value)=>{secure.set(key,value);},deleteItemAsync:async key=>{secure.delete(key);} } };
  r.module = file => load(file, overrides, cache);
  r.repo = r.module('src/db/repositories/sync.repository.ts').syncRepository;
  r.patient = r.module('src/db/repositories/patient.repository.ts').patientRepository;
  overrides['@db/repositories/patient.repository']={patientRepository:r.patient};
  r.cognitive = r.module('src/db/repositories/cognitive.repository.ts').cognitiveRepository;
  r.memories = r.module('src/db/repositories/memories.repository.ts').memoriesRepository;
  r.day = r.module('src/db/repositories/my-day.repository.ts').myDayRepository;
  r.care = r.module('src/db/repositories/care-circle.repository.ts').careCircleRepository;
  r.select = async patientId => {
    r.module('src/stores/patient-session.store.ts').usePatientSessionStore.setState(s=>({revision:s.revision+1,patientId}));
    const storage=r.module('src/services/secure-storage.service.ts');
    await storage.setSecureValue(storage.SecureStorageKeys.activeProfileId,patientId);
    await storage.setSecureValue(storage.SecureStorageKeys.onboardingCompleted,'true');
    return r.module('src/services/active-patient.service.ts').resolveActivePatient();
  };
  r.rows = table => r.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  r.snapshot = () => Object.fromEntries(r.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(({name}) => [name,r.rows(name)]));
  r.hash = () => createHash('sha256').update(JSON.stringify(r.snapshot())).digest('hex');
  r.integrity = () => { assert.equal(r.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok'); assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(),[]); };
  assert.equal(r.rows('schema_migrations').length, 13); r.integrity();
  return r;
}
function attachSync(r, h) {
  return load('src/cloud/sync.ts', { 'react-native': h.native, './auth': h.auth, '../db/repositories/sync.repository': { syncRepository: r.repo } });
}
async function signIn(h, owner = A) { await h.auth.accessEmail(owner === A ? 'a@example.test' : 'b@example.test', 'synthetic-pass'); }
function sessionInput(patientId, gameType) {
  const n = ({ remember_lights:4, number_path:5, sudoku_lite:3, chess_puzzle:6, word_match:3 })[gameType] ?? 2;
  return { patientId,gameType,difficulty:1,recommendedDifficulty:1,startedAt:stamp,completedAt:stamp,
    attempts:n+1,hintsUsed:1,averageResponseMs:1200,accuracy:n/(n+1),feedbackLabel:null,
    ...(gameType === 'memory_match' ? { totalPairs:n,matches:n,repeatedMistakes:0 }
      : { ...(['pattern_recognition','familiar_object','picture_recall'].includes(gameType) ? { challengesCompleted:n } : { stepsCompleted:n }),correctSelections:n,repeatedErrors:0 }) };
}
async function populate(r) {
  assert.deepEqual(r.module('src/db/schema.types.ts').CognitiveActivityTypes,games);
  const model = r.module('src/ai/adaptive-engine.ts').createInitialAdaptiveModel;
  for (const patient of ['one','two']) {
    await r.patient.upsertProfileWithSettings({ id:patient,preferredName:'Synthetic '+patient },{});
    const reminder = await r.day.save(patient,{type:'activity',title:'Synthetic walk',note:'',timeOfDay:'08:00',repeatRule:'daily',scheduledDate:null});
    await r.day.complete(patient,reminder.id,r.module('src/my-day/types.ts').localDay());
    await r.memories.save(patient,{name:'Synthetic memory',relationship:'Family',description:'Local text'},null);
    for (const game of games) await r.cognitive.saveCompletedSession(sessionInput(patient,game),{...model(patient,game),updatedAt:stamp,sampleCount:patient === 'one' ? 1 : 2});
    const member = await r.care.save(patient,{display_name:'Synthetic recipient',relationship:'Family',access_role:'family',email:'synthetic@example.invalid',phone:null,scopes:['reports']},()=>true);
    await r.care.saveRecipient(patient, member.id, '+15551234567', 'weekly', true, ()=>true);
    const report = await r.module('src/services/reports.service.ts').generateActivityReport(patient,7,()=>true,new Date('2026-09-13T12:00:00Z'));
    const facts = r.module('src/caregiver/reports.ts').parseReportFacts(report.snapshot);
    assert.deepEqual(facts.games.map(g => g.gameType),games); assert.ok(facts.games.every(g => g.sessions === 1));
    const summary = await r.cognitive.getAnalyticsSummary(patient,['2026-09-11T00:00:00.000Z','2026-09-14T00:00:00.000Z']);
    assert.equal(summary.filter(g => g.difficulty === null).length,11);
  }
  assert.equal(r.rows('sync_outbox').length,0,'no consent: writes are local only');
  await assert.rejects(r.cognitive.saveCompletedSession(sessionInput('one','invalid_game')),/Unsupported/);
}
async function migrationChecks(directory) {
  const r = createDatabase(path.join(directory,'upgrade.db'));
  try {
    await pre8(r.db); await seed(r.db);
    for (const [file,key] of [['008_auth_sync','authSyncMigration'],['009_extra_cognitive_games','extraCognitiveGamesMigration'],['010_care_circle_reports','careCircleReportsMigration']]) {
      const m = load('src/db/migrations/'+file+'.ts')[key];
      await r.db.withExclusiveTransactionAsync(async tx => { await m.up(tx); await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)',m.version,m.name,stamp); });
    }
    await r.db.runAsync('INSERT INTO sync_accounts(owner_id,linked_at,pull_cursor) VALUES(?,?,?)',A,stamp,17);
    await r.db.runAsync('INSERT INTO sync_patient_owners(patient_id,owner_id,linked_at) SELECT id,?,? FROM patient_profiles',A,stamp);
    await r.db.runAsync('UPDATE sync_installation SET default_owner_id=?',A);
    const repo = load('src/db/repositories/sync.repository.ts',{'../client':{getDatabase:async()=>r.db}}).syncRepository;
    await repo.fail(A,await repo.pending(A),'network',()=>true,1234);
    const queue = await r.db.getAllAsync('SELECT * FROM sync_outbox ORDER BY sequence');
    const profiles = await r.db.getAllAsync('SELECT * FROM patient_profiles ORDER BY id');
    const run = load('src/db/migrations/index.ts').runMigrations;
    r.db.fault = 'ALTER TABLE sync_accounts'; await assert.rejects(run(r.db),/Injected/);
    assert.equal((await r.db.getFirstAsync('SELECT count(*) n FROM schema_migrations')).n,10);
    assert.deepEqual(await r.db.getAllAsync('SELECT * FROM sync_outbox ORDER BY sequence'),queue);
    r.db.fault = null; await run(r.db); await run(r.db);
    assert.equal((await repo.status(A)).linked,false,'011 defaults upgraded accounts to backup off');
    assert.equal((await repo.status(A)).cursor,17);
    assert.deepEqual(await r.db.getAllAsync('SELECT * FROM sync_outbox ORDER BY sequence'),queue);
    assert.deepEqual(await r.db.getAllAsync('SELECT * FROM patient_profiles ORDER BY id'),profiles);
    assert.equal((await r.db.getFirstAsync('SELECT default_owner_id FROM sync_installation')).default_owner_id,null);
    assert.equal((await r.db.getFirstAsync('PRAGMA integrity_check')).integrity_check,'ok');
    assert.deepEqual(await r.db.getAllAsync('PRAGMA foreign_key_check'),[]);
    console.log('PASS populated 001–012 migration runner, 011 consent reset, cursor/queue/retry preservation, rollback and rerun.');
  } finally { r.sqlite.close(); }
}

async function lifecycleChecks(directory, pg) {
  const filename = path.join(directory,'offline.db');
  let r = await runtime(filename), h = harness(), sync = attachSync(r,h);
  const calls = [], receipts = [];
  let mode = '', gate = null;
  const connect = () => { h.rpc = async (name,args,owner) => {
    calls.push({name,args,owner});
    if (gate?.name === name) { const wait=gate;gate=null;wait.enter.resolve();await wait.release.promise; }
    if (mode === '401') return Response.json({message:'Synthetic expired session'},{status:401});
    if (mode === 'pull-fail' && name === 'pull_changes') return Response.json({message:'Synthetic unavailable'},{status:503});
    const data = pg.rpc(name,args,owner);
    if (name === 'push_mutations') receipts.push(...data);
    if (mode === 'lost' && name === 'push_mutations') throw new TypeError('Synthetic lost receipt');
    return Response.json(data);
  }; };
  connect();
  try {
    await h.auth.initializeAuth(); await populate(r); await sync.syncNow(); assert.equal(calls.length,0);
    await signIn(h); await sync.syncNow(); assert.equal(calls.length,0,'signed in without consent makes no RPC');
    h.mode = 'offline'; await sync.enableCloudSync();
    assert.equal((await r.repo.status(A)).linked,true); assert.equal(sync.useSyncStore.getState().status,'offline');
    const queue = r.rows('sync_outbox');
    assert.equal(queue.length,60); assert.ok(queue.every(e => e.owner_id === A));
    assert.equal(new Set(queue.map(e => e.mutation_id)).size,queue.length);
    const validate = r.module('src/cloud/sync-contract.ts').validateCloudRecord;
    for (const event of queue) {
      validate(record(event,1),A); assert.match(event.mutation_id,/^[a-f0-9]{32}$/);
      assert.ok(event.attempts >= 0 && event.next_attempt_at >= 0);
      // removed debug logging
      assert.equal(pg.sql(`SELECT public.valid_sync_record(${sqlString(event.entity_type)},${sqlString(event.patient_id)},${sqlString(event.entity_id)},${sqlString(event.payload)}::jsonb,'upsert')`),'t',event.entity_type+' PostgreSQL contract');
    }
    // A, B, update A, C: three business records and four immutable ordered events.
    const before = r.rows('sync_outbox').at(-1).sequence;
    const a = await r.memories.save('one',{name:'Write A',relationship:'Family',description:''},null);
    const b = await r.memories.save('one',{name:'Write B',relationship:'Family',description:''},null);
    await r.memories.save('one',{name:'Update A',relationship:'Family',description:''},null,a.id);
    const c = await r.memories.save('one',{name:'Write C',relationship:'Family',description:''},null);
    const tail = r.rows('sync_outbox').filter(e => e.sequence > before);
    assert.deepEqual(tail.map(e => e.entity_id),[a.id,b.id,a.id,c.id]);
    assert.deepEqual(tail.map(e => JSON.parse(e.payload).name),['Write A','Write B','Update A','Write C']);
    assert.deepEqual(tail.map(e => e.sequence),[before+1,before+2,before+3,before+4]);
    assert.equal(r.rows('sqlite_sequence').find(v=>v.name==='sync_outbox').seq,before+4);
    const failed = r.rows('sync_outbox').filter(e => e.attempts); assert.ok(failed.length > 0);
    const hash = r.hash(); r.integrity(); r.sqlite.close();
    execFileSync(process.execPath,[__filename,'--restart-probe',filename,hash],{cwd:root,windowsHide:true,timeout:30000,stdio:'pipe'});
    r = await runtime(filename); assert.equal(r.hash(),hash); await h.close(); h=harness();sync=attachSync(r,h);connect();
    await h.auth.initializeAuth(); await signIn(h); h.mode='offline';
    const requestCount=h.requests.length,clock=Date.now;
    // Pin before the persisted deadline: running SQL fixtures/restarting Node can exceed the two-second first backoff.
    try { Date.now=()=>failed[0].next_attempt_at-1;await sync.syncNow(); } finally { Date.now=clock; }
    assert.equal(h.requests.length,requestCount,'backoff survives runtime restart');
    console.log('PASS real SQLite offline writes: ten domains, all 11 games, analytics/reports, stable IDs, A/B/update-A/C order and separate-process restart.');

    h.mode=''; mode='pull-fail'; await sync.syncNow(true);
    assert.equal((await r.repo.status(A)).pending,0);assert.equal((await r.repo.status(A)).cursor,0);assert.equal((await r.repo.status(A)).lastSuccess,null);
    assert.equal(sync.useSyncStore.getState().status,'attention');
    const pushes = calls.filter(c=>c.name==='push_mutations').flatMap(c=>c.args.events);
    for (const preference of pushes.filter(e=>e.entity_type==='report_preferences')) {
      assert.ok(pushes.findIndex(e=>e.entity_type==='care_circle_members' && e.entity_id===preference.payload.recipient_id)<pushes.indexOf(preference));
    }
    assert.ok(receipts.every(r=>r.status==='applied')); mode=''; await sync.syncNow();
    assert.equal(sync.useSyncStore.getState().status,'current');assert.ok((await r.repo.status(A)).lastSuccess);
    assert.equal((await r.memories.get('one',a.id)).name,'Update A');
    assert.equal(pg.sql(`SELECT count(*) FROM sync_records WHERE owner_id=${sqlString(A)} AND entity_type='personal_memories'`),'5');
    const restored=await runtime(path.join(directory,'restored.db'));
    try {
      await restored.repo.link(A,h.auth.captureAccount().current);
      const reader=attachSync(restored,h);await reader.syncNow();
      assert.equal(reader.useSyncStore.getState().status,'current');assert.equal((await restored.repo.status(A)).pending,0);
      for(const [table,columns] of Object.entries(r.module('src/cloud/care-sync-columns.ts').SYNC_COLUMNS)) {
        const query=`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns.join(',')}`;
        assert.deepEqual(restored.sqlite.prepare(query).all(),r.sqlite.prepare(query).all(),'fresh receiving SQLite restores every sync field: '+table);
      }
      restored.integrity();
    } finally {restored.sqlite.close();}
    const cursor=(await r.repo.status(A)).cursor;
    console.log('PASS real PostgreSQL push/pull, fresh receiving SQLite in all ten domains, dependency order, multi-batch drain, push-success/pull-failure and successful cursor commit.');

    await r.patient.updateProfile('one',{preferredName:'Lost receipt'});mode='lost';await sync.syncNow(true);
    assert.equal((await r.repo.status(A)).pending,1);const remoteCount=pg.sql('SELECT count(*) FROM sync_mutations');
    mode='';await sync.syncNow(true);assert.equal((await r.repo.status(A)).pending,0);assert.equal(pg.sql('SELECT count(*) FROM sync_mutations'),remoteCount);
    assert.equal(receipts.at(-1).status,'duplicate');
    // Kill a separate runtime after PostgreSQL commits but before production acknowledgement handling.
    await r.patient.updateProfile('one',{preferredName:'Interrupted push'});const pendingBefore=r.rows('sync_outbox');r.sqlite.close();
    execFileSync(process.execPath,[__filename,'--interrupt-after-push',filename,String(pg.port)],{cwd:root,windowsHide:true,timeout:30000,stdio:'pipe'});
    r=await runtime(filename);assert.deepEqual(r.rows('sync_outbox'),pendingBefore);sync=attachSync(r,h);
    const committedCount=pg.sql('SELECT count(*) FROM sync_mutations');await sync.syncNow(true);
    assert.equal((await r.repo.status(A)).pending,0);assert.equal(pg.sql('SELECT count(*) FROM sync_mutations'),committedCount);assert.equal(receipts.at(-1).status,'duplicate');
    console.log('PASS lost response and process termination before acknowledgement: durable queue replay, PostgreSQL duplicate receipts, no duplicate business records.');

    await r.patient.updateProfile('one',{preferredName:'Partial acknowledgement'});
    await r.patient.updateProfile('two',{preferredName:'Validation pending'});
    const sent=await r.repo.pending(A);
    const mixed=pg.rpc('push_mutations',{events:sent.map((e,i)=>{const {owner_id,sequence,payload,...rest}=e;return {mutation_id:rest.mutation_id,patient_id:rest.patient_id,entity_type:rest.entity_type,entity_id:rest.entity_id,operation:rest.operation,payload:i?{}:JSON.parse(payload)};})},A);
    assert.deepEqual(mixed.map(e=>e.status),['applied','rejected']);assert.equal(mixed[1].error,'invalid');
    await r.repo.acknowledge(A,sent,mixed,()=>true);assert.equal((await r.repo.status(A)).pending,1);assert.equal((await r.repo.pending(A))[0].state,'failed');
    const saved=r.rows('sync_outbox');await assert.rejects(r.repo.acknowledge(A,sent,mixed.slice(0,1),()=>true),/acknowledgement/);assert.deepEqual(r.rows('sync_outbox'),saved);
    await sync.syncNow(true);assert.equal((await r.repo.status(A)).pending,0);
    assert.equal((await r.patient.getProfileById('two')).preferredName,'Validation pending');
    console.log('PASS partial applied/rejected receipts remove only acknowledged IDs; malformed/truncated receipts retain all remaining data.');

    await r.patient.updateProfile('one',{preferredName:'Paused write'});await sync.pauseCloudSync();
    const paused=r.rows('sync_outbox'),callCount=calls.length;await sync.syncNow();assert.equal(calls.length,callCount);
    await r.patient.updateProfile('two',{preferredName:'Another paused write'});assert.equal(r.rows('sync_outbox').length,paused.length+1);
    await sync.enableCloudSync();assert.equal((await r.repo.status(A)).pending,0);
    assert.ok((await r.repo.status(A)).cursor>cursor);
    console.log('PASS backup off/on/pause/resume: no paused RPC, local writes and original owner retained.');

    for (const name of ['push_mutations','pull_changes']) {
      if(name==='push_mutations')await r.patient.updateProfile('one',{preferredName:'Logout during push'});
      const enter=deferred(),release=deferred();gate={name,enter,release};
      const beforeQueue=r.rows('sync_outbox'),beforeCursor=(await r.repo.status(A)).cursor;
      const pending=sync.syncNow(true);await enter.promise;
      const logout=h.auth.logout();release.resolve();await pending;await logout;
      assert.equal(h.auth.captureAccount().current(),false);assert.deepEqual(r.rows('sync_outbox'),beforeQueue);assert.equal((await r.repo.status(A)).cursor,beforeCursor);
      await signIn(h,B);const bStart=calls.length;await sync.syncNow();assert.equal(calls.length,bStart,'B does not inherit A consent');
      assert.equal((await r.repo.status(B)).cursor,0);assert.equal((await r.repo.status(B)).pending,0);
      await sync.enableCloudSync();const bCalls=calls.slice(bStart);assert.ok(bCalls.every(c=>c.owner===B && c.name==='pull_changes'));
      const bPull=pg.rpc('pull_changes',{after_version:0},B);assert.deepEqual(bPull.records,[]);assert.deepEqual(bPull.parents,[]);
      assert.equal((await r.patient.listProfiles()).length,2,'shared-device local profiles survive');
      await sync.pauseCloudSync();assert.equal((await r.repo.status(A)).linked,true,'B pause does not pause A');
      await h.auth.logout();await signIn(h);await sync.syncNow(true);
    }
    h.mode='offline';assert.equal(await h.auth.logout(),'local-offline');h.mode='';await signIn(h);
    console.log('PASS online/offline logout and logout during push/pull: A queue/cursor protected; B cannot inherit A consent or cloud Care Circle/preferences.');

    const baseline=r.snapshot();
    const initial=queue.find(e=>e.patient_id==='one'&&e.entity_type==='patient_profiles');
    const currentCursor=(await r.repo.status(A)).cursor;
    let checks=0;
    await assert.rejects(r.repo.apply(A,{records:[record(initial,currentCursor+1)],parents:[],cursor:currentCursor+1,has_more:false},currentCursor,()=>++checks<2),/expired/);
    assert.deepEqual(r.snapshot(),baseline,'stale transaction rolls back data, versions, pull flag and cursor');
    await assert.rejects(r.repo.apply(A,{records:[{...record(initial,currentCursor+1),owner_id:B}],parents:[],cursor:currentCursor+1,has_more:false},currentCursor,()=>true),/Invalid/);
    await r.patient.updateProfile('one',{preferredName:'Local newer'});
    await assert.rejects(r.repo.apply(A,{records:[record(initial,currentCursor+1)],parents:[],cursor:currentCursor+1,has_more:false},currentCursor,()=>true),/waiting/);
    assert.equal((await r.patient.getProfileById('one')).preferredName,'Local newer');await sync.syncNow(true);
    for(const patient of ['one','two','one']) {
      assert.equal((await r.select(patient)).profile.id,patient);
      assert.equal((await r.module('src/services/care-circle.service.ts').loadActiveCare()).patient.id,patient);
      assert.equal((await r.cognitive.getRecentSessions(patient,50)).length,11);
      for(const game of games)assert.equal((await r.cognitive.getAdaptiveModel(patient,game)).sampleCount,patient==='one'?1:2);
      assert.equal((await r.day.list(patient)).length,1);assert.equal((await r.care.list(patient)).length,1);assert.equal((await r.care.reports(patient)).length,1);
      const member=(await r.care.list(patient))[0];
    }
    const firstMemory=(await r.memories.list('one'))[0],firstMember=(await r.care.list('one'))[0],firstReport=(await r.care.reports('one'))[0];
    assert.equal(await r.memories.get('two',firstMemory.id),null);assert.equal(await r.care.get('two',firstMember.id),null);assert.equal(await r.care.report('two',firstReport.id),null);
    await assert.rejects(r.care.saveRecipient('two', firstMember.id, '+15551234567', 'weekly', true, ()=>true));
    const patientSession=r.module('src/stores/patient-session.store.ts');
    const currentPatient=patientSession.capturePatientRequest(),beforeSessions=r.rows('cognitive_sessions');
    const run=r.db.runAsync;r.db.runAsync=async(...args)=>{const result=await run(...args);if(args[0].includes('INSERT INTO cognitive_sessions'))patientSession.usePatientSessionStore.setState(s=>({revision:s.revision+2,patientId:'one'}));return result;};
    await assert.rejects(r.cognitive.saveCompletedSession(sessionInput('one','word_match'),undefined,currentPatient),/changed/);
    r.db.runAsync=run;assert.deepEqual(r.rows('cognitive_sessions'),beforeSessions);
    // Sync is account-wide; switching the visible patient must never retarget a captured event.
    await r.memories.save('one',{name:'Async one',relationship:'Family',description:''},null);
    const enter=deferred(),release=deferred();gate={name:'push_mutations',enter,release};const work=sync.syncNow();await enter.promise;
    await r.select('two');release.resolve();await work;
    assert.equal(pg.sql(`SELECT patient_id FROM sync_records WHERE payload->>'name'='Async one'`),'one');
    r.integrity();
    console.log('PASS cursor transaction rollback, local-write protection, patient A/B/A isolation and stale asynchronous patient work.');
    await failureChecks(r,h,sync,()=>{mode='401';},()=>{mode='';});
  } finally { await h.close(); r.sqlite.close(); }
}

async function failureChecks(r,h,sync,unauthorized,clear) {
  await r.patient.updateProfile('one',{preferredName:'Auth retry'});const id=(await r.repo.pending(A))[0].mutation_id;
  unauthorized();await sync.syncNow(true);assert.equal((await r.repo.pending(A))[0].mutation_id,id);assert.equal(h.auth.useAuthStore.getState().status,'expired');
  const calls=h.requests.length;await sync.syncNow();assert.equal(h.requests.length,calls,'expired auth never sends RPC');
  clear();await signIn(h);await sync.syncNow(true);
  await r.patient.updateProfile('one',{preferredName:'Timeout retry'});h.mode='timeout';
  await sync.syncNow(true);assert.equal((await r.repo.status(A)).pending,1);assert.equal((await r.repo.pending(A))[0].attempts,1);
  h.mode='';await sync.syncNow(true);assert.equal((await r.repo.status(A)).pending,0);
  await r.patient.updateProfile('one',{preferredName:'Offline during refresh failure'});
  const beforeRefresh=r.rows('sync_outbox');
  h.errorCode='refresh_token_not_found';h.httpStatus=400;
  const result=await h.auth.getCloudClient().auth.refreshSession();assert.ok(result.error);
  assert.equal(h.auth.captureAccount().current(),true,'SDK preserves an access token that has not expired after proactive refresh failure');
  const clock=Date.now,future=clock()+3600001;
  try { Date.now=()=>future;const expired=await h.auth.getCloudClient().auth.refreshSession();assert.ok(expired.error); }
  finally { Date.now=clock; }
  assert.equal(h.auth.captureAccount().current(),false,'expired token plus rejected refresh invalidates the account');
  h.errorCode='';await signIn(h);
  const wait=deferred();h.pause=wait;
  const refresh=h.auth.getCloudClient().auth.refreshSession();await tick();await tick();
  const logout=h.auth.logout();wait.resolve();await refresh;await logout;
  assert.equal(h.auth.useAuthStore.getState().ownerId,null);assert.equal(h.values.size,0);
  assert.deepEqual(r.rows('sync_outbox'),beforeRefresh,'refresh failure/logout never removes pending mutations');
  assert.equal((await r.patient.listProfiles()).length,2);r.integrity();
  console.log('PASS real SDK 401/expired auth, bounded timeout, refresh failure and logout during refresh; local records survive.');
}

async function statusChecks() {
  const r=await runtime(':memory:'),h=harness(),sync=attachSync(r,h);
  try {
    await h.auth.initializeAuth();await signIn(h);await r.repo.link(A,()=>true);await r.repo.success(A,()=>true);
    h.rpc=async()=>Response.json({message:'Synthetic pull failure'},{status:503});
    await sync.syncNow();assert.equal(sync.useSyncStore.getState().status,'attention');
    await sync.refreshSyncStatus();assert.equal(sync.useSyncStore.getState().status,'attention','opening Account must not erase a failed pull with an old success timestamp');
    const enter=deferred(),release=deferred();h.rpc=async()=>{enter.resolve();await release.promise;return Response.json({records:[],parents:[],cursor:0,has_more:false});};
    const pending=sync.syncNow();await enter.promise;await sync.refreshSyncStatus();
    const during=sync.useSyncStore.getState().status;release.resolve();await pending;
    assert.equal(during,'syncing','opening Account during pull cannot claim Synced');
    assert.equal(sync.useSyncStore.getState().status,'current');
    const success=r.repo.success,states=[];
    r.repo.success=async(owner,current)=>{
      await r.patient.upsertProfileWithSettings({id:'racing-write',preferredName:'Synthetic race'},{});
      await r.repo.link(owner,current);return success(owner,current);
    };
    const stop=sync.useSyncStore.subscribe(state=>{if(state.status==='current'&&r.rows('sync_outbox').length)states.push(state.status);});
    try {await sync.syncNow();} finally {stop();r.repo.success=success;}
    assert.deepEqual(states,[],'a write arriving before completion must never flash Synced');
    assert.equal(sync.useSyncStore.getState().status,'waiting');
    await sync.pauseCloudSync();assert.equal(sync.useSyncStore.getState().status,'paused','paused consent needs an explicit status');
    const {screen,nodes}=require('./check-privacy-recovery.cjs');const {t}=load('src/i18n/index.ts');
    const state=sync.useSyncStore.getState();
    for(const language of ['en','hi','as','bn','mni','kha','lus']) {
      const render=screen('app/account.tsx',{'react-native':{Platform:{OS:'android'},View:'View'},'expo-router':{useRouter:()=>({canGoBack:()=>false,replace(){}})},
        '@/src/stores/onboarding.store':{useOnboardingStore:select=>select({language})},'@/src/cloud/config':{cloudConfig:{},AccountError:load('src/cloud/config.ts').AccountError},
        '@/src/cloud/auth':{useAuthStore:()=>h.auth.useAuthStore.getState(),initializeAuth:async()=>{}},
        '@/src/cloud/sync':{useSyncStore:()=>state,refreshSyncStatus:async()=>{}}});
      for(const [status,key] of [['local','accountLocalStatus'],['waiting','accountPending'],['current','accountCurrent'],['attention','accountAttention'],['paused','accountPaused']]) {
        state.status=status;assert.ok(nodes(render()).some(n=>n.props?.children===t(language,key,{count:String(state.pending)})),language+' '+status);
      }
    }
    console.log('PASS status UX: stale success cannot replace failure/in-flight state; all seven languages render saved/waiting/synced/attention/paused accurately.');
  } finally {await h.close();r.sqlite.close();}
}

function hostedBlockers(versions, identity) {
  const required=['20260912000000','20260913000000','20260915000000','20260916000000'];
  const reasons=[];
  if (!Array.isArray(versions)) reasons.push('migration history not accessible with public credentials');
  else if(required.some(v=>!versions.includes(v)))reasons.push('hosted migrations behind source');
  if(!identity)reasons.push('no verified isolated authenticated test identity');
  return reasons;
}
async function hostedAudit() {
  let env={};
  for(const file of ['.env','.env.local'])if(fs.existsSync(path.join(root,file)))Object.assign(env,parseEnv(source(file)));
  env={...env,...process.env};
  const config=load('src/cloud/config.ts').readCloudConfig(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let versions=null;
  if(config) {
    const request=async(route,headers={})=>fetch(config.url+route,{headers:{apikey:config.key,...headers},signal:AbortSignal.timeout(15000),redirect:'error'});
    try {
      const result=await request('/auth/v1/settings');const body=await result.json();
      assert.ok(result.ok && body && typeof body.external==='object','valid public auth settings');
      console.log('PASS hosted reachability: public Auth settings returned HTTP '+result.status+'; URL/key omitted.');
    } catch { console.log('BLOCKED hosted reachability: unavailable or invalid public Auth response; no secrets logged.'); }
    try {
      const result=await request('/rest/v1/schema_migrations?select=version&order=version',{'Accept-Profile':'supabase_migrations'});
      if(result.ok){const body=await result.json();if(Array.isArray(body)&&body.every(r=>/^\d{14}$/.test(r.version)))versions=body.map(r=>r.version);}
      console.log(versions?'Hosted migration versions observed: '+versions.join(','):'BLOCKED hosted migration history: public API HTTP '+result.status+'; last user-observed version: 20260912000000.');
    } catch { console.log('BLOCKED hosted migration history: public API unavailable; last user-observed version: 20260912000000.'); }
  } else console.log('BLOCKED hosted reachability: valid public URL/key unavailable.');
  // Presence of strings is not proof of a confirmed, isolated test identity. Never auto-login with ambient credentials.
  const reasons=hostedBlockers(versions,false);
  for(const test of ['push','pull','reconnect','Account A/B RLS'])console.log('BLOCKED hosted '+test+': '+reasons.join('; ')+'.');
}
function sourceChecks() {
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  for(const file of files.filter(f=>(/^src\/db\/migrations\/\d/.test(f)||/^supabase\/migrations\//.test(f))&&!f.includes('013_')&&!f.includes('report_delivery')&&!f.includes('010_'))) {
    assert.equal(source(file).replace(/\r\n/g,'\n'),execFileSync('git',['show','6ce8df9:'+file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),file+' historical migration unchanged');
  }
  const patterns=[['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['AI provider key',/\b(?:sk-proj-|sk-ant-|AIza)[A-Za-z0-9_-]{24,}/],
    ['Supabase privileged key',/\bsb_secret_[A-Za-z0-9_-]{20,}/],['Google client secret',/\bGOCSPX-[A-Za-z0-9_-]{20,}/],
    ['JWT or service-role token',/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/],
    ['database URL password',/postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]{4,}@/],
    ['literal credential',/(?:access_token|refresh_token|database_password|DB_PASSWORD|client_secret)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{24,}["']/i]];
  const findings=[];
  for(const file of files.filter(f=>/\.(?:[cm]?[jt]sx?|json|sql|md|toml|ya?ml|example)$/.test(f)))for(const [type,regex]of patterns)if(regex.test(source(file)))findings.push({type,path:file});
  assert.deepEqual(findings,[],'secret scan: path/type only');
  assert.ok(execFileSync('git',['check-ignore','.env.local'],{cwd:root,encoding:'utf8'}).trim());
  for(const file of ['auth.ts','auth-storage.ts','sync.ts'])assert.doesNotMatch(source('src/cloud/'+file),/console\.(?:log|debug|warn|error)\s*\(/,'no raw auth/sync diagnostics in production');
  assert.equal(hostedBlockers(null,false).length,2);assert.equal(hostedBlockers(['20260912000000'],true).length,1);
  assert.equal(hostedBlockers(['20260912000000','20260913000000','20260915000000','20260916000000'],false).length,1);
  assert.equal(hostedBlockers(['20260912000000','20260913000000','20260915000000','20260916000000'],true).length,0);
  console.log('PASS historical migrations unchanged, tracked/untracked source secret scan, ignored .env.local, secret-safe diagnostics and hosted BLOCKED gates.');
}
async function main() {
  process.chdir(root);
  if(process.argv[2]==='--hosted-audit')return hostedAudit();
  if(process.argv[2]==='--status-probe')return statusChecks();
  if(process.argv[2]==='--restart-probe') {
    disposablePath(path.dirname(process.argv[3]));
    const r=await runtime(process.argv[3]);try{assert.equal(r.hash(),process.argv[4]);r.integrity();}finally{r.sqlite.close();}return;
  }
  if(process.argv[2]==='--interrupt-after-push') {
    disposablePath(path.dirname(process.argv[3]));
    const pg=pgConnection(process.argv[4]),r=await runtime(process.argv[3]),h=harness();
    h.rpc=async(name,args,owner)=>{assert.equal(name,'push_mutations');const data=pg.rpc(name,args,owner);assert.ok(data.every(e=>e.status==='applied'));process.exit(0);};
    await h.auth.initializeAuth();await signIn(h);await attachSync(r,h).syncNow(true);throw Error('Interruption hook was not reached');
  }
  sourceChecks();await statusChecks();fs.mkdirSync(path.join(root,'.expo'),{recursive:true});
  const directory=fs.mkdtempSync(path.join(root,'.expo','live-database-'));let pg;
  try { await migrationChecks(directory);pg=await startPostgres(directory);postgresChecks(pg);await lifecycleChecks(directory,pg); }
  catch(error) { console.error('FAIL local assertion:',error);throw error; }
  finally {
    pg?.stop();
    const target=disposablePath(directory);
    // PowerShell handles Windows/OneDrive directory attributes that Node rm may reject with EPERM.
    if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      'Remove-Item -LiteralPath $env:SMARAN_TEST_DIRECTORY -Recurse -Force -ErrorAction Stop'],
    {env:{...process.env,SMARAN_TEST_DIRECTORY:target},windowsHide:true,stdio:'pipe',timeout:30000});
    else fs.rmSync(target,{recursive:true,force:true});
  }
  console.log('PASS dedicated local database regression; disposable SQLite/PostgreSQL removed.');
  await hostedAudit();
}
if(require.main===module)main().catch(error=>{console.error('FAIL live-database regression:',error instanceof assert.AssertionError?error: error.message);process.exitCode=1;});
