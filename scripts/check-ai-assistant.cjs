const assert = require('node:assert/strict');
const {load} = require('./check-elderly-ux.cjs');
const {screen,nodes} = require('./check-privacy-recovery.cjs');
const gateway = load('supabase/functions/ai-care-assistant/contract.ts');
const {t,strings} = load('src/i18n/index.ts');
const tick = () => new Promise(setImmediate);
const input = {version:1,patient_id:'A',intent:'patient_ask',language:'en',day:'2026-09-23',timezone:'Asia/Kolkata',question:'What did I do?'};
const records = [
  {kind:'cognitive_sessions',id:'session',data:{game_type:'memory_match',completed_at:'2026-09-22T20:00:00Z'}},
  {kind:'reminders',id:'reminder',data:{title:'Water',time_of_day:'08:00',repeat_rule:'daily',is_enabled:1,deleted_at:null}},
  {kind:'personal_memories',id:'memory',data:{name:'Synthetic family',relationship:'sister',description:'Recorded picnic'}},
];
const context = {ok:true,role:'owner',scopes:['reminders','cognitive_activity','memories'],records};
function request(body=input,headers={authorization:'Bearer '+'x'.repeat(24),'content-type':'application/json'}) {
  return new Request('https://example.invalid',{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});
}
async function main() {
  let value=context,auth='ok',response={ok:true,text:JSON.stringify({fact_ids:['session','reminder','memory'],suggestion:'aiHello'})},calls=0;
  const deps={authenticated:async()=>auth,context:async()=>value,provider:async()=>{calls++;return response;}};
  let result=await gateway.handleAssistant(request(),deps);
  assert.equal(result.status,200);assert.equal((await result.json()).facts.length,3,'local timezone includes late UTC previous day');
  assert.equal((await gateway.handleAssistant(request(input,{'content-type':'application/json'}),deps)).status,401);
  auth='denied';assert.equal((await gateway.handleAssistant(request(),deps)).status,401);
  auth='limited';assert.equal((await gateway.handleAssistant(request(),deps)).status,429);auth='ok';
  for(const extra of [{role:'admin'},{context:{invented:true}},{patient_id:''},{question:'x'.repeat(501)},{day:'2026-02-30'}])
    assert.equal((await gateway.handleAssistant(request({...input,...extra}),deps)).status,400);
  assert.equal((await gateway.handleAssistant(request(' '.repeat(4097)),deps)).status,413);
  const before=calls;value=null;assert.equal((await gateway.handleAssistant(request(),deps)).status,403);assert.equal(calls,before);value=context;
  for(const question of ['Diagnose dementia','What dosage should I take?','दवा की खुराक','ওষুধ চিকিৎসা'])
    assert.equal((await gateway.handleAssistant(request({...input,question}),deps)).status,400);
  for(const text of ['not json',JSON.stringify({fact_ids:['invented'],suggestion:'aiHello'}),JSON.stringify({fact_ids:[],suggestion:'Take 5 mg'}),JSON.stringify({fact_ids:[],suggestion:'aiHello',answer:'invented'})]){
    response={ok:true,text};assert.equal((await gateway.handleAssistant(request(),deps)).status,502);
  }
  response={ok:false,error:'not-configured'};result=await gateway.handleAssistant(request(),deps);
  assert.equal(result.status,503);assert.equal((await result.json()).error.code,'not-configured');
  response={ok:false,error:'unavailable'};assert.equal((await gateway.handleAssistant(request(),deps)).status,503);
  response={ok:true,text:JSON.stringify({fact_ids:[],suggestion:'aiNoData'})};value={...context,records:[]};
  assert.equal((await gateway.handleAssistant(request(),deps)).status,200);
  value=context;
  assert.equal((await gateway.handleAssistant(request(),{...deps,provider:async()=>{value=null;return response;}})).status,403,'revocation during provider wait');
  value={...context,role:'family',scopes:['reminders']};
  assert.deepEqual(gateway.contextFacts(value,input).map(f=>f.kind),['pending'],'scope filter even with overbroad records');
  assert.equal(gateway.contextFacts({...value,records:[...records,{kind:'reminder_events',id:'done',data:{reminder_id:'reminder',scheduled_for:'2026-09-23T08:00'}}]},input)[0].kind,'completed');
  const limiter=new gateway.AssistantRateLimiter(2,10);assert.ok(limiter.take('a',1));assert.ok(limiter.take('a',1));assert.ok(!limiter.take('a',1));assert.ok(limiter.take('a',12));
  const env={provider:'openai-compatible',apiUrl:'https://provider.invalid',apiKey:'synthetic',model:'test'};
  assert.equal((await gateway.callAssistantProvider({...env,apiKey:''},'','')).error,'not-configured');
  assert.equal((await gateway.callAssistantProvider(env,'','',async()=>{throw Error('timeout');})).error,'unavailable');
  assert.equal((await gateway.callAssistantProvider(env,'','',async()=>Response.json({choices:[]}))).error,'unavailable');
  const timed=load('supabase/functions/ai-care-assistant/contract.ts',{$timers:{setTimeout:fn=>setTimeout(fn,5),clearTimeout}});
  assert.equal((await timed.callAssistantProvider(env,'','',async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))))).error,'unavailable');
  console.log('PASS AI gateway: authentication, strict request/size limits, patient authorization, scope filtering, local date, empty data, provider failures, invented output rejection, medical refusal and in-flight revocation.');
  await clientChecks();await uiChecks();
}
async function clientChecks(){
  let generation=0,workspaceRevision=0;
  const accountAbort=new AbortController();
  const service=load('src/services/ai-assistant.service.ts',{
    '../cloud/config':{cloudConfig:{url:'https://gateway.invalid',key:'synthetic'}},
    '../cloud/auth':{captureAccount:()=>{const captured=generation;return {signal:accountAbort.signal,current:()=>captured===generation};},
      getCloudClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}})},
    '../stores/patient-session.store':{capturePatientRequest:()=>{const captured=generation;return ()=>captured===generation;},usePatientSessionStore:{getState:()=>({workspaceRevision})}},
  });
  const original=global.fetch;
  const options=()=>({language:'en',signal:new AbortController().signal,isCurrent:()=>true});
  try {
    global.fetch=async()=>Response.json({error:{code:'not-configured'}},{status:503});
    await assert.rejects(service.askAssistant('A','patient_ask','Hello',options()),/aiNotConfigured/);
    global.fetch=async()=>Response.json({error:{code:'medical'}},{status:400});
    await assert.rejects(service.askAssistant('A','patient_ask','Hello',options()),/aiMedical/);
    for(const change of [()=>{generation+=2;},()=>{workspaceRevision+=2;}]){
      global.fetch=async()=>{change();return Response.json({intent:'patient_ask',facts:[],suggestion:'aiHello'});};
      await assert.rejects(service.askAssistant('A','patient_ask','Hello',options()),/aiSignIn/);
    }
    global.fetch=async()=>Response.json({intent:'patient_ask',facts:[],suggestion:'invented'});
    await assert.rejects(service.askAssistant('A','patient_ask','Hello',options()),/aiUnsafe/);
    global.fetch=async()=>{throw Error('offline');};
    await assert.rejects(service.askAssistant('A','patient_ask','Hello',options()),/aiOffline/);
  } finally{global.fetch=original;}
  console.log('PASS AI client: unavailable/configuration/medical mapping, malformed response, offline fallback, A→B→A and role generation cancellation.');
}
async function uiChecks(){
  for(const language of Object.keys(strings))for(const patient of [true,false]){
    let complete;
    const props={patientId:'A',language,patient};
    const render=screen('components/ai-assistant.tsx',{
      'react-native':{View:'View',AppState:{addEventListener:()=>({remove(){}})}},
      '@/src/cloud/auth':{useAuthStore:fn=>fn({revision:0})},
      '@/src/stores/patient-session.store':{usePatientSessionStore:fn=>fn({revision:0,workspaceRevision:0})},
      '@/src/services/ai-assistant.service':{askAssistant:()=>new Promise(resolve=>{complete=resolve;})},
      '@/src/services/speech.service':{stopSpeech:async()=>{}},
      '@/src/games/presentation':load('src/games/presentation.ts'),
    },props);
    render();let tree=nodes(render());
    assert.ok(tree.some(n=>n.props?.children===t(language,patient?'aiPatientTitle':'aiTitle')));
    tree.find(n=>n.props?.label===t(language,'aiSend')).props.onPress();await tick();
    props.patientId='B';render();render();props.patientId='A';render();render();
    complete({intent:patient?'patient_ask':'caregiver_ask',facts:[{id:'old',kind:'memory',text:'STALE',at:''}],suggestion:'aiHello'});
    await tick();assert.ok(!JSON.stringify(render()).includes('STALE'));
    for(const key of gateway.suggestionKeys)assert.ok(strings[language][key],language+': '+key);
    render.unmount();
  }
  console.log('PASS AI UI: both roles × seven languages, reviewed wording catalog, accessible actions and stale A→B→A response suppression. Native boundaries substituted.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
