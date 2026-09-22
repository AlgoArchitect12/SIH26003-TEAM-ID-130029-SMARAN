const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, seed, A, B } = require('./check-auth-sync-migration.cjs');
const tick = () => new Promise(setImmediate);

async function locations() {
  const r = createDatabase(), cache = new Map();
  const overrides = { '../client': { getDatabase: async () => r.db }, 'expo-crypto': { randomUUID } };
  const module = file => load(file, overrides, cache);
  const run = module('src/db/migrations/index.ts').runMigrations;
  const repo = module('src/db/repositories/location.repository.ts').locationRepository;
  const sync = module('src/db/repositories/sync.repository.ts').syncRepository;
  const { trackingStatus } = module('src/location/types.ts');
  try {
    for (const file of fs.readdirSync('src/db/migrations').filter(f => /^(00[1-9]|01[0-2])_/.test(f))) {
      assert.equal(fs.readFileSync('src/db/migrations/' + file, 'utf8').replaceAll('\r\n','\n'),
        execFileSync('git', ['show', 'HEAD:src/db/migrations/' + file], { encoding: 'utf8' }).replaceAll('\r\n','\n'));
    }
    await run(r.db); await seed(r.db); await sync.link(A, () => true);
    const before = r.sqlite.prepare('SELECT * FROM sync_outbox').all();
    await run(r.db); assert.deepEqual(r.sqlite.prepare('SELECT * FROM sync_outbox').all(), before);
    assert.equal(trackingStatus(false,false,false,false),'PAUSED');
    assert.equal(trackingStatus(true,false,true,true),'LOCATION_DISABLED');
    assert.equal(trackingStatus(true,true,false,false),'PERMISSION_REQUIRED');
    assert.equal(trackingStatus(true,true,true,false),'PERMISSION_REQUIRED');
    assert.equal(trackingStatus(true,true,true,true),'ACTIVE');
    await assert.rejects(repo.setEnabled('one',true,()=>false));
    assert.equal(await repo.enabled(),null);
    await repo.setEnabled('one',true,()=>true);
    const state = await repo.enabled();
    const point = { latitude:26.14, longitude:91.73, accuracy:12, recorded_at:new Date(Date.now()+1000).toISOString(), source:'background' };
    await repo.record('one',state.consented_at,[point]);
    await repo.record('one',state.consented_at,[point]);
    assert.equal((await repo.recent('one')).length,1,'duplicate OS batches are idempotent');
    assert.equal(await repo.latest('two'),null);
    assert.equal((await repo.latest('one')).accuracy,12);
    const event = r.sqlite.prepare("SELECT * FROM sync_outbox WHERE entity_type='patient_locations'").get();
    assert.equal(event.patient_id,'one');assert.equal(event.owner_id,A);
    const payload = JSON.parse(event.payload);
    const record = { owner_id:A, patient_id:'one', entity_type:'patient_locations', entity_id:payload.id, payload, version:1, deleted:false };
    const validate = module('src/cloud/sync-contract.ts').validateCloudRecord;
    assert.equal(validate(record,A),record);assert.throws(()=>validate(record,B));
    for (const bad of [{latitude:91},{longitude:NaN},{accuracy:-1},{recorded_at:'bad'},{source:'public'},{patient_id:'two'}]) {
      assert.throws(()=>validate({...record,payload:{...payload,...bad}},A));
    }
    r.sqlite.exec("CREATE TRIGGER injected_location_failure BEFORE INSERT ON sync_outbox WHEN NEW.entity_type='patient_locations' BEGIN SELECT RAISE(ABORT,'injected'); END");
    await assert.rejects(repo.record('one',state.consented_at,[{...point,latitude:27}]),/injected/);
    assert.equal((await repo.recent('one')).length,1,'location and outbox roll back together');
    r.sqlite.exec('DROP TRIGGER injected_location_failure');
    await repo.status('one','ERROR');assert.equal((await repo.state('one')).status,'ERROR');
    await repo.setEnabled('two',true,()=>true);assert.equal((await repo.state('one')).status,'PAUSED');
    await repo.record('one',state.consented_at,[{...point,latitude:28}]);assert.equal((await repo.recent('one')).length,1,'old patient batches ignored');
    assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);

    let fg=false,bg=false,services=true,started=false,available=true,callback,starts=0,permissionRequests=0;
    const native = {
      Accuracy:{Balanced:3}, hasServicesEnabledAsync:async()=>services,
      getForegroundPermissionsAsync:async()=>({granted:fg}), getBackgroundPermissionsAsync:async()=>({granted:bg}),
      requestForegroundPermissionsAsync:async()=>{permissionRequests++;return{granted:fg};}, requestBackgroundPermissionsAsync:async()=>{permissionRequests++;return{granted:bg};},
      hasStartedLocationUpdatesAsync:async()=>started, stopLocationUpdatesAsync:async()=>{started=false;},
      startLocationUpdatesAsync:async(name,options)=>{assert.equal(options.timeInterval,60000);assert.equal(options.distanceInterval,50);started=true;starts++;},
      getLastKnownPositionAsync:async()=>null,
    };
    const auth = require('zustand').create(()=>({ownerId:A,status:'signed-in'}));
    const service = load('src/services/location.service.ts',{
      'expo-location':native,'expo-task-manager':{isTaskDefined:()=>false,defineTask:(name,fn)=>{callback=fn;},isAvailableAsync:async()=>available},
      'react-native':{Platform:{OS:'android'},AppState:{addEventListener:()=>({remove(){}})}},
      '../db/repositories/location.repository':{locationRepository:repo}, '../cloud/auth':{useAuthStore:auth},'../cloud/sync':{syncNow:async()=>{}},
      '../stores/patient-session.store':{captureReminderManagement:()=>()=>true},'./active-patient.service':{resolveActivePatient:async()=>({status:'ready',profile:{id:'two'}})},
    });
    await service.refreshTracking();assert.equal((await repo.state('two')).status,'PERMISSION_REQUIRED');assert.equal(permissionRequests,0,'resume never prompts silently');
    fg=true;await service.setPatientTracking('two',true);assert.equal((await repo.state('two')).status,'PERMISSION_REQUIRED');
    bg=true;await service.refreshTracking();assert.equal((await repo.state('two')).status,'ACTIVE');assert.equal(starts,1);
    await service.refreshTracking();assert.equal(starts,1,'no duplicate native subscriptions');
    const now=Date.now()+2000;
    await callback({data:{locations:[{timestamp:now,coords:{latitude:26,longitude:91,accuracy:null}}]}});
    assert.equal((await repo.latest('two')).recorded_at,new Date(now).toISOString());
    services=false;await service.refreshTracking();assert.equal((await repo.state('two')).status,'LOCATION_DISABLED');assert.equal(started,false);
    services=true;await service.refreshTracking();assert.equal(started,true);
    available=false;await service.refreshTracking();assert.equal((await repo.state('two')).status,'ERROR');
    await service.setPatientTracking('two',false);assert.equal((await repo.state('two')).status,'PAUSED');
    const stop=service.startLocationLifecycle();auth.setState({ownerId:null});await tick();stop();
    console.log('PASS GPS: permissions, statuses, opt-in, recovery, native task, timestamp, SQLite, deduplication, atomic outbox, sync contract, latest location and patient isolation.');
  } finally {r.sqlite.close();}
}

function games() {
  const memory=load('src/games/memory-match/engine.ts'), selection=load('src/games/selection-engine.ts');
  assert.equal(load('src/games/memory-match/difficulty.ts').INITIAL_MEMORY_DIFFICULTY,1);
  let state=memory.startPlaying(memory.startPreview(memory.createMemoryGame(1,()=>0.5)));
  assert.ok(state.cards.every(c=>c.state==='hidden'));
  const first=0, mismatch=state.cards.findIndex(c=>c.symbolId!==state.cards[first].symbolId);
  state=memory.flipCard(state,first).state;state=memory.flipCard(state,mismatch).state;
  assert.equal(memory.flipCard(state,2).state,state,'double-submit is locked');
  state=memory.resolveComparison(state);assert.ok(state.cards.every(c=>c.state==='hidden'));
  while(state.status!=='SESSION_COMPLETE') {
    const a=state.cards.findIndex(c=>c.state==='hidden'),b=state.cards.findIndex((c,i)=>i!==a&&c.symbolId===state.cards[a].symbolId);
    state=memory.flipCard(state,a).state;state=memory.flipCard(state,b).state;
    if(state.status!=='SESSION_COMPLETE')state=memory.resolveComparison(state);
  }
  assert.ok(state.cards.every(c=>c.state==='matched'));
  assert.equal(memory.createMemoryGame(1).status,'IDLE');
  const patterns=load('src/games/pattern-recognition.ts'),chess=load('src/games/chess-puzzle.ts');
  for(let level=1;level<=5;level++)for(const tasks of [patterns.preparePatterns(level),chess.prepareChess(level,()=>0.5)]) {
    let s=selection.createSelection(tasks,0);
    for(const task of tasks) {
      const wrong=task.choices.find(c=>c!==task.answer);
      s=selection.chooseSelection(s,tasks,wrong,1000);assert.equal(s.feedback,'retry');
      s=selection.chooseSelection(s,tasks,task.answer,2000);assert.equal(s.feedback,'correct');
      assert.equal(selection.chooseSelection(s,tasks,task.answer,2001),s);
      if(task.board)assert.ok(chess.isChessAnswer(task,task.answer));
      s=selection.continueSelection(s,3000);
    }
    assert.equal(s.correctSelections,tasks.length);assert.equal(s.attempts,tasks.length*2);assert.notEqual(s.completedAtMs,null);
  }
  const adaptive=load('src/ai/adaptive-engine.ts');
  assert.equal(adaptive.recommendDifficulty(1,{accuracy:1,relativePace:1,workingMemory:1,independence:1,stability:1},adaptive.createInitialAdaptiveModel('one','memory_match')).recommendedDifficulty,2);
  console.log('PASS games: first level, hidden/revealed/matched cards, retry, score, double-submit, all pattern/chess levels, completion, adaptive +1 and reset.');
}

function timers() {
  let foreground='active',focused=true,callback,paused=false,delay=1400,count=0;
  const native={AppState:{currentState:'active',addEventListener:(_,fn)=>{callback=fn;return{remove(){}};}}};
  // Run the actual hook with deterministic React effects and a fake clock, including cleanup.
  let index=0;const slots=[],effects=[],cleanup=[],pending=new Map();let id=0;
  const react={useRef:v=>slots[index++]??={current:v},useState:v=>{const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],v=>slots[i]=v];},
    useEffect:(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(()=>{cleanup[i]?.();cleanup[i]=fn();});slots[i]=deps;}};
  const hook=load('hooks/use-game-transition.ts',{react,'react-native':native,'@react-navigation/native':{useIsFocused:()=>focused},
    $timers:{setTimeout:fn=>{pending.set(++id,fn);return id;},clearTimeout:id=>pending.delete(id)}}).useGameTransition;
  const render=()=>{index=0;hook(delay,()=>count++,paused);effects.splice(0).forEach(fn=>fn());};
  const advance=()=>{const tasks=[...pending.values()];pending.clear();tasks.forEach(fn=>fn());};
  render();render();assert.equal(pending.size,1);paused=true;render();advance();assert.equal(count,0);
  paused=false;render();foreground='background';callback(foreground);render();advance();assert.equal(count,0);
  callback('active');render();focused=false;render();advance();assert.equal(count,0);
  focused=true;render();advance();assert.equal(count,1);
  delay=null;render();delay=1400;render();cleanup.forEach(fn=>fn?.());advance();assert.equal(count,1,'unmount cancels transitions');
  console.log('PASS continuous flow timer: exactly once, pause, background, blur, resume, phase change and unmount cleanup.');
}

async function admin() {
  const store=require('zustand').create(()=>({ownerId:A,revision:1,status:'signed-in'}));
  let result={data:[],error:null},release=null,app;
  const auth={useAuthStore:store,captureAccount:()=>{const snapshot=store.getState();return{ownerId:snapshot.ownerId,signal:new AbortController().signal,
    current:()=>store.getState().status==='signed-in'&&store.getState().ownerId===snapshot.ownerId&&store.getState().revision===snapshot.revision};},
    getCloudClient:()=>({rpc:()=>({abortSignal:()=>release?new Promise(resolve=>{release=resolve;}):Promise.resolve(result)})})};
  const service=load('src/services/admin.service.ts',{'../cloud/auth':auth,'react-native':{AppState:{addEventListener:(_,fn)=>{app=fn;return{remove(){}};}}},
    '../db/client':{getDatabase:async()=>({getFirstAsync:async()=>({owner_id:B})})},'./profile-switching.service':{selectActivePatient:async()=>{throw Error('must not select another owner');}}});
  const stop=service.startAdminLifecycle();
  assert.equal(service.useAdminStore.getState().mode,'normal');
  result={data:null,error:{code:'42501'}};assert.equal(await service.enterAdmin(),false);assert.equal(service.useAdminStore.getState().mode,'normal');
  result={data:[{patient:{id:'one',preferred_name:'Synthetic'},location:null,reports:[]}],error:null};assert.equal(await service.enterAdmin(),true);
  await assert.rejects(service.manageAdminPatient('one'),/Sync this patient/);
  service.exitAdmin();assert.deepEqual(service.useAdminStore.getState().patients,[]);
  release=true;const pending=service.enterAdmin();assert.equal(service.useAdminStore.getState().mode,'authenticating');
  service.exitAdmin();release(result);assert.equal(await pending,false,'late authentication cannot reopen exited admin');release=null;
  await service.enterAdmin();store.setState({ownerId:B,revision:2});assert.equal(service.useAdminStore.getState().mode,'normal');
  await service.enterAdmin();app('background');assert.equal(service.useAdminStore.getState().mode,'normal');
  await service.enterAdmin();store.setState({ownerId:null,status:'local',revision:3});assert.equal(service.useAdminStore.getState().mode,'normal');
  result={data:null,error:{code:'network'}};assert.equal(await service.enterAdmin(),false);stop();
  console.log('PASS admin: normal/authenticating/admin/exit, denial, server failure, stale responses, owner isolation, background and logout.');
}

async function mail() {
  const types=load('src/db/schema.types.ts');
  const facts={patientName:'Synthetic patient',days:7,timezone:'UTC',games:types.CognitiveActivityTypes.map(gameType=>({gameType,sessions:0,attempts:null,correct:null,hints:null,repeatedErrors:null})),
    routine:{completed:0,hydration:0,activity:0,appointment:0,unknownCategory:0,scheduledToday:0,completedToday:0},memories:{stored:0,added:0}};
  const report={id:'report1',patient_id:'one',snapshot:JSON.stringify(facts),period_start:'2026-09-01T00:00:00Z',period_end:'2026-09-08T00:00:00Z',generated_at:'2026-09-08T00:00:00Z',report_version:1};
  for (const os of ['android','ios']) {
    const files=new Map();let available=true,printed=0,composed=0,shared=0,valid=true,pause=null,requested=0;
    let member={id:'member1',patient_id:'one',email:'synthetic@example.invalid',status:'local',scopes:'["reports","cognitive_activity"]',updated_at:'2026-09-01T00:00:00Z'};
    class File {
      constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/').replace(/(?<!:)\/+/g,'/');}
      get name(){return this.uri.split('/').at(-1);}get exists(){return files.has(this.uri);}get modificationTime(){return files.get(this.uri)??0;}
      delete(){files.delete(this.uri);}move(target){files.set(target.uri,files.get(this.uri));files.delete(this.uri);this.uri=target.uri;}
    }
    class Directory {
      constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/').replace(/(?<!:)\/+/g,'/');}create(){}delete(){}
      get exists(){return [...files.keys()].some(p=>p.startsWith(this.uri+'/'));}
      list(){const children=new Map();for(const p of files.keys())if(p.startsWith(this.uri+'/')){const rest=p.slice(this.uri.length+1),name=rest.split('/')[0];children.set(name,rest.includes('/')?new Directory(this,name):new File(this,name));}return [...children.values()];}
    }
    const api=load('src/services/report-pdf.service.ts',{
      'react-native':{Platform:{OS:os}},'expo-file-system':{File,Directory,Paths:{cache:{uri:'file:/cache'}}},
      '../db/repositories/care-circle.repository':{checkCareRequest:current=>{if(!current())throw Error('changed');},careCircleRepository:{
        report:async()=>report,get:async()=>({...member}),shareRequested:async()=>requested++}},
      'expo-print':{printToFileAsync:async({html})=>{assert.ok(html.includes('Synthetic patient'));assert.ok(html.includes('not a diagnosis'));assert.ok(!html.includes('<h2>Memories'));const uri=`file:/cache/print/${++printed}.pdf`;files.set(uri,Date.now());if(pause)await pause();return{uri};}},
      'expo-mail-composer':{isAvailableAsync:async()=>available,composeAsync:async options=>{assert.deepEqual(options.recipients,['synthetic@example.invalid']);assert.equal(options.attachments.length,1);assert.ok(files.has(options.attachments[0]));composed++;return{status:'cancelled'};}},
      'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async()=>shared++},
    });
    await api.prepareReportPdf('one','report1','en',()=>valid,'member1',false,true);assert.equal(composed,1);assert.equal(requested,1);
    assert.equal(files.size,os==='android'?1:0,'Android attachment remains readable after composer returns');
    available=false;await assert.rejects(api.prepareReportPdf('one','report1','en',()=>valid,'member1',false,true),api.ReportEmailUnavailable);assert.equal(composed,1);
    await api.prepareReportPdf('one','report1','en',()=>valid,'member1',true);assert.equal(shared,1,'share remains available without mail');available=true;
    member={...member,scopes:'[]'};await assert.rejects(api.prepareReportPdf('one','report1','en',()=>valid,'member1',false,true));
    member={...member,scopes:'["reports"]'};pause=async()=>{member={...member,email:'changed@example.invalid'};};
    await assert.rejects(api.prepareReportPdf('one','report1','en',()=>valid,'member1',false,true),/access changed/);assert.equal(composed,1);
    pause=async()=>{valid=false;};await assert.rejects(api.prepareReportPdf('one','report1','en',()=>valid,'member1',false,true),/changed/);assert.equal(composed,1);
    api.cleanupReportPdfs(Date.now()+86400001);assert.equal(files.size,0);
  }
  console.log('PASS mail: actual scoped PDF HTML, attachment, recipient, Android/iOS lifetime, cancellation without delivery claims, unavailable client, Share fallback, revocation and stale patient.');
}
async function main(){await locations();games();timers();await admin();await mail();}
module.exports={main};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
