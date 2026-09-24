const assert=require('node:assert/strict');
const fs=require('node:fs');
const {create}=require('zustand');
const {load}=require('./check-elderly-ux.cjs');
const {screen,nodes}=require('./check-privacy-recovery.cjs');
const {createDatabase,A,B,seed}=require('./check-auth-sync-migration.cjs');
const tick=async()=>{for(let i=0;i<15;i++)await new Promise(setImmediate);};
const point=(id='point',age=0)=>({id,latitude:0,longitude:0,accuracy:10,recorded_at:new Date(Date.now()-age).toISOString()});
const snapshot=(revision=1)=>({ok:true,owner:true,consent:true,enabled:true,epoch:'11111111-1111-4111-8111-111111111111',zone:null,point:point(),history:[point()],event:null,device_status:'active',revision});

async function sqliteChecks(){
  const r=createDatabase(),cache=new Map(),overrides={'../client':{getDatabase:async()=>r.db}};
  try {
    await load('src/db/migrations/index.ts',overrides,cache).runMigrations(r.db);
    await seed(r.db);
    r.sqlite.exec(`INSERT INTO sync_accounts(owner_id,linked_at) VALUES('${A}','now');
      INSERT INTO sync_patient_owners(patient_id,owner_id,linked_at) VALUES('one','${A}','now');`);
    const repo=load('src/db/repositories/location.repository.ts',overrides,cache).locationRepository;
    await assert.rejects(repo.configure('one',B,'epoch',true,()=>true),/gpsSignIn/);
    await repo.configure('one',A,'epoch',true,()=>true);
    let device=await repo.device('one',A);
    for(let i=0;i<300;i++)await repo.enqueue(device,point('p'+i,i*1000),()=>true);
    assert.equal(r.sqlite.prepare('SELECT count(*) n FROM location_queue').get().n,288);
    assert.equal((await repo.pending(device)).length,25);
    await repo.enqueue(device,point('expired',25*3600000),()=>true);
    assert.equal(r.sqlite.prepare("SELECT count(*) n FROM location_queue WHERE id='expired'").get().n,0);
    const batch=await repo.pending(device);await repo.acknowledge(device,batch);
    assert.equal(r.sqlite.prepare('SELECT count(*) n FROM location_queue').get().n,263);
    await assert.rejects(repo.enqueue(device,point('stale-request'),()=>false),/gpsSignIn/);
    await repo.stop('one',A,'pause',()=>true);
    assert.equal((await repo.device('one',A)).pending_control,'pause');
    assert.equal((await repo.pending(device)).length,0);
    await repo.enqueue(device,point('late-native-callback'),()=>true);
    assert.equal((await repo.pending(device)).length,0,'paused native callback cannot queue');
    await repo.configure('one',A,'new-epoch',true,()=>true);
    await repo.enqueue(device,point('old-epoch'),()=>true);
    assert.equal((await repo.pending(device)).length,0,'old epoch rejected locally');
    device=await repo.device('one',A);
    await repo.enqueue(device,point('new'),()=>true);
    await repo.stop('one',A,'revoke',()=>true);
    assert.equal((await repo.pending(device)).length,0,'revoke clears queue');
    assert.equal((await repo.device('one',A)).pending_control,'revoke');
    assert.equal(r.sqlite.prepare("SELECT count(*) n FROM sync_outbox WHERE entity_type='patient_locations'").get().n,0,'new GPS never enters unlimited backup');
    await load('src/db/migrations/index.ts',overrides,cache).runMigrations(r.db);
    assert.equal(r.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {r.sqlite.close();}
  console.log('PASS GPS SQLite: migration idempotency, ownership, 288 cap/24h expiry, ACK, pause/revoke, old epoch and general-outbox isolation.');
}
function harness(){
  const auth=create(()=>({ownerId:A,revision:0,status:'signed-in'}));
  const person=create(()=>({patientId:'one',revision:0,workspace:'patient'}));
  const appHandlers=[],networkHandlers=[],timers=new Map(),calls=[],events=[],received=[];
  const app={currentState:'active',addEventListener:(_,fn)=>{appHandlers.push(fn);return{remove(){}};}};
  let services=true,granted=true,online=true,fixCallback,removed=0,channelRemoved=0,subscribeCallback;
  let data=snapshot(),response=null,device={patient_id:'one',owner_id:A,epoch:data.epoch,enabled:1,pending_control:null},queue=[];
  const account=()=>{const revision=auth.getState().revision;return{ownerId:A,signal:new AbortController().signal,current:()=>auth.getState().status==='signed-in'&&auth.getState().revision===revision};};
  const repo={device:async()=>device,controls:async()=>device.pending_control?[device]:[],pending:async()=>queue,acknowledge:async(_,points)=>{queue=queue.filter(p=>!points.includes(p));},
    enqueue:async(d,p,current)=>{if(current()&&device.enabled&&d.epoch===device.epoch)queue.push(p);},
    stop:async(_,__,action)=>{device={...device,enabled:0,pending_control:action};queue=[];},
    configure:async(_,__,epoch,enabled,current)=>{assert.ok(current());device={...device,epoch,enabled:Number(enabled),pending_control:null};queue=[];}};
  const channel={on:(_,config,fn)=>{events.push({config,fn});return channel;},subscribe:fn=>{subscribeCallback=fn;return channel;}};
  const cloud={auth:{getSession:async()=>({data:{session:{expires_at:Math.floor(Date.now()/1000)+3600}},error:null})},
    channel:()=>channel,removeChannel:async()=>{channelRemoved++;},
    rpc:(method,args)=>({abortSignal:async()=>{calls.push({method,args});if(response)return await response(method,args);
      if(method==='location_control'){data={...data,enabled:!['pause','revoke'].includes(args.p_action),consent:args.p_action!=='revoke',revision:data.revision+1};}
      return{data:method==='location_publish'?{ok:true}:data,error:null,status:200};}})};
  const api=load('src/services/location.service.ts',{
    '../cloud/auth':{captureAccount:account,getCloudClient:()=>cloud,useAuthStore:auth,sessionExpired:()=>auth.setState({status:'expired'})},
    '../stores/patient-session.store':{usePatientSessionStore:person,capturePatientRequest:()=>{const r=person.getState().revision;return()=>person.getState().revision===r;}},
    '../db/repositories/location.repository':{locationRepository:repo},
    'react-native':{AppState:app,Platform:{OS:'android'}},
    'expo-crypto':{randomUUID:()=>String(Math.random()).slice(2)},
    'expo-location':{Accuracy:{Balanced:3},hasServicesEnabledAsync:async()=>services,
      requestForegroundPermissionsAsync:async()=>({granted}),getForegroundPermissionsAsync:async()=>({granted}),
      watchPositionAsync:async(_,callback)=>{fixCallback=callback;return{remove:()=>removed++};}},
    'expo-network':{getNetworkStateAsync:async()=>({isConnected:online,isInternetReachable:online}),
      addNetworkStateListener:fn=>{networkHandlers.push(fn);return{remove(){}};}},
    $timers:{setTimeout:(fn,ms)=>{const id={};timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)},
  });
  return{api,auth,person,calls,events,received,timers,repo,
    set services(v){services=v;},set granted(v){granted=v;},set online(v){online=v;},set data(v){data=v;},set response(v){response=v;},
    get device(){return device;},get queue(){return queue;},get removed(){return removed;},get channelRemoved(){return channelRemoved;},
    fix:()=>fixCallback?.({timestamp:Date.now(),coords:{latitude:0,longitude:0,accuracy:10}}),
    network:()=>networkHandlers.forEach(fn=>fn({isConnected:online})),subscribe:s=>subscribeCallback(s),
    app:state=>{app.currentState=state;appHandlers.forEach(fn=>fn(state));},};
}
async function serviceChecks(){
  const h=harness();assert.equal(await h.api.devicePermission(),'gpsCurrent');h.granted=false;assert.equal(await h.api.devicePermission(true),'gpsDenied');
  h.services=false;assert.equal(await h.api.devicePermission(),'gpsDisabled');h.services=true;h.granted=true;
  const stop=h.api.startLocationLifecycle();
  try{
    await tick();h.fix();await tick();assert.equal(h.queue.length,1,'actual device fix queued');
    h.online=false;h.network();await tick();assert.equal(h.api.useLocationStore.getState().status,'gpsOffline');assert.equal(h.queue.length,1);
    h.online=true;h.network();await tick();assert.equal(h.queue.length,0,'reconnect drains queued fix');
    assert.ok(h.calls.some(c=>c.method==='location_publish'&&c.args.p_points.length===1));
    await h.api.setLocationSharing('one','pause',null,true);assert.equal(h.device.enabled,0);assert.ok(h.removed>0);
    await h.api.setLocationSharing('one','consent',null,true);h.network();await tick();h.fix();await tick();
    await h.api.setLocationSharing('one','revoke',null,true);assert.equal(h.queue.length,0);assert.equal(h.device.enabled,0);
    await assert.rejects(h.api.setLocationSharing('one','zone',{latitude:0,longitude:0,radius:99}),/gpsInvalidZone/);
    h.auth.setState({status:'expired'});h.fix();await tick();assert.equal(h.queue.length,0,'expired session no collection');
  }finally{stop();}
  const offline=harness();await offline.api.setLocationSharing('one','consent',null,true);
  offline.response=async()=>{throw new Error('network');};
  await assert.rejects(offline.api.setLocationSharing('one','revoke',null,true));
  assert.equal(offline.device.enabled,0);assert.equal(offline.device.pending_control,'revoke','offline revoke remains durable');
  offline.response=null;offline.person.setState({workspace:'caregiver',patientId:'two',revision:1});
  const stopOffline=offline.api.startLocationLifecycle();await tick();stopOffline();
  assert.equal(offline.device.pending_control,null,'privacy stop syncs after switching person/workspace');
  console.log('PASS GPS service: granted/denied/disabled, device coordinates, offline/reconnect, pause/revoke, durable offline stop and expired collection.');
}
async function realtimeChecks(){
  for(const scenario of ['revoked','logout','expiry','background']){
    const h=harness(),stop=h.api.watchPatientLocation('one',s=>h.received.push(s));
    try{
      h.subscribe('SUBSCRIBED');await tick();assert.equal(h.received.at(-1).snapshot.point.id,'point');
      h.data={...snapshot(2),point:point('newer')};h.events[1].fn();await tick();assert.equal(h.received.at(-1).snapshot.point.id,'newer','patient update refreshes caregiver');
      h.response=async()=>{throw new Error('network');};h.network();await tick();
      assert.equal(h.received.at(-1).status,'gpsOffline');assert.equal(h.received.at(-1).snapshot.point.id,'newer','offline fallback keeps timestamped last-known point');h.response=null;
      h.subscribe('CHANNEL_ERROR');await tick();assert.equal(h.received.at(-1).status,'gpsReconnecting');
      assert.ok(h.received.at(-1).snapshot,'authorized last-known fallback');h.subscribe('SUBSCRIBED');await tick();
      if(scenario==='revoked'){
        let resolve;h.response=()=>new Promise(r=>{resolve=r;});h.network();await tick();
        h.events[1].fn();assert.equal(h.received.at(-1).snapshot,null,'revocation signal hides cache before fetch');
        h.response=async()=>({data:{ok:false,error:'forbidden'},error:null,status:200});
        resolve({data:snapshot(2),error:null,status:200});await tick();
        assert.equal(h.received.at(-1).snapshot,null,'in-flight pre-revoke read cannot resurrect location');
        assert.equal(h.received.at(-1).status,'gpsForbidden');
      }else if(scenario==='logout'){h.auth.setState({status:'local',revision:1});}
      else if(scenario==='expiry'){[...h.timers.values()][0].fn();}
      else h.app('background');
      if(scenario!=='revoked'){
        assert.equal(h.received.at(-1).snapshot,null);assert.equal(h.channelRemoved,1,'session/end lifecycle unsubscribes');
        const count=h.received.length;h.events[1].fn();await tick();assert.equal(h.received.length,count,'no late event after teardown');
      }
    }finally{stop();}
  }
  console.log('PASS Realtime: update→authorized fetch, disconnect/reconnect, last-known fallback, revocation races, logout, exact token expiry and background teardown.');
}
function contractChecks(){
  const live=load('src/location/live.ts'),p=point();assert.equal(live.freshness(p),'gpsCurrent');
  assert.equal(live.freshness(point('old',6*60000)),'gpsStale');assert.equal(live.freshness(null),'gpsUnavailable');
  assert.equal(live.freshness(point('expired',25*3600000)),'gpsUnavailable');
  assert.equal(live.validPoint({...p,latitude:NaN}),false);assert.equal(live.validPoint({...p,longitude:181}),false);
  assert.equal(live.validPoint({...p,accuracy:-1}),false);assert.equal(live.validPoint(point('future',-120000)),false);
  assert.equal(live.newerSnapshot(snapshot(10),snapshot(9)).revision,10,'stale revision protection');
  const config=require('../app.config.js'),base=require('../app.json').expo;
  const names=['GOOGLE_MAPS_API_KEY','GOOGLE_MAPS_IOS_API_KEY','EAS_BUILD','EAS_BUILD_PLATFORM'];const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  try{
    names.forEach(n=>delete process.env[n]);assert.equal(config({config:base}).extra.mapsConfigured.android,false);
    process.env.GOOGLE_MAPS_API_KEY='invalid';assert.throws(()=>config({config:base}),/Invalid Google Maps/);
    const synthetic='AIza'+'0'.repeat(35);process.env.GOOGLE_MAPS_API_KEY=synthetic;
    const result=config({config:base});assert.equal(result.android.config.googleMaps.apiKey,synthetic);assert.ok(!JSON.stringify(result.extra).includes(synthetic));
    delete process.env.GOOGLE_MAPS_API_KEY;process.env.EAS_BUILD='true';assert.throws(()=>config({config:base}),/Configure/);
  }finally{for(const name of names)if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name];}
  assert.equal(base.version,'1.0.1');assert.equal(base.android.versionCode,2);
  const map=fs.readFileSync('components/location/location-map.native.tsx','utf8');assert.match(map,/provider=\{PROVIDER_GOOGLE\}/);assert.match(map,/mapsConfigured/);
  const {strings}=load('src/i18n/index.ts');for(const lang of ['en','hi','as','bn','mni','kha','lus'])for(const key of Object.keys(strings.en).filter(k=>k.startsWith('gps'))){
    assert.ok(strings[lang][key]?.trim(),lang+'.'+key);assert.deepEqual([...strings[lang][key].matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),[...strings.en[key].matchAll(/\{\w+\}/g)].map(m=>m[0]).sort());
  }
  for(const f of ['src/services/ai-assistant.service.ts','supabase/functions/ai-care-assistant/index.ts'])assert.doesNotMatch(fs.readFileSync(f,'utf8'),/location_(points|snapshot|sharing)|latitude|longitude/,'GPS excluded from AI');
  assert.match(fs.readFileSync('components/location/location-panel.tsx','utf8'),/accessibilityLiveRegion/);
  assert.equal(base.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-location')[1].isAndroidBackgroundLocationEnabled,false);
  console.log('PASS location contracts: freshness, bounds, stale revisions, seven-language parity, accessibility states, Google provider/key configuration, no AI GPS and truthful foreground capability.');
}
async function uiChecks(){
  const {t}=load('src/i18n/index.ts');
  for(const language of ['en','hi','as','bn','mni','kha','lus']){
    let listener;const calls=[];
    const render=screen('components/location/location-panel.tsx',{
      'react-native':{View:'View',AppState:{addEventListener:()=>({remove(){}})},Linking:{openSettings:async()=>{}}},
      '@/src/cloud/auth':{useAuthStore:fn=>fn({revision:0,status:'signed-in'}),captureAccount:()=>({current:()=>true})},
      '@/src/location/live':load('src/location/live.ts'),
      '@/src/services/location.service':{
        useLocationStore:()=>({patientId:null,status:'gpsPaused',point:null}),
        watchPatientLocation:(_,fn)=>{listener=fn;fn({snapshot:snapshot(),status:'gpsConnected'});return()=>{};},
        setLocationSharing:async(...args)=>{calls.push(args);return snapshot(2);},
      },
      './location-map':{LocationMap:'LocationMap'},
    },{patientId:'one',language,device:false});
    try{
      render();let tree=nodes(render());
      const button=key=>tree.find(n=>n.type==='SmaranButton'&&n.props.label===t(language,key));
      assert.ok(button('gpsPause'));assert.ok(button('gpsRevoke'));assert.ok(button('gpsSetZone'));
      for(const b of tree.filter(n=>n.type==='SmaranButton'))assert.ok(b.props.accessibilityLabel?.trim());
      button('gpsSetZone').props.onPress();await tick();tree=nodes(render());
      assert.equal(calls[0][0],'one');assert.equal(calls[0][1],'zone');assert.deepEqual(calls[0][2],{latitude:0,longitude:0,radius:300});
      assert.ok(tree.some(n=>n.props?.children===t(language,'gpsSaved')));
      listener({snapshot:{...snapshot(3),point:point('old',6*60000)},status:'gpsReconnecting'});tree=nodes(render());
      assert.ok(tree.some(n=>n.props?.children===t(language,'gpsStale')));assert.equal(button('gpsSetZone').props.disabled,true);
      listener({snapshot:null,status:'gpsForbidden'});tree=nodes(render());
      assert.ok(!tree.some(n=>n.type==='LocationMap'),'revoked map hidden');
      assert.ok(tree.some(n=>n.props?.children===t(language,'gpsForbidden')));
    }finally{render.unmount();}
  }
  console.log('PASS location screens: seven languages, labelled controls, safe-zone submission, success, stale state, disabled stale centre and revoked map removal.');
}
async function main(){contractChecks();await sqliteChecks();await serviceChecks();await realtimeChecks();await uiChecks();}
module.exports={main};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
