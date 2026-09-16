const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, seed, pre8, A, B, stamp } = require('./check-auth-sync-migration.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const config = { ...load('src/cloud/config.ts'), cloudConfig: { url: 'https://synthetic.supabase.co', key: 'sb_publishable_synthetic' } };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = id => ({ access_token: encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: id, exp: Math.floor(Date.now()/1000)+3600 }) + '.synthetic',
  refresh_token: 'synthetic-refresh-' + id, expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer',
  user: { id, email: id === A ? 'a@example.test' : 'b@example.test', aud: 'authenticated', role: 'authenticated' } });

function harness() {
  const values = new Map(), requests = [], listeners = {};
  const h = { values, requests, fault: '', mode: '', errorCode: '', httpStatus: 400, google: true, browser: 'cancel', redirect: null, challenge: null, exchangeCount: 0,
    rpc: async () => { throw Error('Unexpected RPC'); }, pause: null, originalFetch: global.fetch };
  const owner = init => {
    const token = new Headers(init.headers).get('authorization')?.split(' ')[1];
    return token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub : null;
  };
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input)); requests.push(url.pathname);
    if (h.pause) { const wait = h.pause; h.pause = null; await wait.promise; }
    if (h.mode === 'offline') throw new TypeError('Synthetic network unavailable');
    if (h.mode === 'timeout') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Synthetic timeout', 'AbortError'))));
    if (url.pathname.includes('/rest/v1/rpc/')) return h.rpc(url.pathname.split('/').at(-1), JSON.parse(init.body), owner(init));
    if (url.pathname.endsWith('/logout')) return Response.json({});
    if (h.errorCode) return Response.json({ error_code: h.errorCode, msg: 'Synthetic auth failure' }, { status: h.httpStatus });
    if (h.mode === 'server') return Response.json({}, { status: 503 });
    if (h.mode === 'malformed') return Response.json({});
    if (url.pathname.endsWith('/settings')) return Response.json({ external: { google: h.google } });
    if (url.pathname.endsWith('/user')) return Response.json(session(owner(init)).user);
    if (url.pathname.endsWith('/signup')) {
      h.redirect = url.searchParams.get('redirect_to'); h.challenge = JSON.parse(init.body).code_challenge;
      return Response.json(h.mode === 'autoconfirm' ? session(A) : { id: A, email: 'a@example.test', identities: h.mode === 'obscured-duplicate' ? [] : [{ id: 'synthetic' }] });
    }
    if (url.searchParams.get('grant_type') === 'pkce') {
      h.exchangeCount++;
      assert.equal(createHash('sha256').update(JSON.parse(init.body).code_verifier).digest('base64url'), h.challenge, 'real SDK verifier matches S256 challenge');
      return Response.json(session(A));
    }
    if (url.pathname.endsWith('/token')) {
      const body = JSON.parse(init.body);
      return Response.json(session(body.email === 'b@example.test' || body.refresh_token?.endsWith(B) ? B : A));
    }
    throw Error('Unexpected synthetic endpoint: ' + url.pathname);
  };
  const native = { Platform: { OS: 'android' }, AppState: { currentState: 'background', addEventListener: (event, fn) => { listeners.app = fn; return { remove() {} }; } } };
  const overrides = {
    './config': config, 'react-native-url-polyfill/auto': {}, '@supabase/supabase-js': require('@supabase/supabase-js'), 'react-native': native,
    './native-crypto': { preparePKCE() {} },
    'expo-linking': { getInitialURL: async () => null, addEventListener: (event, fn) => { listeners.link = fn; return { remove() {} }; } },
    'expo-web-browser': { openAuthSessionAsync: async url => {
      const parsed = new URL(url); h.redirect = parsed.searchParams.get('redirect_to'); h.challenge = parsed.searchParams.get('code_challenge');
      assert.equal(parsed.searchParams.get('code_challenge_method'), 's256');
      if (h.browser === 'cancel') return { type: 'cancel' };
      const callback = new URL(h.redirect); callback.searchParams.set('code', 'synthetic-google-code');
      if (h.browser === 'wrong-state') callback.searchParams.set('state', 'f'.repeat(64));
      return { type: 'success', url: callback.href };
    } },
    'expo-secure-store': { isAvailableAsync: async () => true,
      getItemAsync: async key => { if (h.fault === 'read') throw Error('Synthetic secure read failure'); return values.get(key) ?? null; },
      setItemAsync: async (key, value) => { if (h.fault === 'write') throw Error('Synthetic secure write failure'); values.set(key, value); },
      deleteItemAsync: async key => { if (h.fault === 'delete') throw Error('Synthetic secure delete failure'); values.delete(key); },
    },
  };
  h.auth = load('src/cloud/auth.ts', overrides);
  h.native = native; h.listeners = listeners; h.overrides = overrides;
  h.close = async () => { h.fault = ''; h.mode = ''; h.errorCode = ''; await h.auth.getCloudClient().auth.stopAutoRefresh(); global.fetch = h.originalFetch; };
  return h;
}

async function authChecks() {
  const h = harness(), auth = h.auth;
  const rejects = (work, key) => assert.rejects(work, error => { assert.equal(error.key,key); return true; }, key);
  try {
    await auth.initializeAuth(); assert.equal(auth.captureAccount().current(), false); assert.equal(h.requests.length, 0);
    await rejects(auth.accessEmail('invalid', 'synthetic-pass', true), 'accountInvalidEmail');
    await rejects(auth.accessEmail('a@example.test', 'short', true), 'accountWeakPassword');
    assert.equal(h.requests.length, 0, 'invalid input never reaches provider');
    assert.equal(await auth.accessEmail('a@example.test', 'synthetic-pass', true), 'check-email');
    assert.equal(auth.useAuthStore.getState().status, 'confirmation'); assert.equal(auth.useAuthStore.getState().ownerId, null);
    const callback = new URL(h.redirect); assert.equal(callback.protocol, 'smaran-ai:'); assert.equal(callback.host, 'auth');
    assert.equal(callback.pathname, '/callback'); assert.match(callback.searchParams.get('state'), /^[a-f0-9]{64}$/);
    callback.searchParams.set('code', 'synthetic-email-code');
    const invalid = [callback.href.replace('smaran-ai:', 'https:'), callback.href.replace('/callback?', '/callback/extra?'),
      callback.href + '&code=second-code', callback.href + '&next=evil', callback.href + '#access_token=synthetic',
      callback.href.replace(/state=[^&]+/, 'state=wrong'), callback.href.replace('/callback?', '/other/../callback?'),
      callback.href+'&error_description='+'x'.repeat(4096), 'malformed', config.OAUTH_REDIRECT + '?code=synthetic-code'];
    for (const url of invalid) await rejects(auth.completeOAuth(url), 'accountInvalidLink');
    assert.equal(h.exchangeCount, 0, 'invalid callbacks never exchange a code');
    const expired = new URL(h.redirect); expired.hash = 'error=access_denied&error_code=otp_expired';
    await rejects(auth.completeOAuth(expired.href), 'accountExpiredLink');
    const clock=Date.now, future=clock()+86400001;
    try { Date.now=()=>future;await rejects(auth.completeOAuth(callback.href),'accountExpiredLink'); } finally { Date.now=clock; }
    await auth.retryAuth(); // Actual persisted state + verifier survive process-equivalent client restoration.
    await Promise.all([auth.completeOAuth(callback.href), auth.completeOAuth(callback.href)]);
    assert.equal(h.exchangeCount, 1); assert.equal(auth.useAuthStore.getState().ownerId, A);
    await auth.completeOAuth(callback.href); assert.equal(h.exchangeCount, 1);
    assert.ok([...h.values.values()].every(value => !value.includes('synthetic-pass')), 'password never stored');
    await auth.logout(); assert.equal(h.values.size, 0);
    for (const [code, key, status] of [['invalid_credentials','accountCredentials',400], ['weak_password','accountWeakPassword',422],
      ['email_exists','accountDuplicate',422], ['user_already_exists','accountDuplicate',422], ['email_not_confirmed','accountCheckEmail',400],
      ['over_request_rate_limit','accountRateLimit',429], ['__proto__','accountFailure',400], ['constructor','accountFailure',400]]) {
      h.errorCode = code; h.httpStatus = status;
      await rejects(auth.accessEmail('a@example.test','synthetic-pass'), key); assert.equal(auth.useAuthStore.getState().ownerId, null);
    }
    h.errorCode = ''; h.mode = 'obscured-duplicate';
    assert.equal(await auth.accessEmail('a@example.test','synthetic-pass',true),'check-email'); assert.equal(auth.useAuthStore.getState().ownerId,null,'obfuscated duplicate never logs in');
    h.mode = 'malformed'; await rejects(auth.accessEmail('a@example.test','synthetic-pass'),'accountUnavailable'); // SDK rejects missing session as AuthInvalidTokenResponseError (500).
    h.mode = 'server'; await rejects(auth.accessEmail('a@example.test','synthetic-pass'),'accountUnavailable');
    h.mode = 'offline'; await rejects(auth.accessEmail('a@example.test','synthetic-pass'),'accountNetwork');
    const timer = global.setTimeout;
    try {
      global.setTimeout = (fn, delay, ...args) => timer(fn, delay === 15000 ? 5 : delay, ...args);
      h.mode = 'timeout'; await rejects(auth.accessEmail('a@example.test','synthetic-pass'),'accountNetwork');
    } finally { global.setTimeout = timer; }
    h.mode = 'autoconfirm'; assert.equal(await auth.accessEmail('a@example.test','synthetic-pass',true),'signed-in');
    h.mode = ''; await auth.retryAuth(); assert.equal(auth.captureAccount().current(), true); assert.ok(h.requests.includes('/auth/v1/user'));
    h.fault = 'read'; await auth.retryAuth(); assert.equal(auth.useAuthStore.getState().status,'storage-error'); assert.equal(auth.captureAccount().current(),false); assert.ok(h.values.size);
    h.fault = ''; h.mode = 'offline'; await auth.retryAuth(); assert.equal(auth.useAuthStore.getState().status,'offline'); assert.equal(auth.captureAccount().current(),false);
    h.mode = ''; await auth.validateSession(); assert.equal(auth.captureAccount().current(),true,'reconnect validates retained session');
    h.errorCode = 'bad_jwt'; h.httpStatus = 401; await auth.validateSession(); assert.equal(auth.useAuthStore.getState().status,'expired'); assert.equal(auth.captureAccount().current(),false);
    h.errorCode = ''; await auth.accessEmail('a@example.test','synthetic-pass');
    // An expired stored token must refresh through the real SDK; revoked refresh tokens must not restore an account.
    const secure = await load('src/cloud/auth-storage.ts',h.overrides).restoreSessionStorage(()=>{});
    await secure.setItem(config.AUTH_STORAGE_KEY,JSON.stringify({...session(A),expires_at:1}));
    await auth.retryAuth(); assert.equal(auth.captureAccount().current(),true);
    await secure.setItem(config.AUTH_STORAGE_KEY,JSON.stringify({...session(A),expires_at:1}));
    h.errorCode='refresh_token_not_found';h.httpStatus=400;await auth.retryAuth();assert.equal(auth.captureAccount().current(),false);
    assert.equal(auth.useAuthStore.getState().status,'expired');
    h.errorCode='';await auth.accessEmail('a@example.test','synthetic-pass');
    const old=auth.captureAccount();h.mode='offline';assert.equal(await auth.logout(),'local-offline');assert.equal(old.current(),false);assert.equal(h.values.size,0);
    h.mode='';await auth.accessEmail('b@example.test','synthetic-pass');assert.equal(auth.useAuthStore.getState().ownerId,B);assert.equal(old.current(),false);
    await auth.logout();h.google=false;await rejects(auth.accessGoogle(),'accountGoogleMissing');assert.equal(auth.useAuthStore.getState().ownerId,null);
    h.google=true;assert.equal(await auth.accessGoogle(),'cancelled');assert.equal(auth.useAuthStore.getState().ownerId,null);
    assert.equal(h.values.size,0,'cancellation clears indexed SDK verifier copies, index, legacy verifier and app state');
    h.browser='wrong-state';await rejects(auth.accessGoogle(),'accountInvalidLink');assert.equal(h.exchangeCount,1);
    h.browser='success';assert.equal(await auth.accessGoogle(),'signed-in');assert.equal(h.exchangeCount,2);
    h.fault='delete';await assert.rejects(auth.logout());assert.equal(auth.captureAccount().current(),false);assert.ok(h.values.has('smaran.cloud.logout-pending'));
    h.fault='';await auth.retryAuth();assert.equal(auth.useAuthStore.getState().ownerId,null);assert.equal(h.values.size,0);
    const delayed=deferred();h.pause=delayed;
    const oldAction=auth.accessEmail('a@example.test','synthetic-pass').then(()=>assert.fail('late sign-in must reject'),error=>assert.equal(error.key,'accountFailure'));
    await tick();await tick();const signingOut=auth.logout();delayed.resolve();await oldAction;await signingOut;
    assert.equal(auth.useAuthStore.getState().status,'local');assert.equal(auth.useAuthStore.getState().message,null);assert.equal(auth.useAuthStore.getState().busy,false);
    const absent=load('src/cloud/auth.ts',{...h.overrides,'./config':{...config,cloudConfig:null}});
    await rejects(absent.accessGoogle(),'accountGoogleMissing');
    console.log('PASS auth: real SDK email, validation, confirmation/duplicate/no fake success, persisted PKCE/state, exact callbacks, expiry, Google S256/cancel/unconfigured, secure restore/failure, refresh/revocation, timeout/network/503/429, offline logout and A/B.');
  } finally { await h.close(); }
}

async function migrationChecks() {
  const r=createDatabase();
  try {
    await pre8(r.db);
    for(const [file,key] of [['008_auth_sync','authSyncMigration'],['009_extra_cognitive_games','extraCognitiveGamesMigration'],['010_care_circle_reports','careCircleReportsMigration']]) {
      const m=load('src/db/migrations/'+file+'.ts')[key];await r.db.withExclusiveTransactionAsync(async tx=>{await m.up(tx);await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)',m.version,m.name,stamp);});
    }
    await seed(r.db);await r.db.runAsync('INSERT INTO sync_accounts(owner_id,linked_at) VALUES(?,?)',A,stamp);
    await r.db.runAsync('INSERT INTO sync_patient_owners(patient_id,owner_id,linked_at) SELECT id,?,? FROM patient_profiles',A,stamp);
    await r.db.runAsync('UPDATE sync_installation SET default_owner_id=?',A);
    await r.db.runAsync('UPDATE sync_accounts SET pull_cursor=42,last_success_at=? WHERE owner_id=?',stamp,A);
    await r.db.runAsync("UPDATE sync_outbox SET attempts=3,next_attempt_at=12345,last_failure='network'");
    await r.db.runAsync("INSERT INTO sync_versions(owner_id,patient_id,entity_type,entity_id,version) VALUES(?,'one','patient_profiles','one',42)",A);
    const rows=table=>r.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all().map(row=>({...row}));
    const tables=r.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(r=>r.name);
    const before=Object.fromEntries(tables.map(t=>[t,rows(t)]));
    const run=load('src/db/migrations/index.ts').runMigrations;
    const originalExec=r.db.execAsync;
    r.db.execAsync=async sql=>{
      // Inject after individual statements, not after the entire migration SQL batch.
      if(sql.includes('ALTER TABLE sync_accounts'))for(const statement of sql.split(';').filter(s=>s.trim()))await originalExec(statement);
      else await originalExec(sql);
    };
    for(const fault of ['ALTER TABLE sync_accounts','DROP TRIGGER sync_profile_link','UPDATE sync_installation SET default_owner_id','INSERT INTO schema_migrations']) {
      r.db.fault=fault;await assert.rejects(run(r.db),/Injected/);
      for(const table of tables)assert.deepEqual(rows(table),before[table],table+' rollback');
      assert.ok(r.sqlite.prepare("SELECT 1 FROM sqlite_schema WHERE name='sync_profile_link'").get());
    }
    r.db.fault=null;r.db.execAsync=originalExec;await run(r.db);await run(r.db);
    for(const table of tables) {
      const after=rows(table);
      if(table==='sync_accounts')assert.deepEqual(after.map(({enabled,...row})=>{assert.equal(enabled,0);return row;}),before[table]);
      else if(table==='sync_installation')assert.deepEqual(after,before[table].map(row=>({...row,default_owner_id:null})));
      else if(table==='schema_migrations')assert.deepEqual(after.slice(0,10),before[table]);
      else assert.deepEqual(after,before[table],table+' fully preserved');
    }
    assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(r.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.throws(()=>r.sqlite.exec('UPDATE sync_accounts SET enabled=2'),/CHECK constraint failed/);
    assert.equal(r.sqlite.prepare('SELECT count(*) n FROM schema_migrations').get().n,12);
    console.log('PASS migration 011: populated 010 upgrade, rollback at four distinct boundaries, all patient data/owners/queue/nonzero cursors/retries preserved, constrained paused consent, replay and integrity.');
  }finally{r.sqlite.close();}
}

async function syncChecks() {
  fs.mkdirSync('.expo',{recursive:true});const folder=fs.mkdtempSync(path.resolve('.expo/mvp24-db-'));
  let r=createDatabase(path.join(folder,'synthetic.db'));const h=harness();const auth=h.auth;
  const db=new Proxy({},{get:(_,key)=>r.db[key]});
  const repo=load('src/db/repositories/sync.repository.ts',{'../client':{getDatabase:async()=>db}}).syncRepository;
  const care=load('src/db/repositories/care-circle.repository.ts',{'../client':{getDatabase:async()=>db}}).careCircleRepository;
  const sync=load('src/cloud/sync.ts',{'react-native':h.native,'./auth':auth,'../db/repositories/sync.repository':{syncRepository:repo}});
  let remoteVersion=0, mode='offline', wait=null;const remote=new Map(), mutations=new Map(), calls=[];
  h.rpc=async(name,args,owner)=>{
    calls.push({name,owner,args});if(wait){const paused=wait;wait=null;await paused.promise;}
    if(mode==='offline')throw TypeError('Synthetic DNS failure');
    if(mode==='unauthorized')return Response.json({message:'Synthetic expired session'},{status:401});
    if(name==='push_mutations') {
      if(mode==='malformed')return Response.json([null]);
      const receipts=[];
      for(const [i,e] of args.events.entries()) {
        if(mode==='partial'&&i>0){receipts.push({mutation_id:e.mutation_id,status:'rejected',error:'server'});continue;}
        if(mode==='rejected'){receipts.push({mutation_id:e.mutation_id,status:'rejected',error:'invalid'});continue;}
        const key=owner+e.mutation_id;
        if(mutations.has(key)){assert.deepEqual(mutations.get(key),e);receipts.push({mutation_id:e.mutation_id,status:'duplicate'});continue;}
        mutations.set(key,e);remote.set(owner+e.entity_type+e.entity_id,{owner_id:owner,patient_id:e.patient_id,entity_type:e.entity_type,entity_id:e.entity_id,payload:e.payload,deleted:e.operation==='delete',version:++remoteVersion});
        receipts.push({mutation_id:e.mutation_id,status:'applied'});
      }
      if(mode==='lost')throw TypeError('Synthetic response lost');
      return Response.json(mode==='truncated'?receipts.slice(0,1):receipts);
    }
    if(mode==='pull-failure')return Response.json({message:'Synthetic outage'},{status:503});
    if(mode==='bad-pull')return Response.json({records:[],parents:[],cursor:args.after_version+1,has_more:false});
    const records=[...remote.values()].filter(r=>r.owner_id===owner&&r.version>args.after_version).sort((a,b)=>a.version-b.version).slice(0,25);
    const patients=new Set(records.map(r=>r.patient_id));
    const parents=[...remote.values()].filter(r=>r.owner_id===owner&&patients.has(r.patient_id)&&['patient_profiles','patient_settings','reminders','care_circle_members'].includes(r.entity_type));
    return Response.json({records,parents,cursor:records.at(-1)?.version??args.after_version,has_more:false});
  };
  const rows=table=>r.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all();
  let stop;
  try {
    await load('src/db/migrations/index.ts').runMigrations(db);const domain=await seed(db);await auth.initializeAuth();
    // Real offline patient resolver and launch screen never consult Auth.
    const secure={SecureStorageKeys:{activeProfileId:'active',onboardingCompleted:'complete'},getSecureValue:async key=>key==='active'?'one':'true',setSecureValue:async()=>{}};
    const resolver=load('src/services/active-patient.service.ts',{'@db/repositories/patient.repository':{patientRepository:domain.patient},'./secure-storage.service':secure,'@/src/utils/validation':load('src/utils/validation.ts')});
    const routes=[];const render=screen('app/index.tsx',{'expo-router':{useRouter:()=>({replace:r=>routes.push(r)})},'@services/active-patient.service':resolver,
      '@services/secure-storage.service':secure,'@/src/stores/onboarding.store':{useOnboardingStore:select=>select({language:'en',resetOnboarding(){},setLanguage(){},setRegion(){},setAccessibilityPreferences(){}})}});
    render();await tick();assert.equal(routes.at(-1),'/patient/home');assert.equal(h.requests.length,0);
    await sync.syncNow();assert.equal(calls.length,0,'signed out makes no RPC');
    await auth.accessEmail('a@example.test','synthetic-pass');await sync.syncNow();
    assert.equal(calls.length,0,'sign-in does not grant backup consent');
    assert.equal((await repo.status(A)).linked,false);
    await repo.link(A,auth.captureAccount().current);
    const member=await care.save('one',{display_name:'Synthetic person',relationship:'family',access_role:'family',email:'care@example.test',phone:null,scopes:['reports']},()=>true);
    assert.equal(member.status,'local');
    await care.savePreference('one',member.id,'weekly',true,()=>true);
    assert.equal((await care.preference('one')).delivery_status,'not_configured');
    const baseline=rows('patient_profiles');const total=(await repo.status(A)).pending;
    await sync.syncNow();assert.equal(sync.useSyncStore.getState().status,'offline');assert.equal((await repo.status(A)).pending,total);
    const offlineHead=(await repo.pending(A))[0];
    for(let i=0;i<12;i++)await repo.fail(A,[offlineHead],'network',auth.captureAccount().current,0);
    assert.equal((await repo.pending(A))[0].state,'pending','long offline periods remain automatically retryable');assert.equal((await repo.pending(A))[0].attempts,8);
    r.sqlite.close();r=createDatabase(path.join(folder,'synthetic.db'));assert.equal((await repo.status(A)).pending,total,'restart preserves actual SQLite queue');
    mode='partial';await sync.syncNow(true);assert.equal((await repo.status(A)).pending,total-1,'confirmed prefix only');
    for(const failure of ['malformed','truncated','rejected']) {
      const before=(await repo.pending(A)).map(e=>e.mutation_id);mode=failure;await sync.syncNow(true);
      assert.deepEqual((await repo.pending(A)).map(e=>e.mutation_id),before,failure+' retains queue');assert.deepEqual(rows('patient_profiles'),baseline);
    }
    mode='lost';await sync.syncNow(true);const accepted=remote.size;assert.ok((await repo.status(A)).pending);
    mode='pull-failure';await sync.syncNow(true);assert.equal((await repo.status(A)).pending,0);assert.equal(remote.size,accepted,'duplicate replay no new remote records');
    assert.equal((await repo.status(A)).cursor,0);assert.equal((await repo.status(A)).lastSuccess,null,'push success alone never means synced');
    mode='bad-pull';await sync.syncNow();assert.equal((await repo.status(A)).cursor,0);
    mode='ok';await sync.syncNow();assert.equal(sync.useSyncStore.getState().status,'current');assert.ok((await repo.status(A)).lastSuccess);
    await sync.pauseCloudSync();assert.equal((await repo.status(A)).linked,false);
    await domain.patient.updateProfile('one',{preferredName:'Paused offline edit'});const beforePause=calls.length;
    await sync.syncNow();assert.equal(calls.length,beforePause);assert.equal((await repo.status(A)).pending,1);
    await auth.retryAuth();await sync.syncNow();
    assert.equal((await repo.status(A)).linked,false,'session restoration preserves paused consent');
    assert.equal(calls.length,beforePause,'restoring a paused account makes no sync RPC');
    assert.equal((await repo.status(A)).pending,1);
    await sync.enableCloudSync();assert.equal((await repo.status(A)).pending,0);
    await domain.patient.upsertProfileWithSettings({id:'new-local',preferredName:'Local only'},{});
    assert.equal(rows('sync_patient_owners').some(r=>r.patient_id==='new-local'),false,'new profile never silently assigned');
    stop=sync.startSyncLifecycle();await domain.patient.updateProfile('one',{preferredName:'Before logout'});
    const saved=rows('patient_profiles'),careSaved=rows('care_circle_members'),prefs=rows('report_preferences');
    wait=deferred();const oldWait=wait;const inFlight=sync.syncNow();await tick();await tick();
    await auth.logout();oldWait.resolve();await inFlight;
    assert.equal((await repo.status(A)).pending,1,'logout invalidates late ack');assert.deepEqual(rows('patient_profiles'),saved);assert.deepEqual(rows('care_circle_members'),careSaved);assert.deepEqual(rows('report_preferences'),prefs);
    await auth.accessEmail('b@example.test','synthetic-pass');const beforeB=calls.length;await sync.syncNow();
    assert.equal((await repo.status(B)).linked,false,'A consent cannot enable B');
    assert.equal((await repo.status(B)).cursor,0,'B cannot inherit A cursor');
    assert.equal(calls.length,beforeB,'B makes no sync RPC until explicit consent');
    await repo.link(B,auth.captureAccount().current);await sync.syncNow();
    assert.equal((await repo.status(B)).cursor,remoteVersion);assert.equal((await repo.status(A)).pending,1);
    assert.ok(calls.filter(c=>c.owner===B&&c.name==='push_mutations').every(c=>c.args.events.every(e=>e.patient_id==='new-local')),'B never sends A care/report/patient queue');
    await auth.logout();await auth.accessEmail('a@example.test','synthetic-pass');
    wait=deferred();const switchWait=wait;const switching=sync.syncNow(true);await tick();await tick();
    await auth.logout();await auth.accessEmail('b@example.test','synthetic-pass');switchWait.resolve();await switching;
    assert.equal((await repo.status(A)).pending,1,'A/B switch rejects stale response');assert.equal(sync.useSyncStore.getState().pending,0);
    await auth.logout();await auth.accessEmail('a@example.test','synthetic-pass');mode='unauthorized';await sync.syncNow(true);
    assert.equal(auth.useAuthStore.getState().status,'expired');assert.equal((await repo.status(A)).pending,1);
    assert.deepEqual(rows('patient_profiles'),saved);assert.deepEqual(rows('care_circle_members'),careSaved);assert.deepEqual(rows('report_preferences'),prefs);
    console.log('PASS sync: real SQLite + SDK RPC, offline patient launch/queue/restart/reconnect, consent pause/resume, partial/malformed/truncated/rejected receipts, lost ack/duplicate, failed pull/cursor, logout/switch/stale responses, A/B and Care Circle/report ownership.');
  }finally{stop?.();await h.close();r.sqlite.close();assert.ok(folder.startsWith(path.resolve('.expo')+path.sep));fs.rmSync(folder,{recursive:true,force:true});}
}

function contractChecks() {
  const {accountStrings}=load('src/i18n/account-strings.ts'),{strings,t}=load('src/i18n/index.ts');
  const slots=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const [language,values] of Object.entries(accountStrings)) {
    assert.deepEqual(Object.keys(values).sort(),Object.keys(accountStrings.en).sort());
    for(const [key,value] of Object.entries(values)){assert.ok(value.trim());assert.equal(strings[language][key],value);assert.deepEqual(slots(value),slots(accountStrings.en[key]));}
    let auth={ownerId:null,status:'local',revision:0,busy:false,message:null};const syncState={status:'local',linked:false,pending:0,lastSuccess:null};
    const route=[];const render=screen('app/account.tsx',{'react-native':{Platform:{OS:'android'},View:'View'},'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:r=>route.push(r)})},
      '@/src/stores/onboarding.store':{useOnboardingStore:select=>select({language})},'@/src/cloud/config':config,
      '@/src/cloud/auth':{useAuthStore:()=>auth,initializeAuth:async()=>{},retryAuth:async()=>{}},
      '@/src/cloud/sync':{useSyncStore:()=>syncState,refreshSyncStatus:async()=>{}}});
    let tree=nodes(render());const fields=tree.filter(n=>n.type==='Field');assert.equal(fields.length,2);
    assert.equal(fields[0].props.autoComplete,'email');assert.equal(fields[1].props.autoComplete,'current-password');assert.equal(fields[1].props.secureTextEntry,true);
    for(const field of fields)assert.equal(field.props.importantForAutofill,'yes');
    for(const button of tree.filter(n=>n.type==='SmaranButton'))assert.ok(button.props.accessibilityLabel);
    tree.find(n=>n.props?.label===t(language,'accountLocal')).props.onPress();assert.deepEqual(route,['/']);
    tree.find(n=>n.props?.label===t(language,'accountCreate')).props.onPress();tree=nodes(render());assert.equal(tree.find(n=>n.type==='Field'&&n.props.secureTextEntry).props.autoComplete,'new-password');
    for(const [status,key] of [['expired','accountSessionExpired'],['confirmation','accountConfirmEmail'],['offline','accountNetwork'],['unavailable','accountUnavailable'],['storage-error','accountStorage']]){
      auth={...auth,status};assert.ok(nodes(render()).some(n=>n.props?.children===t(language,key)),language+status);
    }
  }
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const patterns=[['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['provider key',/\b(?:sk-proj-|sk-ant-|AIza)[A-Za-z0-9_-]{24,}/],['secret key',/\bsb_secret_[A-Za-z0-9_-]{20,}/],['Google secret',/\bGOCSPX-[A-Za-z0-9_-]{20,}/],['literal token',/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/]];
  const findings=[];
  for(const file of files.filter(f=>/\.(?:[cm]?[jt]sx?|json|sql|md|toml|ya?ml|example)$/.test(f))){const source=fs.readFileSync(file,'utf8');for(const [type,pattern]of patterns)if(pattern.test(source))findings.push({path:file,type});}
  assert.deepEqual(findings,[],'secret scan reports path/type only');
  for(const name of ['.env','.env.local','credentials.json','synthetic.key','synthetic.pem'])assert.ok(execFileSync('git',['check-ignore',name],{encoding:'utf8'}).trim());
  for(const file of files.filter(f=>/^src\/db\/migrations\/(00[1-9]|010)_/.test(f)||(/^supabase\/migrations\//.test(f)&&f!=='supabase/migrations/20260916000000_three_cognitive_games.sql'))){
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','045519e:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+' historical source unchanged');
  }
  console.log('PASS contracts: seven complete translated catalogs/interpolation, actual Account controls/status/offline action, email/password autofill, screen-reader labels, source secret scan, ignored credentials and frozen historical migrations.');
}
async function main(){await authChecks();await migrationChecks();await syncChecks();contractChecks();}
module.exports = { harness };
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
