const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { createDatabase, seed, A, B, stamp } = require('./check-auth-sync-migration.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done=>{resolve=done;}); return {promise,resolve}; };
const source = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const cloudRecord = (event,version) => ({ owner_id:event.owner_id,patient_id:event.patient_id,entity_type:event.entity_type,
  entity_id:event.entity_id,payload:JSON.parse(event.payload),deleted:event.operation==='delete',version });

async function outboxChecks() {
  fs.mkdirSync('.expo',{recursive:true});
  const directory = fs.mkdtempSync(path.resolve('.expo/auth-sync-check-'));
  const filename = path.join(directory,'synthetic.db');
  let database = createDatabase(filename);
  const db = new Proxy({}, {get:(_object,key)=>database.db[key]});
  const repo = load('src/db/repositories/sync.repository.ts',{'../client':{getDatabase:async()=>db}}).syncRepository;
  const sql = () => database.sqlite;
  const rows = table => sql().prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  try {
    await load('src/db/migrations/index.ts').runMigrations(db);
    const domain = await seed(db);
    assert.equal(rows('sync_outbox').length,0,'local mode needs no auth or network');
    await repo.link(A,()=>true);
    const initial = rows('sync_outbox');
    assert.ok(initial.every(e=>e.owner_id===A));
    assert.ok(initial.every(e=>!/'photo_path'|'notification_id'|'user_id'|'is_demo_seed'/.test(e.payload)));
    const before = rows('patient_profiles');
    sql().exec("CREATE TRIGGER qa_fail_outbox BEFORE INSERT ON sync_outbox BEGIN SELECT RAISE(ABORT,'injected outbox failure'); END");
    await assert.rejects(domain.patient.updateProfile('one',{preferredName:'Must roll back'}),/injected/);
    assert.deepEqual(rows('patient_profiles'),before,'domain + outbox atomic even autocommit');
    const memories = rows('personal_memories');
    await assert.rejects(domain.memories.remove('one',memories[0].id),/injected/);
    assert.deepEqual(rows('personal_memories'),memories,'delete rolls back on outbox failure');
    sql().exec('DROP TRIGGER qa_fail_outbox');
    await domain.patient.updateProfile('one',{preferredName:'Offline edit'});
    assert.equal(rows('sync_outbox').length,initial.length+1,'offline accumulation');
    database.sqlite.close(); database=createDatabase(filename);
    assert.equal(rows('sync_outbox').length,initial.length+1,'process restart retains queue');
    await repo.link(B,()=>true);
    assert.equal((await repo.pending(B)).length,0,'B never acquires A queue or already linked local patients');
    assert.ok(rows('sync_patient_owners').every(p=>p.owner_id===A));
    await domain.patient.upsertProfileWithSettings({id:'three',preferredName:'B local'},{});
    assert.equal((await repo.pending(B)).length,0,'new profiles need explicit backup consent');
    await repo.link(B,()=>true);
    assert.ok((await repo.pending(B)).every(e=>e.patient_id==='three'),'new linked profile uses B');
    assert.equal((await repo.pending(B)).length,2);
    const sent=await repo.pending(A);
    const receipts=sent.map((e,i)=>({mutation_id:e.mutation_id,status:i<3?'applied':'rejected',...(i<3?{}:{error:'server'})}));
    await repo.acknowledge(A,sent,receipts,()=>true,100);
    assert.equal((await repo.status(A)).pending,sent.length-3,'only confirmed events removed');
    const first=(await repo.pending(A))[0];
    assert.equal(first.attempts,1);assert.equal(first.next_attempt_at,2100);
    const saved=rows('sync_outbox');
    await assert.rejects(repo.acknowledge(A,sent,receipts,()=>false),/expired/);
    assert.deepEqual(rows('sync_outbox'),saved,'stale A receipt cannot mutate B/current queue');
    for(let i=0;i<7;i++) await repo.fail(A,[first],'server',()=>true,100);
    assert.equal((await repo.pending(A))[0].state,'failed','bounded retries stop at eight');
    assert.equal((await repo.pending(A))[0].attempts,8);
    await repo.retry(A,()=>true);
    assert.equal((await repo.pending(A))[0].attempts,0);
    const confirmed=await repo.pending(A);
    await repo.acknowledge(A,confirmed,confirmed.map(e=>({mutation_id:e.mutation_id,status:'duplicate'})),()=>true);
    assert.equal((await repo.status(A)).pending,0,'duplicate push acknowledged without duplicate local work');
    const accountB=rows('sync_outbox').filter(e=>e.owner_id===B);
    const profile=cloudRecord(initial.find(e=>e.patient_id==='one'&&e.entity_type==='patient_profiles'),1);
    profile.payload.preferred_name='Server edit';
    const pull={records:[profile],parents:[],cursor:1,has_more:false};
    await repo.apply(A,pull,0,()=>true);
    assert.equal((await domain.patient.getProfileById('one')).preferredName,'Server edit');
    assert.equal((await repo.status(A)).pending,0,'pull does not echo into outbox');
    assert.deepEqual(rows('sync_outbox').filter(e=>e.owner_id===B),accountB);
    const snapshot=rows('patient_profiles');
    await assert.rejects(repo.apply(A,{...pull,records:[{...profile,owner_id:B,version:2}],cursor:2},1,()=>true),/Invalid/);
    assert.deepEqual(rows('patient_profiles'),snapshot);
    await assert.rejects(repo.apply(A,{...pull,records:[{...profile,patient_id:'two',version:2}],cursor:2},1,()=>true),/ownership/);
    let checks=0;
    await assert.rejects(repo.apply(A,{...pull,records:[{...profile,version:2}],cursor:2},1,()=>++checks<2),/expired/);
    assert.equal((await repo.status(A)).cursor,1,'stale pull transaction and cursor rolled back');
    await domain.patient.updateProfile('one',{preferredName:'New offline edit'});
    await assert.rejects(repo.apply(A,{...pull,records:[{...profile,version:2}],cursor:2},1,()=>true),/waiting/);
    assert.equal((await domain.patient.getProfileById('one')).preferredName,'New offline edit','unuploaded local data wins until push');
    const pending=await repo.pending(A);
    await repo.acknowledge(A,pending,pending.map(e=>({mutation_id:e.mutation_id,status:'applied'})),()=>true);
    const remoteProfile={...profile,entity_id:'remote-person',patient_id:'remote-person',payload:{...profile.payload,id:'remote-person'},version:6};
    const settings=cloudRecord(initial.find(e=>e.entity_type==='patient_settings'),5);
    settings.entity_id=settings.patient_id='remote-person';settings.payload.patient_id='remote-person';
    const memory=cloudRecord(initial.find(e=>e.entity_type==='personal_memories'),3);
    memory.patient_id='remote-person';memory.payload.patient_id='remote-person';memory.entity_id=memory.payload.id='remote-memory';
    await repo.apply(A,{records:[memory],parents:[settings,remoteProfile],cursor:3,has_more:true},1,()=>true);
    assert.ok(await domain.patient.getSettings('remote-person'),'parents applied before out-of-order child versions');
    assert.equal((await domain.memories.get('remote-person','remote-memory')).photoPath,null,'no false photo backup');
    assert.equal((await repo.status(A)).pending,0);
    await repo.apply(A,{records:[{...memory,deleted:true,payload:{},version:7}],parents:[],cursor:7,has_more:false},3,()=>true);
    assert.equal(await domain.memories.get('remote-person','remote-memory'),null,'tombstone applied');
    await repo.apply(A,{records:[],parents:[],cursor:7,has_more:false},7,()=>true);
    assert.equal(sql().prepare('SELECT applying_pull FROM sync_installation').get().applying_pull,0);
    assert.deepEqual(sql().prepare('PRAGMA foreign_key_check').all(),[]);
    console.log('PASS outbox/pull: actual repositories and SQLite, atomic save/delete rollback, restart, offline queue, retry cap, partial/duplicate receipts, no echo, parent ordering, tombstone, local conflicts, A/B/patient isolation, stale transaction rollback.');
  } finally {database.sqlite.close();fs.rmSync(directory,{recursive:true,force:true});}
}

async function storageChecks() {
  const values=new Map();let fault='';let failures=0;
  const overrides={
    '../services/secure-storage.service':{
      getSecureValue:async key=>{if(fault==='read')throw Error('injected');return values.get(key)??null;},
      setSecureValue:async(key,value)=>{if(fault===key)throw Error('injected');values.set(key,value);},
      deleteSecureValue:async key=>{if(fault==='delete')throw Error('injected');values.delete(key);},
    },
  };
  const factory=load('src/cloud/auth-storage.ts',overrides).createAuthStorage;
  let storage=factory(()=>failures++);
  const key='smaran.cloud.session';
  const value='अ'.repeat(1400);
  await storage.setItem(key,value);
  assert.ok([...values.values()].every(v=>Buffer.byteLength(v)<=1600),'small secure chunks');
  assert.equal(await storage.getItem(key),value);
  fault=key+'.b.1';
  await assert.rejects(storage.setItem(key,'x'.repeat(1600)),/attention/);
  await assert.rejects(storage.getItem(key),/attention/,'failure does not become null/logged-out');
  fault='';storage=factory(()=>failures++);
  assert.equal(await storage.getItem(key),value,'failed chunk preserves previous committed session');
  fault='read';await assert.rejects(storage.getItem(key));
  assert.ok(values.has(key));fault='';storage=factory(()=>failures++);
  fault='delete';await assert.rejects(storage.removeItem(key));
  fault='';storage=factory(()=>failures++);await storage.removeItem(key);
  assert.equal(values.size,0,'all secure banks removed on logout');
  assert.equal(failures,3);
  const restore=load('src/cloud/auth-storage.ts',overrides).restoreSessionStorage;
  const session=await restore(()=>failures++);
  await session.setItem(key+'-flows-code-verifier',JSON.stringify(['syntheticflow']));
  await session.setItem(key+'-flow-syntheticflow-code-verifier','synthetic-verifier');
  await session.beginLogout();
  assert.deepEqual(JSON.parse(values.get('smaran.cloud.logout-pending')),['syntheticflow']);
  values.delete(key+'-flows-code-verifier.a.0');
  await restore(()=>failures++);
  assert.equal(values.size,0,'restart completes logout despite interrupted flow-index deletion');
  console.log('PASS SecureStore: chunking, interrupted-write preservation, explicit read/write/delete failure, no null fallback, complete removal.');
}

async function syncEngineChecks() {
  const {sqlite,db}=createDatabase();
  const repo=load('src/db/repositories/sync.repository.ts',{'../client':{getDatabase:async()=>db}}).syncRepository;
  const {create}=require('zustand');
  const authStore=create(()=>({ownerId:A,revision:0,status:'signed-in',busy:false}));
  let controller=new AbortController(),offline=true,lostReceipt=false,pause=null,requestCount=0,remoteVersion=0;
  const remote=new Map(),mutations=new Map(),calls=[];
  const captureAccount=()=>{const {ownerId,revision}=authStore.getState(),signal=controller.signal;return{ownerId,signal,current:()=>!!ownerId&&!signal.aborted&&authStore.getState().revision===revision};};
  const switchAccount=owner=>{controller.abort();controller=new AbortController();authStore.setState(s=>({ownerId:owner,revision:s.revision+1}));};
  const rpc=(name,args)=>({abortSignal:async signal=>{
    const owner=authStore.getState().ownerId;calls.push({name,owner});requestCount++;
    if(pause){const waiting=pause;pause=null;await waiting.promise;}
    if(offline)return{error:{message:'offline'},status:0,data:null};
    if(name==='push_mutations'){
      assert.ok(args.events.length<=25);const data=[];
      for(const event of args.events){const identity=owner+':'+event.mutation_id;
        if(mutations.has(identity)){assert.deepEqual(mutations.get(identity),event);data.push({mutation_id:event.mutation_id,status:'duplicate'});continue;}
        mutations.set(identity,event);const record={owner_id:owner,patient_id:event.patient_id,entity_type:event.entity_type,entity_id:event.entity_id,payload:event.payload,deleted:event.operation==='delete',version:++remoteVersion};
        remote.set(owner+':'+record.entity_type+':'+record.entity_id,record);data.push({mutation_id:event.mutation_id,status:'applied'});
      }
      if(lostReceipt){lostReceipt=false;return{error:{message:'response lost'},status:0,data:null};}
      return{error:null,status:200,data};
    }
    const records=[...remote.values()].filter(r=>r.owner_id===owner&&r.version>args.after_version).sort((a,b)=>a.version-b.version).slice(0,25);
    const patients=new Set(records.map(r=>r.patient_id));
    const parents=[...remote.values()].filter(r=>r.owner_id===owner&&patients.has(r.patient_id)&&['patient_profiles','patient_settings','reminders'].includes(r.entity_type));
    return{error:null,status:200,data:{records,parents,cursor:records.at(-1)?.version??args.after_version,has_more:false}};
  }});
  const sync=load('src/cloud/sync.ts',{
    'react-native':{AppState:{currentState:'background',addEventListener:()=>({remove(){}})}},
    './auth':{captureAccount,getCloudClient:()=>({rpc}),useAuthStore:authStore},
    '../db/repositories/sync.repository':{syncRepository:repo},
  });
  const stop=sync.startSyncLifecycle();
  try{
    await load('src/db/migrations/index.ts').runMigrations(db);const domain=await seed(db);await repo.link(A,()=>true);
    await sync.syncNow();assert.equal(sync.useSyncStore.getState().status,'offline');assert.equal((await repo.status(A)).pending,14);
    const count=requestCount;await sync.syncNow();assert.equal(requestCount,count,'backoff prevents busy retry');
    offline=false;lostReceipt=true;await sync.syncNow(true);assert.equal(remote.size,14);assert.equal((await repo.status(A)).pending,14);
    await sync.syncNow(true);assert.equal(remote.size,14,'lost receipt replay creates no duplicates at controlled transport');
    assert.equal((await repo.status(A)).pending,0);assert.equal(sync.useSyncStore.getState().status,'current');assert.ok((await repo.status(A)).lastSuccess);
    await domain.patient.updateProfile('one',{preferredName:'A unsent'});
    const waiting=deferred();pause=waiting;const running=sync.syncNow();await tick();await tick();
    switchAccount(B);assert.equal(sync.useSyncStore.getState().pending,0,'account-scoped UI clears synchronously');
    waiting.resolve();await running;
    assert.equal((await repo.status(A)).pending,1,'stale A response is never acknowledged under B');
    await repo.link(B,()=>true);await sync.syncNow();
    assert.ok(calls.filter(c=>c.owner===B).every(c=>c.name!=='push_mutations'),'B never sends A work');
    switchAccount(A);await sync.syncNow(true);assert.equal((await repo.status(A)).pending,0,'returning A safely resumes its pending work');
    assert.equal(sqlite.prepare('SELECT default_owner_id FROM sync_installation').get().default_owner_id,A);
    console.log('PASS sync engine: real SQLite queue with controlled RPC, bounded batches, network/backoff, reconnect, lost receipt replay, state UX, logout/switch cancellation and A-only resume.');
  }finally{stop();sqlite.close();}
}

async function authChecks() {
  const values=new Map();let fault='';let mode='ok';let browserResult='cancel';let pause=null;let sawSignal=false;
  const requests=[];
  const originalFetch=global.fetch;
  const {readCloudConfig,oauthCode,OAUTH_REDIRECT}=load('src/cloud/config.ts');
  assert.equal(readCloudConfig(),null);assert.equal(readCloudConfig('https://example.supabase.co','sb_secret_forbidden'),null);
  assert.equal(readCloudConfig('postgresql://example/db','sb_publishable_test'),null);
  assert.equal(oauthCode(OAUTH_REDIRECT+'?code=synthetic-code'),'synthetic-code');
  for(const url of ['https://evil.test/?code=synthetic-code',OAUTH_REDIRECT+'?code=one&code=two',OAUTH_REDIRECT+'?access_token=secret',
    OAUTH_REDIRECT+'/other?code=synthetic-code',OAUTH_REDIRECT+'?code=synthetic-code#tokens',OAUTH_REDIRECT+'?code=synthetic-code&next=evil']) assert.throws(()=>oauthCode(url));
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const session=id=>({access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})+'.synthetic',
    refresh_token:'synthetic-refresh-'+id,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id,email:id===A?'a@example.test':'b@example.test',aud:'authenticated',role:'authenticated'}});
  global.fetch=async(input,init)=>{
    const url=String(input);requests.push(url);
    if(mode==='offline')throw TypeError('offline');
    if(pause){const waiting=pause;pause=null;sawSignal=!!init.signal;await waiting.promise;}
    if(url.includes('/logout'))return new Response('{}',{status:200});
    if(url.includes('/signup'))return Response.json({user:{id:A,email:'a@example.test'}});
    if(url.endsWith('/settings'))return Response.json({external:{google:true}});
    if(url.endsWith('/user'))return Response.json(session(A).user);
    if(url.includes('grant_type=pkce'))return Response.json(session(A));
    if(url.includes('/token'))return Response.json(session(JSON.parse(init.body).email==='b@example.test'?B:A));
    throw Error('Unexpected endpoint');
  };
  const config={...load('src/cloud/config.ts'),cloudConfig:{url:'https://synthetic.supabase.co',key:'sb_publishable_synthetic'},AUTH_STORAGE_KEY:'smaran.cloud.session',oauthCode,OAUTH_REDIRECT};
  const native={Platform:{OS:'android'},AppState:{currentState:'background',addEventListener:()=>({remove(){}})}};
  const overrides={
    'react-native-url-polyfill/auto':{},'@supabase/supabase-js':require('@supabase/supabase-js'),'react-native':native,
    './config':config,'./native-crypto':{preparePKCE(){}},
    'expo-linking':{getInitialURL:async()=>null,addEventListener:()=>({remove(){}})},
    'expo-web-browser':{openAuthSessionAsync:async url=>{const parsed=new URL(url);assert.equal(parsed.searchParams.get('provider'),'google');
      assert.equal(parsed.searchParams.get('code_challenge_method'),'s256');const callback=new URL(parsed.searchParams.get('redirect_to'));
      assert.equal(callback.href.split('?')[0],OAUTH_REDIRECT);
      assert.deepEqual([...callback.searchParams.keys()],['state']);
      assert.match(callback.searchParams.get('state'),/^[a-f0-9]{64}$/);callback.searchParams.set('code','synthetic-code');
      return browserResult==='cancel'?{type:'cancel'}:{type:'success',url:callback.href};}},
    'expo-secure-store':{
      isAvailableAsync:async()=>true,getItemAsync:async key=>{if(fault==='read')throw Error('injected');return values.get(key)??null;},
      setItemAsync:async(key,value)=>{if(fault==='write')throw Error('injected');values.set(key,value);},
      deleteItemAsync:async key=>{if(fault==='delete')throw Error('injected');values.delete(key);},
    },
  };
  const auth=load('src/cloud/auth.ts',overrides);
  try {
    await auth.initializeAuth();assert.equal(auth.useAuthStore.getState().ownerId,null);
    await auth.accessEmail('a@example.test','synthetic-password');assert.equal(auth.useAuthStore.getState().ownerId,A);
    const first=auth.captureAccount();assert.equal(first.current(),true);
    assert.ok([...values.values()].every(v=>!v.includes('synthetic-password')),'password never persisted');
    const baselineRequests=requests.length;
    const restored=await auth.getCloudClient().auth.getSession();assert.equal(restored.data.session.user.id,A);assert.equal(requests.length,baselineRequests);
    await auth.logout();assert.equal(first.current(),false);assert.equal(first.signal.aborted,true);assert.equal(auth.useAuthStore.getState().ownerId,null);
    assert.equal(values.size,0,'secure tokens/verifier cleared');
    await auth.accessEmail('b@example.test','synthetic-password');assert.equal(auth.useAuthStore.getState().ownerId,B);assert.equal(first.current(),false);
    const pending=deferred();pause=pending;const old=auth.getCloudClient().auth.signInWithPassword({email:'a@example.test',password:'synthetic-password'});
    await tick();await tick();const out=auth.logout();pending.resolve();await old;await out;
    assert.equal(auth.useAuthStore.getState().ownerId,null,'late account request cannot restore after logout');assert.ok(sawSignal);
    assert.equal(await auth.accessGoogle(),'cancelled');
    assert.equal(await auth.getCloudClient().auth.getSession().then(r=>r.data.session),null,'cancel does not fake login');
    browserResult='success';assert.equal(await auth.accessGoogle(),'signed-in');assert.equal(auth.useAuthStore.getState().ownerId,A);
    mode='offline';const local=await auth.logout();assert.equal(local,'local-offline');assert.equal(values.size,0);
    mode='ok';assert.equal(await auth.accessEmail('a@example.test','synthetic-password',true),'check-email');
    await auth.accessEmail('a@example.test','synthetic-password');
    fault='read';await auth.retryAuth();assert.equal(auth.useAuthStore.getState().status,'storage-error');assert.ok(values.size>0,'storage failure retains session material');
    fault='';await auth.retryAuth();assert.equal(auth.useAuthStore.getState().ownerId,A);
    fault='delete';await assert.rejects(auth.logout(),/storage/);assert.equal(auth.captureAccount().current(),false);
    assert.ok(Array.isArray(JSON.parse(values.get('smaran.cloud.logout-pending'))),'logout intent survives interruption');
    fault='';await auth.retryAuth();assert.equal(auth.useAuthStore.getState().ownerId,null,'retry completes requested logout rather than restoring A');
    assert.deepEqual([...values.keys()],[], 'requested logout clears all account material');
    await auth.accessEmail('a@example.test','synthetic-password');
    await auth.logout();
    console.log('PASS auth: real Supabase SDK with controlled fetch/SecureStore/browser boundaries, email/signup confirmation, session restore, Google S256/cancel, callback allowlist, offline logout, A/B generation cancellation, no password persistence, storage recovery. Live Google E2E NOT performed.');
  } finally {fault='';mode='ok';await auth.getCloudClient().auth.stopAutoRefresh();global.fetch=originalFetch;}
}

async function gatewayChecks() {
  const {handleOnlineAI}=load('supabase/functions/online-ai/contract.ts');
  const body={version:1,task:'game-instruction',activity:'memory_match',language:'en'};
  const request=(payload,token=true)=>new Request('https://example.test/online-ai',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+ 'synthetic-token'.repeat(3)}:{})},body:JSON.stringify(payload)});
  assert.equal((await handleOnlineAI(request(body,false),async()=>true)).status,401);
  assert.equal((await handleOnlineAI(request(body),async()=>false)).status,401);
  assert.equal((await handleOnlineAI(request({...body,systemPrompt:'diagnose'}),async()=>true)).status,400);
  assert.equal((await handleOnlineAI(request({...body,sql:'select'},true),async()=>true)).status,400);
  assert.equal((await handleOnlineAI(request({...body,history:'x'.repeat(2000)}),async()=>true)).status,413);
  const result=await handleOnlineAI(request(body),async()=>true);
  assert.equal(result.status,503);assert.equal((await result.json()).error.code,'not-configured');
  console.log('PASS AI gateway: authenticated boundary, strict allowlist, stream size cap, prompt/SQL/history rejection, truthful not-configured response.');
}
function staticChecks() {
  const sql=source('supabase/migrations/20260912000000_auth_sync.sql');
  for(const table of ['sync_accounts','sync_patients','sync_records','sync_mutations']) {
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql,new RegExp(`create policy \\w+ on public\\.${table} for all to authenticated\\s+using \\(\\(select auth\\.uid\\(\\)\\) = owner_id\\) with check \\(\\(select auth\\.uid\\(\\)\\) = owner_id\\)`));
  }
  assert.match(sql,/revoke all on public\.sync_accounts, public\.sync_patients, public\.sync_records, public\.sync_mutations from anon, authenticated/);
  assert.match(sql,/where owner_id = account for update/);assert.match(sql,/prior\.request <> e/);
  assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/security definer set search_path = ''/);
  assert.match(source('app/account.tsx'),/secureTextEntry/);assert.match(source('app/account.tsx'),/importantForAutofill="yes"/);
  assert.match(source('app/auth/callback.tsx'),/router\.replace\('\/account'\)/);
  assert.doesNotMatch(source('app/index.tsx'),/supabase|signIn|authStore/);
  assert.doesNotMatch(source('src/cloud/auth.ts'),/DELETE FROM|patientRepository|resetOnboarding|clearPatient/);
  assert.equal(source('src/db/client.web.ts').replace(/\r\n/g,'\n'),execFileSync('git',['show','58e7938:src/db/client.web.ts'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
  for(const file of fs.readdirSync('src/cloud')) assert.doesNotMatch(source('src/cloud/'+file),/service_role|SERVICE_ROLE|postgres(?:ql)?:\/\/|DB_PASSWORD|DATABASE_URL|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE/);
  console.log('PASS static SQL/security contracts: ownership SELECT/INSERT/UPDATE/DELETE policies on all four tables, RPC-only writes, explicit auth.uid, empty search_path, per-account version lock, idempotency. Hosted RLS execution NOT performed.');
}
async function main(){await outboxChecks();await storageChecks();await authChecks();await syncEngineChecks();await gatewayChecks();staticChecks();}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
