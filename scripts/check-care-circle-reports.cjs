const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, pre8, seed, A, B, stamp } = require('./check-auth-sync-migration.cjs');
const { insertRow, rowFor } = require('./check-cognitive-migration.cjs');
const tick = () => new Promise(setImmediate);
const { CareScopes, effectiveScopes } = load('src/caregiver/care-circle.ts');
const { parseReportFacts, reportTotals, reportAccess } = load('src/caregiver/reports.ts');
const { CognitiveActivityTypes: games } = load('src/db/schema.types.ts');
const { reportHtml, reportSections } = load('src/caregiver/report-presentation.ts');
const { strings, t } = load('src/i18n/index.ts');
const memberInput = {display_name:'Synthetic trusted person',relationship:'daughter',access_role:'family',email:null,phone:null,scopes:[]};
function runtime() {
  const r=createDatabase(), cache=new Map(); r.active='one';
  r.overrides={'../client':{getDatabase:async()=>r.db},'../db/client':{getDatabase:async()=>r.db},
    './active-patient.service':{resolveActivePatient:async()=>({status:'ready',profile:await r.patient.getProfileById(r.active),settings:await r.patient.getSettings(r.active)})}};
  r.module=file=>load(file,r.overrides,cache);
  r.run=r.module('src/db/migrations/index.ts').runMigrations;
  r.patient=r.module('src/db/repositories/patient.repository.ts').patientRepository;
  r.repo=r.module('src/db/repositories/care-circle.repository.ts').careCircleRepository;
  r.sync=r.module('src/db/repositories/sync.repository.ts').syncRepository;
  r.session=r.module('src/stores/patient-session.store.ts');
  r.change=id=>{r.active=id;r.session.usePatientSessionStore.setState(s=>({revision:s.revision+1,patientId:id}));};
  r.current=()=>r.session.capturePatientRequest();
  r.rows=table=>r.sqlite.prepare(`SELECT rowid AS saved_rowid,* FROM ${table} ORDER BY rowid`).all();
  return r;
}
async function migrations() {
  for(const file of [...fs.readdirSync('src/db/migrations').filter(f=>/^00[1-9]_/.test(f)).map(f=>'src/db/migrations/'+f),
    'supabase/migrations/20260912000000_auth_sync.sql','supabase/migrations/20260913000000_extra_cognitive_games.sql']) {
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','a58ea61:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+' unchanged');
  }
  const r=runtime();
  try {
    await pre8(r.db);
    for(const [file,key] of [['008_auth_sync','authSyncMigration'],['009_extra_cognitive_games','extraCognitiveGamesMigration']]) {
      const m=r.module('src/db/migrations/'+file+'.ts')[key];
      await r.db.withExclusiveTransactionAsync(async tx=>{await m.up(tx);await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)',m.version,m.name,stamp);});
    }
    // Seed the historical 009 schema before the current repository's 011 enabled column exists.
    await seed(r.db);
    await r.db.runAsync('INSERT INTO sync_accounts(owner_id,linked_at) VALUES(?,?)',A,stamp);
    await r.db.runAsync('INSERT INTO sync_patient_owners(patient_id,owner_id,linked_at) SELECT id,?,? FROM patient_profiles',A,stamp);
    await r.db.runAsync('UPDATE sync_installation SET default_owner_id=? WHERE singleton=1',A);
    await r.sync.fail(A,await r.sync.pending(A),'network',()=>true,1234);
    // Acknowledged tail records leave an AUTOINCREMENT high-water mark above max(sequence).
    r.sqlite.exec("UPDATE sqlite_sequence SET seq=seq+100 WHERE name='sync_outbox'");
    await r.db.runAsync('INSERT INTO sync_versions VALUES(?,?,?,?,?)',A,'one','patient_profiles','one',42);
    r.sqlite.exec('CREATE TRIGGER care_test_unrelated AFTER UPDATE ON patient_settings BEGIN SELECT 1; END');
    const tables=r.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(r=>r.name);
    const snapshot=()=>Object.fromEntries(tables.map(table=>[table,r.rows(table)]));
    const schema=()=>r.sqlite.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name').all();
    const before=snapshot(), beforeSchema=schema();
    const fks=Object.fromEntries(tables.map(table=>[table,r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all()]));
    for(const fault of ['CREATE TABLE care_circle_members','INSERT INTO sync_outbox_v10','DROP TABLE sync_outbox;','CREATE TRIGGER sync_validate_care_circle_members','INSERT INTO schema_migrations']) {
      r.db.fault=fault;await assert.rejects(r.run(r.db),/Injected/);assert.deepEqual(snapshot(),before,fault+' data rollback');assert.deepEqual(schema(),beforeSchema,fault+' schema rollback');
    }
    r.db.fault=null;
    const originalAll=r.db.getAllAsync;
    r.db.getAllAsync=async(sql,...args)=>sql==='PRAGMA foreign_key_check'?[{}]:originalAll(sql,...args);
    await assert.rejects(r.run(r.db),/foreign key/);assert.deepEqual(snapshot(),before);assert.deepEqual(schema(),beforeSchema);
    r.db.getAllAsync=originalAll;
    const migration11=r.module('src/db/migrations/011_sync_consent.ts').syncConsentMigration;
    const runThrough11=load('src/db/migrations/index.ts',{'./011_sync_consent':{syncConsentMigration:{...migration11,up:async tx=>{
      // Keep every 009→010 preservation assertion at that exact boundary before 011 changes consent metadata.
      for(const table of tables) assert.deepEqual(table==='schema_migrations'?r.rows(table).slice(0,9):r.rows(table),before[table],'preserve all columns/rowids: '+table);
      for(const item of beforeSchema.filter(s=>s.type==='trigger'||s.type==='index')) assert.deepEqual(schema().find(s=>s.name===item.name),item,'preserve '+item.name);
      await migration11.up(tx);
    }}}}).runMigrations;
    await runThrough11(r.db);
    assert.equal(r.rows('schema_migrations').length, 15);
    for(const table of tables) assert.deepEqual(r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all(),fks[table],table+' FKs');
    assert.equal(r.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    const after=snapshot();await r.run(r.db);assert.deepEqual(snapshot(),after);
    assert.deepEqual(await r.db.getAllAsync('PRAGMA foreign_key_check'),[]);
    await r.repo.save('one',memberInput,()=>true);assert.equal(r.rows('sync_outbox').length,before.sync_outbox.length+1);
    assert.equal(r.rows('sync_outbox').at(-1).sequence,before.sqlite_sequence.find(s=>s.name==='sync_outbox').seq+1);
  } finally {r.sqlite.close();}
  for(const fk of ['ON','OFF']) {
    const r=runtime();try {r.sqlite.exec('PRAGMA foreign_keys='+fk);await r.run(r.db);await r.run(r.db);assert.equal(r.rows('schema_migrations').length, 15);
      assert.deepEqual(await r.repo.list('one'),[]);await assert.rejects(r.repo.save('missing',memberInput,()=>true),/Missing patient/);
    } finally{r.sqlite.close();}
  }
  console.log('PASS A: fresh FK on/off, populated 009→010, every historical row/rowid/outbox retry/sequence preserved, five injected failures + FK rollback, rerun, 001–009 and old Supabase files unchanged.');
}
async function domain() {
  const r=runtime();
  try {
    await r.run(r.db);await seed(r.db);
    const worker=await r.repo.save('one',{...memberInput,access_role:'healthcare_worker'},r.current());
    assert.deepEqual(effectiveScopes(worker),[]);assert.equal(worker.status,'local');assert.equal(worker.email,null);assert.equal(worker.phone,null);
    for(const bad of [{display_name:''},{access_role:'admin'},{email:'invalid'},{scopes:['photos']},{scopes:['reports','reports']}]) await assert.rejects(r.repo.save('one',{...memberInput,...bad},r.current()));
    let member=await r.repo.save('one',{...memberInput,email:'synthetic@example.invalid',scopes:['reports','cognitive_activity']},r.current(),worker.id);
    assert.deepEqual(effectiveScopes(member),['reports','cognitive_activity']);assert.ok(!effectiveScopes(member).includes('memories'));
    assert.equal(await r.repo.get('two',member.id),null);await assert.rejects(r.repo.save('two',memberInput,r.current(),member.id));await assert.rejects(r.repo.revoke('two',member.id,r.current()));
    await r.repo.savePreference('one',member.id,'weekly',false,r.current());assert.equal((await r.repo.preference('one')).requested,0);
    await assert.rejects(r.repo.savePreference('one',null,'weekly',true,r.current()));
    await assert.rejects(r.repo.savePreference('two',member.id,'weekly',true,r.current()));
    await r.repo.savePreference('one',member.id,'weekly',true,r.current());
    assert.equal((await r.repo.preference('one')).delivery_status,'not_configured');assert.ok((await r.repo.preference('one')).consented_at);
    member=await r.repo.save('one',{...memberInput,email:'synthetic@example.invalid',scopes:['reports']},r.current(),member.id);
    assert.equal((await r.repo.preference('one')).requested,0,'scope edits clear consent');
    await r.repo.savePreference('one',member.id,'weekly',true,r.current());await r.repo.revoke('one',member.id,r.current());
    assert.deepEqual(effectiveScopes(await r.repo.get('one',member.id)),[]);assert.equal((await r.repo.preference('one')).consented_at,null);
    await assert.rejects(r.repo.savePreference('one',member.id,'weekly',true,r.current()));await assert.rejects(r.repo.save('one',memberInput,r.current(),member.id));
    // Each write boundary invalidates a real patient revision, including A→B→A.
    for(const boundary of ['SELECT lower(hex','INSERT INTO care_circle_members','UPDATE care_circle_members']) {
      const before=r.rows('care_circle_members');const first=r.db.getFirstAsync,run=r.db.runAsync;
      const guard=r.current();let fired=false;
      const flip=sql=>{if(!fired && sql.includes(boundary)){fired=true;r.change('two');r.change('one');}};
      r.db.getFirstAsync=async(sql,...args)=>{const result=await first(sql,...args);flip(sql);return result;};
      r.db.runAsync=async(sql,...args)=>{const result=await run(sql,...args);flip(sql);return result;};
      if(boundary.startsWith('UPDATE')) await assert.rejects(r.repo.revoke('one',member.id,guard),/changed/);
      else await assert.rejects(r.repo.save('one',memberInput,guard),/changed/);
      r.db.getFirstAsync=first;r.db.runAsync=run;assert.deepEqual(r.rows('care_circle_members'),before);
    }
    const service=r.module('src/services/care-circle.service.ts');
    const original=r.repo.list;let release;
    r.repo.list=async id=>{const rows=await original(id);await new Promise(done=>{release=done;});return rows;};
    const pending=service.loadActiveCare();await tick();r.change('two');r.change('one');release();await assert.rejects(pending,/changed/);r.repo.list=original;
    for(const id of ['one','two','one']) {r.change(id);const data=await service.loadActiveCare();assert.equal(data.patient.id,id);assert.ok(data.members.every(m=>m.patient_id===id));assert.ok(data.reports.every(m=>m.patient_id===id));if(data.preference)assert.equal(data.preference.patient_id,id);}
    assert.equal(await r.repo.preference('two'),null);
    const preferences=r.rows('report_preferences'), originalRun=r.db.runAsync, preferenceGuard=r.current();
    r.db.runAsync=async(sql,...args)=>{const result=await originalRun(sql,...args);if(sql.includes('INSERT INTO report_preferences')){r.change('two');r.change('one');}return result;};
    await assert.rejects(r.repo.savePreference('one',null,'monthly',false,preferenceGuard),/changed/);
    r.db.runAsync=originalRun;assert.deepEqual(r.rows('report_preferences'),preferences,'stale preference write rolls back');
    console.log('PASS B/C/D/H: real CRUD/revoke, empty defaults, exact scopes, restricted healthcare role, explicit consent, no delivery backend success, cross-patient rejection, A→B→A and stale reads/writes roll back.');
    return r;
  } catch(e){r.sqlite.close();throw e;}
}
async function reports(r) {
  // Isolate facts from unrelated seed history, using another synthetic patient and explicit time.
  await r.patient.upsertProfileWithSettings({id:'facts',preferredName:'Synthetic <Patient> & name'},{language:'en'});
  const now=new Date(2026,8,15,12), analytics=r.module('src/services/analytics.service.ts');
  const window=analytics.analyticsWindow(7,now), start=window.boundaries[0], end=window.boundaries.at(-1);
  for(const [i,game] of games.entries()) {
    const row=rowFor(game,'fact-'+game,'facts',1);
    if(['remember_lights','number_path','sudoku_lite','chess_puzzle','word_match'].includes(game)) {
      const n={remember_lights:4,number_path:5,sudoku_lite:3,chess_puzzle:6,word_match:3}[game];Object.assign(row,{attempts:n+2,accuracy:n/(n+2),challenges_completed:null,steps_completed:n,correct_selections:n});
    }
    Object.assign(row,{started_at:start,completed_at:i===0?start:new Date(Date.parse(end)-1).toISOString()});insertRow(r.sqlite,'cognitive_sessions',row);
  }
  for(const [id,time] of [['before',new Date(Date.parse(start)-1).toISOString()],['end',end]])insertRow(r.sqlite,'cognitive_sessions',{...rowFor('memory_match',id,'facts'),started_at:time,completed_at:time});
  const reminders=r.module('src/db/repositories/my-day.repository.ts').myDayRepository;
  const water=await reminders.save('facts',{type:'hydration',title:'Synthetic water',note:'',timeOfDay:'08:00',repeatRule:'daily',scheduledDate:null});
  r.sqlite.prepare('UPDATE reminders SET created_at=?,updated_at=? WHERE id=?').run(start,start,water.id);
  for(const [i,time] of [start,new Date(Date.parse(start)+86400000).toISOString(),end].entries()) {
    insertRow(r.sqlite,'reminder_events',{patient_id:'facts',reminder_id:water.id,scheduled_for:`2026-09-${String(9+i).padStart(2,'0')}T08:00`,status:'completed',completed_at:time,created_at:time});
  }
  const service=r.module('src/services/reports.service.ts');
  const result=await service.loadReportFacts('facts',7,now), totals=reportTotals(result.facts);
  assert.equal(totals.sessions,11);assert.equal(result.facts.routine.completed,2);assert.equal(result.facts.routine.hydration,2);assert.equal(result.facts.routine.unknownCategory,0);
  const rows=r.rows('cognitive_sessions').filter(s=>s.patient_id==='facts'&&s.completed_at>=start&&s.completed_at<end);
  assert.equal(totals.attempts,rows.reduce((n,s)=>n+s.attempts,0));assert.equal(totals.correct,rows.reduce((n,s)=>n+(s.matches??s.correct_selections),0));
  assert.equal(totals.accuracy,totals.correct/totals.attempts);assert.equal(totals.hints,22);assert.equal(totals.repeatedErrors,11);
  assert.equal(reportTotals((await service.loadReportFacts('facts',30,now)).facts).sessions,12);
  assert.equal(analytics.analyticsWindow(30,now).boundaries.length,31);
  const thirtyStart=analytics.analyticsWindow(30,now).boundaries[0];
  for(const [id,time] of [['thirty-before',new Date(Date.parse(thirtyStart)-1).toISOString()],['thirty-start',thirtyStart]])
    insertRow(r.sqlite,'cognitive_sessions',{...rowFor('memory_match',id,'facts'),started_at:time,completed_at:time});
  assert.equal(reportTotals((await service.loadReportFacts('facts',30,now)).facts).sessions,13,'30-day start included; prior millisecond and exclusive end excluded');
  assert.equal(reportTotals((await service.loadReportFacts('facts',7,now)).facts).sessions,11);
  const dashboard=await r.module('src/services/caregiver.service.ts').loadCaregiverDashboard('facts',now);
  assert.equal(dashboard.cognitive.last7,totals.sessions);assert.equal(dashboard.routine.today.length,result.facts.routine.scheduledToday);
  r.change('facts');const report=await service.generateActivityReport('facts',7,r.current(),now);
  assert.equal(report.delivery_state,'generated');assert.deepEqual(parseReportFacts(report.snapshot),JSON.parse(JSON.stringify(result.facts)));
  assert.equal(await r.repo.report('one',report.id),null);
  r.sqlite.prepare('UPDATE reminders SET updated_at=? WHERE id=?').run(end,water.id);
  const edited=await service.loadReportFacts('facts',7,now);assert.equal(edited.facts.routine.hydration,0);assert.equal(edited.facts.routine.unknownCategory,2);
  assert.equal((await r.repo.report('facts',report.id)).snapshot,report.snapshot,'saved aggregate is reproducible after source edit');
  const first=r.db.getFirstAsync, run=r.db.runAsync, before=r.rows('activity_reports');
  for(const boundary of ['SELECT lower(hex','INSERT INTO activity_reports']) {
    const guard=r.current();let fired=false;
    const flip=sql=>{if(!fired&&sql.includes(boundary)){fired=true;r.change('two');r.change('facts');}};
    r.db.getFirstAsync=async(sql,...args)=>{const value=await first(sql,...args);flip(sql);return value;};
    r.db.runAsync=async(sql,...args)=>{const value=await run(sql,...args);flip(sql);return value;};
    await assert.rejects(service.generateActivityReport('facts',7,guard,now),/changed/);assert.deepEqual(r.rows('activity_reports'),before);
  }
  r.db.getFirstAsync=first;r.db.runAsync=run;
  const originalAll=r.db.getAllAsync;let release;
  r.db.getAllAsync=async(sql,...args)=>{const value=await originalAll(sql,...args);if(sql.includes('WITH days'))await new Promise(done=>{release=done;});return value;};
  const pending=service.generateActivityReport('facts',7,r.current(),now);await tick();r.change('two');release();await assert.rejects(pending,/changed/);
  r.db.getAllAsync=originalAll;assert.deepEqual(r.rows('activity_reports'),before);r.change('facts');
  const html=reportHtml(report,'en');
  assert.throws(()=>parseReportFacts(JSON.stringify({...parseReportFacts(report.snapshot),timezone:'not/a-zone'})),/time zone/i);
  for(const text of ['Smaran Activity Summary','Patient','Reporting period','Generated at','Cognitive activity','Daily routine','Safety disclaimer',t('en','reportDisclaimer')])assert.ok(html.includes(text),text);
  const unsafeNameHtml=reportHtml({...report,snapshot:JSON.stringify({...parseReportFacts(report.snapshot),patientName:'Synthetic <Patient> & name'})},'en');
  assert.ok(unsafeNameHtml.includes('&lt;Patient&gt; &amp;'));assert.ok(!unsafeNameHtml.includes('<Patient>'));
  assert.doesNotMatch(html,/https?:|<script|health score|risk increased|cognition improved|dementia progressed|medical diagnosis|severity/i);
  assert.deepEqual(reportAccess(['reports']),{cognitive:false,routine:false,memories:false});assert.throws(()=>reportAccess([]));
  const workerHtml=reportHtml(report,'en',['reports','cognitive_activity']);assert.ok(!workerHtml.includes('<h2>Memories'));assert.ok(!workerHtml.includes('<h2>Daily routine'));
  assert.equal(reportSections(report,'en',['reports']).length,2);
  console.log('PASS E/F/I: exact 7/30 local-calendar boundaries, all eight games, weighted factual counts/accuracy/hints/errors, hydration/category uncertainty, shared dashboard counts, immutable snapshot, stale generation rollback, escaped offline PDF contract and disclaimer, scoped output.');
  return report;
}
async function pdf(r,report) {
  const files=new Map();let printed=0,shared=0,available=true,pause=null;
  class File {
    constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/').replace(/(?<!:)\/+/g,'/');}
    get name(){return this.uri.split('/').at(-1);}
    get exists(){return files.has(this.uri);}get modificationTime(){return files.get(this.uri)?.at??0;}
    delete(){files.delete(this.uri);}move(target){files.set(target.uri,files.get(this.uri));files.delete(this.uri);this.uri=target.uri;}
  }
  class Directory {
    constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/').replace(/(?<!:)\/+/g,'/');}
    get exists(){return [...files.keys()].some(p=>p.startsWith(this.uri+'/'));}create(){}delete(){}
    list(){const children=new Map();for(const p of files.keys())if(p.startsWith(this.uri+'/')){const rest=p.slice(this.uri.length+1),name=rest.split('/')[0];children.set(name,rest.includes('/')?new Directory(this,name):new File(this,name));}return [...children.values()];}
  }
  const api=load('src/services/report-pdf.service.ts',{'expo-print':{printToFileAsync:async({html})=>{assert.ok(html.includes(t('en','reportDisclaimer')));printed++;const uri=`file:/cache/print/test-${printed}.pdf`;files.set(uri,{at:Date.now()});if(pause)await pause();return {uri};}},
    'expo-sharing':{isAvailableAsync:async()=>available,shareAsync:async(uri,options)=>{assert.ok(files.has(uri));assert.equal(options.mimeType,'application/pdf');assert.equal((await r.repo.report('facts',report.id)).delivery_state,'share_requested');shared++;}},
    'expo-file-system':{File,Directory,Paths:{cache:{uri:'file:/cache'}}},'react-native':{Platform:{OS:'android'}},
    '../db/repositories/care-circle.repository':r.module('src/db/repositories/care-circle.repository.ts')});
  const uri=await api.prepareReportPdf('facts',report.id,'en',r.current());assert.ok(files.has(uri));api.removeReportPdf(uri);assert.equal(files.size,0);
  available=false;await assert.rejects(api.prepareReportPdf('facts',report.id,'en',r.current(),undefined,true),api.ReportPdfUnavailable);assert.equal(shared,0);assert.equal(printed,1);available=true;
  await api.prepareReportPdf('facts',report.id,'en',r.current(),undefined,true);assert.equal(shared,1);assert.equal(files.size,1,'Android receiver can still read after chooser completion');assert.equal((await r.repo.report('facts',report.id)).delivery_state,'share_requested');
  api.cleanupReportPdfs();assert.equal(files.size,1,'fresh shared copy survives cleanup');
  const sharedUri=[...files.keys()][0];
  const preview=await api.prepareReportPdf('facts',report.id,'en',r.current());assert.notEqual(preview,sharedUri);api.removeReportPdf(preview);assert.ok(files.has(sharedUri));
  api.cleanupReportPdfs(Date.now()+86400001);assert.equal(files.size,0,'expired Android copy removed on next sweep');
  let release;pause=()=>new Promise(done=>{release=done;});const pending=api.prepareReportPdf('facts',report.id,'en',r.current(),undefined,true);await tick();
  await assert.rejects(api.prepareReportPdf('facts',report.id,'en',r.current()),/being prepared/);
  r.change('two');release();await assert.rejects(pending,/changed/);assert.equal(shared,1);assert.equal(files.size,0);r.change('facts');pause=null;
  assert.throws(()=>api.removeReportPdf('file:/cache/other.pdf'));files.set('file:/cache/smaran-reports/facts/old.pdf',{at:1});api.cleanupReportPdfs();assert.equal(files.size,0);
  for(const share of [false,true]) {
    const member=await r.repo.save('facts',{...memberInput,scopes:['reports','cognitive_activity']},r.current());
    pause=()=>r.repo.revoke('facts',member.id,r.current());
    await assert.rejects(api.prepareReportPdf('facts',report.id,'en',r.current(),member.id,share),/access changed/);
    assert.equal(files.size,0,'revocation during printing cleans both generate-only and shared PDFs');assert.equal(shared,1);
  }
  pause=null;
  console.log('PASS G: production native adapter with Print/Sharing/filesystem boundaries; PDF creation, patient cache path, unavailability, share_requested never delivered, concurrent taps, switch during print cancels share and cleans artifacts, stale-cache cleanup.');
}
async function cloud(r,report) {
  const member=await r.repo.save('facts',{...memberInput,email:'synthetic@example.invalid',scopes:['reports']},r.current());
  await r.repo.savePreference('facts',member.id,'monthly',true,r.current());
  await r.sync.link(A,()=>true);
  const all=r.rows('sync_outbox'), events=all.filter(e=>['care_circle_members','activity_reports','report_preferences'].includes(e.entity_type));
  assert.ok(events.length>=3);const validate=r.module('src/cloud/sync-contract.ts').validateCloudRecord;
  for(const [i,event] of events.entries()) {
    const value={owner_id:A,patient_id:event.patient_id,entity_type:event.entity_type,entity_id:event.entity_id,payload:JSON.parse(event.payload),deleted:false,version:i+1};
    assert.equal(validate(value,A),value);assert.throws(()=>validate(value,B));assert.throws(()=>validate({...value,patient_id:'wrong'},A));
    assert.throws(()=>validate({...value,payload:{...value.payload,secret:'bad'}},A));
    if(event.entity_type==='care_circle_members')for(const bad of [{status:'linked'},{scopes:'["memories","memories"]'},{access_role:'admin'}])assert.throws(()=>validate({...value,payload:{...value.payload,...bad}},A));
    if(event.entity_type==='activity_reports')assert.throws(()=>validate({...value,payload:{...value.payload,delivery_state:'delivered'}},A));
    if(event.entity_type==='report_preferences')assert.throws(()=>validate({...value,payload:{...value.payload,requested:1,consented_at:null}},A));
  }
  // Replay the real owner outbox into a fresh installation via production apply, with versioned parents.
  const target=runtime();try{await target.run(target.db);await target.sync.link(A,()=>true);
    const records=all.map((e,i)=>({owner_id:A,patient_id:e.patient_id,entity_type:e.entity_type,entity_id:e.entity_id,payload:JSON.parse(e.payload),deleted:e.operation==='delete',version:i+1}));
    const rank={patient_profiles:0,patient_settings:1,reminders:2,care_circle_members:3};
    for(let offset=0;offset<records.length;offset+=25){const batch=records.slice(offset,offset+25);
      const parents=records.filter(v=>v.entity_type in rank).sort((a,b)=>rank[a.entity_type]-rank[b.entity_type]);
      await target.sync.apply(A,{records:batch,parents,cursor:batch.at(-1).version,has_more:offset+25<records.length},offset,()=>true);
    }
    assert.equal((await target.repo.report('facts',report.id)).snapshot,report.snapshot);
    assert.equal((await target.repo.get('facts',member.id)).display_name,member.display_name);assert.equal(await target.repo.get('two',member.id),null);
    assert.equal((await target.repo.preference('facts')).delivery_status,'not_configured');assert.equal(target.rows('sync_outbox').length,0);
    let cursor=records.length;
    const oldPreference=await target.repo.preference('facts');
    const changed={...await target.repo.get('facts',member.id),email:'changed@example.invalid',updated_at:new Date(Date.parse(oldPreference.consented_at)+1000).toISOString()};
    const apply=async(entity_type,entity_id,payload)=>{
      const record={owner_id:A,patient_id:'facts',entity_type,entity_id,payload,deleted:false,version:cursor+1};
      await target.sync.apply(A,{records:[record],parents:[],cursor:cursor+1,has_more:false},cursor,()=>true);cursor++;
    };
    await apply('care_circle_members',member.id,changed);
    assert.equal((await target.repo.preference('facts')).requested,0);
    await apply('report_preferences','facts',oldPreference);
    assert.equal((await target.repo.preference('facts')).requested,0,'older consent cannot authorize the changed email');
    const fresh={...oldPreference,consented_at:new Date(Date.parse(changed.updated_at)+1000).toISOString()};
    await apply('report_preferences','facts',fresh);assert.equal((await target.repo.preference('facts')).requested,1);
    await apply('care_circle_members',member.id,{...changed,status:'revoked',scopes:'[]'});
    await apply('report_preferences','facts',fresh);assert.equal((await target.repo.preference('facts')).requested,0);
  }finally{target.sqlite.close();}
  const sql=fs.readFileSync('supabase/migrations/20260915000000_care_circle_reports.sql','utf8');
  assert.doesNotMatch(sql,/disable row level security|create policy|grant\s|service_role/i);assert.match(sql,/owner_id = account/);assert.match(sql,/revoke all on function public.valid_care_record/);
  console.log('PASS L: new owner-scoped sync entities, strict JS validation, invalid status/scope/consent/delivery rejection, real outbox→fresh SQLite pull with parents, no echo, no grant/RLS widening (PostgreSQL is a separate SQL check).');
}
async function ui(r,report) {
  const catalog=load('src/i18n/care-circle-strings.ts').careCircleStrings;
  const slots=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const [language,values] of Object.entries(catalog)){assert.deepEqual(Object.keys(values),Object.keys(catalog.en));for(const [key,value] of Object.entries(values)){assert.ok(value.trim());assert.equal(strings[language][key],value);assert.deepEqual(slots(value),slots(catalog.en[key]));}}
  const data={patient:await r.patient.getProfileById('facts'),settings:await r.patient.getSettings('facts'),members:[],reports:[report],recipients:[],deliveries:[],preference:null,current:r.current()};
  const overrides={'@/src/caregiver/care-circle':load('src/caregiver/care-circle.ts'),'@/src/caregiver/report-presentation':{reportSections},
    '@/src/caregiver/reports':load('src/caregiver/reports.ts'),
    '@/src/db/repositories/care-circle.repository':{careCircleRepository:r.repo},'@/src/services/reports.service':r.module('src/services/reports.service.ts'),
    '@components/caregiver/care-member-fields':load('components/caregiver/care-member-fields.tsx', { 'react-native': {View: 'View', StyleSheet: {create: s => s}}, '@components/ui/smaran-field': { Field: 'Field' }, '@components/themed-text': { ThemedText: 'ThemedText' }, '@components/ui/smaran-checkbox': { SmaranCheckbox: 'SmaranCheckbox' }, '@i18n/index': load('src/i18n/index.ts'), '@components/ui/smaran-button': { SmaranButton: 'SmaranButton' } }),
    '@/src/services/report-pdf.service':{cleanupReportPdfs(){},prepareReportPdf:async()=>null,removeReportPdf(){},ReportPdfUnavailable:class extends Error{}}};
  for(const language of Object.keys(catalog)) {
    data.settings={...data.settings,language};const render=screen('app/caregiver/circle.tsx',overrides,{data,refresh(){}});
    const add=nodes(render()).find(n=>n.type==='SmaranButton'&&n.props.label===t(language,'circleAdd'));add.props.onPress();
    const tree=nodes(render()), fields=tree.filter(n=>n.type==='Field');
    assert.equal(fields.length,4);assert.equal(fields[0].props.value,'');assert.equal(fields[2].props.value,'');assert.equal(fields[3].props.value,'');
    for(const n of tree.filter(n=>n.type==='SmaranButton'))assert.ok(n.props.accessibilityLabel);
    console.error('SmaranButtons in tree:', tree.filter(n=>n.type==='SmaranButton').map(n=>n.props.label));
    for(const scope of ['circleDaily','circleReminders','circleCognitive','reportTitle','circleMemories'])assert.equal(tree.find(n=>n.props?.label===t(language,scope)).props.accessibilityState.selected,false);
    const rr=screen('app/caregiver/reports.tsx',overrides,{data});
    const button=nodes(rr()).find(n=>n.type==='SmaranButton'&&n.props.label.startsWith(t(language,'reportSummary')+' · '));button.props.onPress();
    assert.ok(nodes(rr()).some(n=>n.props?.children===t(language,'reportDisclaimer')),language+': '+nodes(rr()).filter(n=>n.type==='ThemedText').map(n=>n.props.children).join(' | '));
    const consent=nodes(rr()).find(n=>n.props?.label===t(language,'reportConsent'));assert.equal(consent.props.accessibilityState.selected,false);assert.equal(consent.props.disabled,true);
  }
  // Render the actual shared field/button, including inherited autofill, large control and selected state.
  const custom={...memberInput,id:'custom',patient_id:'facts',relationship:'constructor',status:'local',scopes:'[]'};
  const customScreen=screen('app/caregiver/circle.tsx',overrides,{data:{...data,members:[custom]},refresh(){}});
  const edit=nodes(customScreen()).find(n=>n.props?.label===t(data.settings.language,'circleEdit'));edit.props.onPress();
  assert.equal(nodes(customScreen()).find(n=>n.type==='Field'&&n.props.label===t(data.settings.language,'circleRelationship')).props.value,'constructor');
  const theme=load('constants/colors.ts');assert.ok(theme);
  const style=load('constants/layout.ts',{'react-native':{Platform:{select:s=>s.web}}});assert.ok(style.Layout.buttonHeight>=56);
  for(const file of ['components/caregiver/care-workspace.tsx','app/caregiver/circle.tsx','app/caregiver/reports.tsx']) {
    const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/console\.|TextInput|numberOfLines=|setInterval|fetch\(/);assert.match(source,/accessibilityLabel/);
  }
  const navigation=screen('components/caregiver/care-workspace.tsx',{'expo-router':{useRouter:()=>({replace(){}})},
    '@/src/cloud/auth':{useAuthStore:()=>0},
    '@react-navigation/native':{useIsFocused:()=>true},'@/src/stores/patient-session.store':{usePatientSessionStore:()=>0},
    '@/src/stores/onboarding.store':{useOnboardingStore:()=> 'en'},'@/src/services/care-circle.service':{},'@/src/services/profile-switching.service':{}},{language:'en'});
  const destinations=nodes(navigation()).filter(n=>n.type==='SmaranButton');
  assert.equal(destinations.length,7);
  assert.ok(destinations.some(n=>n.props.label===t('en','gpsTitle')),'location is discoverable from caregiver navigation');
  console.log('PASS J/K/I: seven complete catalogs/interpolation, actual create forms with empty contact fields and no selected scopes, accessible button names/states, report viewer/disclaimer, consent off, five dashboard destinations, shared ≥56px controls and wrapping contracts.');
}
async function main(){await migrations();const r=await domain();try{const report=await reports(r);await pdf(r,report);await cloud(r,report);await ui(r,report);}finally{r.sqlite.close();}}
module.exports={runtime};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
