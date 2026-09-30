const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./check-elderly-ux.cjs');
// Compare every historical field; MVP-12 separately verifies the new activity fields.
const historicalColumns = {"cognitive_sessions":"id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,hints_used,repeated_mistakes,avg_response_ms,accuracy,feedback_label,recommended_difficulty,is_demo_seed,created_at","adaptive_model_state":"patient_id,bias,weight_accuracy,weight_pace,weight_memory,weight_hints,weight_stability,sample_count,updated_at"};

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-my-day-'));
  const file = path.join(directory, 'test.sqlite');
  let sqlite;
  function open() {
    sqlite = new DatabaseSync(file); sqlite.exec('PRAGMA foreign_keys = ON');
    assert.equal(sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  }
  open();
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...args),
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const patient = 'patient-qa-one', other = 'patient-qa-two';
  let selectedPatient = patient;
  const activeBoundary = { resolveActivePatient: async () => ({ status: 'ready', profile: { id: selectedPatient } }) };
  const overrides = {
    '../client': { getDatabase: async () => db },
    './active-patient.service': activeBoundary,
    '../stores/patient-session.store': { capturePatientRequest: () => () => true, captureReminderManagement: () => () => true }
  };
  const repo = load('src/db/repositories/my-day.repository.ts', overrides).myDayRepository;
  const patientRepo = load('src/db/repositories/patient.repository.ts', overrides).patientRepository;
  const { t, strings } = load('src/i18n/index.ts');
  const { localDay, localDateTime, validateReminder, timeLabel } = load('src/my-day/types.ts');
  const base = { type: 'medicine', title: 'User reminder', note: '', timeOfDay: '08:00', scheduledDate: null, repeatRule: 'daily' };
  assert.equal(timeLabel('en','00:00'),'12:00 AM');
  const restart = () => { sqlite.close(); open(); };
  try {
    await load('src/db/migrations/001_core_bootstrap.ts').coreBootstrapMigration.up(db);
    await db.runAsync('INSERT INTO patient_profiles (id,preferred_name,created_at,updated_at) VALUES (?,?,?,?),(?,?,?,?)', patient,'Anima','old','old',other,'Bina','old','old');
    await db.runAsync('INSERT INTO patient_settings (id,patient_id,language,updated_at) VALUES (?,?,?,?)','settings',patient,'as','old');
    await load('src/db/migrations/002_cognitive_adaptation.ts').cognitiveAdaptationMigration.up(db);
    await db.runAsync(`INSERT INTO cognitive_sessions (id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,avg_response_ms,accuracy,recommended_difficulty,created_at)
      VALUES (?,?,'memory_match',1,'old','old',2,2,2,1000,1,1,'old')`,'session',patient);
    await db.runAsync(`INSERT INTO adaptive_model_state VALUES (?,0,1,2,3,4,5,6,'old')`,patient);
    await load('src/db/migrations/003_multilingual_expansion.ts').multilingualExpansionMigration.up(db);
    await db.execAsync(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1,'core_bootstrap','old'),(2,'cognitive_adaptation','old'),(3,'multilingual_expansion','old');`);
    const snapshot = async () => Promise.all(['patient_profiles','patient_settings','cognitive_sessions','adaptive_model_state'].map(table => db.getAllAsync('SELECT ' + (historicalColumns[table] ?? '*') + ' FROM ' + table)));
    const before = await snapshot();
    const { runMigrations } = load('src/db/migrations/index.ts');
    await runMigrations(db); await runMigrations(db);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, 16);
    assert.deepEqual(await repo.today(patient),[]);
    for (const bad of [{type:'invalid'}, {timeOfDay:'24:00'}, {title:' '}, {repeatRule:'weekly'}, {repeatRule:'once',scheduledDate:'2026-02-30'}]) {
      assert.throws(() => validateReminder({...base,...bad}));
    }
    for (const value of ['invalid','medicine']) {
      await assert.rejects(db.runAsync(`INSERT INTO reminders (patient_id,type,title,time_of_day,repeat_rule,created_at,updated_at) VALUES (?,?,?,'08:00','daily','now','now')`,value==='invalid'?patient:'missing-patient',value,'test'), value==='invalid' ? /CHECK constraint failed/ : /FOREIGN KEY constraint failed/);
    }
    const reminders = [];
    for (const type of ['medicine','hydration','activity','appointment','custom']) reminders.push(await repo.save(patient,{...base,type}));
    let reminder = reminders[0];
    restart(); assert.equal((await repo.get(patient,reminder.id)).timeOfDay,'08:00');
    assert.equal((await repo.today(patient)).length,5);
    assert.deepEqual(await repo.list(other),[]);
    assert.equal(await repo.get(other,reminder.id),null);
    await assert.rejects(repo.save(other,base,reminder.id));
    await assert.rejects(repo.setEnabled(other,reminder.id,false));
    await assert.rejects(repo.remove(other,reminder.id));
    await assert.rejects(repo.complete(other,reminder.id,localDay()));
    assert.deepEqual(await repo.history(patient),[]);
    await repo.complete(patient,reminder.id,localDay());
    const firstCompletion = await repo.history(patient, reminder.id, localDay());
    assert.equal(firstCompletion.length, 1);
    const event = firstCompletion[0];
    assert.equal(event.reminderId, reminder.id);
    assert.equal(event.patientId, patient);
    assert.equal(event.status, 'completed');
    assert.equal(event.scheduledFor, localDay() + 'T08:00');
    assert.ok(Number.isFinite(Date.parse(event.completedAt)));
    assert.equal(event.createdAt, event.completedAt);
    assert.equal((await db.getFirstAsync('SELECT count(*) AS count FROM reminder_events')).count, 1);
    await repo.complete(patient,reminder.id,localDay());
    assert.deepEqual(await repo.history(patient,reminder.id), firstCompletion);
    assert.deepEqual(await repo.history(patient), firstCompletion);
    assert.deepEqual(await repo.history(patient, '  ' + reminder.id + '  '), firstCompletion);
    assert.deepEqual(await repo.history(patient, '  ' + reminder.id + '  ', localDay()), firstCompletion);
    await assert.rejects(repo.complete(other,reminder.id,localDay()), error => error.code === 'missing');
    assert.equal((await db.getFirstAsync('SELECT count(*) AS count FROM reminder_events')).count, 1);
    restart(); assert.equal((await repo.history(patient)).length,1);
    assert.equal((await repo.today(patient)).find(r=>r.id===reminder.id).completed,true);
    await assert.rejects(db.runAsync('UPDATE reminder_events SET status = ?','completed'), /Reminder events are append-only/);
    await assert.rejects(db.runAsync('DELETE FROM reminder_events'), /Reminder events are append-only/);
    await assert.rejects(db.runAsync(`INSERT INTO reminder_events (reminder_id,patient_id,scheduled_for,status,completed_at,created_at) VALUES (?,?,?,'completed','now','now')`,reminders[1].id,other,localDay()+'T08:00'), /FOREIGN KEY constraint failed/);
    await assert.rejects(repo.history(patient, ' '));
    await repo.save(patient,{...base,title:"Anima's reminder",timeOfDay:'09:15'},reminder.id);
    restart(); assert.equal((await repo.get(patient,reminder.id)).title,"Anima's reminder");
    await repo.complete(patient,reminder.id,localDay()); assert.equal((await repo.history(patient)).length,1);
    await repo.setEnabled(patient,reminder.id,false); restart(); assert.equal((await repo.get(patient,reminder.id)).isEnabled,false);
    assert.equal((await repo.today(patient)).length,4);
    await repo.setEnabled(patient,reminder.id,true);
    const future = localDay(new Date(Date.now()+86400000));
    const once = await repo.save(patient,{...base,type:'appointment',repeatRule:'once',scheduledDate:future});
    assert.ok(!(await repo.today(patient)).some(r=>r.id===once.id));
    assert.ok((await repo.today(patient,localDateTime(future,'12:00'))).some(r=>r.id===once.id));
    await assert.rejects(repo.complete(patient,once.id,localDay()));
    const completedOnce = await repo.save(patient,{...base,repeatRule:'once',scheduledDate:localDay(),timeOfDay:'23:59'});
    await repo.complete(patient,completedOnce.id,localDay());
    const allEvents = await repo.history(patient);
    assert.equal(allEvents.length, 2);
    assert.deepEqual(new Set(allEvents.map(event=>event.reminderId)), new Set([reminder.id,completedOnce.id]));
    assert.ok(allEvents.every(event=>event.patientId===patient && event.status==='completed'));
    assert.ok((await repo.currentCompletions(patient)).some(e=>e.reminderId===completedOnce.id));
    await repo.save(patient,{...base,repeatRule:'once',scheduledDate:future},completedOnce.id);
    assert.ok(!(await repo.currentCompletions(patient)).some(e=>e.reminderId===completedOnce.id));
    await repo.remove(patient,completedOnce.id);
    await repo.remove(patient,reminder.id); restart();
    assert.ok(!(await repo.list(patient)).some(r=>r.id===reminder.id));
    assert.deepEqual(await repo.history(patient,reminder.id),firstCompletion);
    assert.deepEqual(await repo.history(other),[]);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'),[]);
    assert.deepEqual(await snapshot(), before);

    // Distinct sentinel values expose swapped SQL bindings across every mutable reminder field.
    const createInput = { type:'custom', title:'Binding audit create', note:'Create note', timeOfDay:'06:17', repeatRule:'once', scheduledDate:future };
    const auditReminder = await repo.save(patient, createInput);
    const fields = value => Object.fromEntries(Object.keys(createInput).map(key => [key, value[key]]));
    assert.deepEqual(fields(await repo.get(patient,auditReminder.id)),createInput);
    assert.equal(auditReminder.patientId,patient);
    assert.equal(auditReminder.isEnabled,true);
    assert.equal(auditReminder.notificationId,null);
    assert.equal(auditReminder.notificationRevision,0);
    assert.equal(auditReminder.revision,1);
    const updateInput = { type:'hydration', title:'Binding audit update', note:'Different update note', timeOfDay:'19:43', repeatRule:'daily', scheduledDate:null };
    const updated = await repo.save(patient,updateInput,auditReminder.id);
    assert.deepEqual(fields(await repo.get(patient,auditReminder.id)),updateInput);
    assert.equal(updated.createdAt,auditReminder.createdAt);
    assert.equal(updated.revision,2);
    assert.equal(await repo.acknowledgeNotification(auditReminder,'stale-notification'),false);
    assert.equal(await repo.acknowledgeNotification({...updated,patientId:other},'wrong-patient'),false);
    assert.equal((await repo.get(patient,updated.id)).notificationId,null);
    assert.equal(await repo.acknowledgeNotification(updated,'binding-audit-notification'),true);
    const acknowledged = await repo.get(patient,updated.id);
    assert.equal(acknowledged.notificationId,'binding-audit-notification');
    assert.equal(acknowledged.notificationRevision,updated.revision);
    assert.equal(await repo.acknowledgeNotification(updated,null),true);
    assert.equal((await repo.get(patient,updated.id)).notificationId,null);
    await repo.setEnabled(patient,updated.id,false);
    assert.equal((await repo.get(patient,updated.id)).isEnabled,false);
    await repo.remove(patient,updated.id);
    const removed=await repo.get(patient,updated.id);
    assert.ok(removed.deletedAt);
    assert.equal(removed.updatedAt,removed.deletedAt);
    assert.equal(removed.isEnabled,false);
    assert.equal(removed.patientId,patient);
    assert.ok(!(await repo.list(patient)).some(r=>r.id===removed.id));
    assert.ok((await repo.list(patient,true)).some(r=>r.id===removed.id));

    // Only the OS notification boundary is replaced; all service and repository code runs against real SQLite.
    let permission = 'undetermined', requests = 0, schedulingFails = false, cancellationFails = false, dismissalFails = false;
    const pending = new Map(), presented = new Map(), canceled = [], channels = new Map();
    const native = {
      AndroidImportance:{DEFAULT:3,HIGH:4}, IosAuthorizationStatus:{PROVISIONAL:3,EPHEMERAL:4}, SchedulableTriggerInputTypes:{DAILY:'daily',DATE:'date'},
      setNotificationHandler:()=>{}, setNotificationChannelAsync:async(id,channel)=>{channels.set(id,channel);},
      getPermissionsAsync:async()=>({status:permission,granted:permission==='granted'}),
      requestPermissionsAsync:async()=>{requests++; return {status:permission,granted:permission==='granted'};},
      getAllScheduledNotificationsAsync:async()=>[...pending.values()],
      getPresentedNotificationsAsync:async()=>[...presented.values()].map(request=>({request})),
      dismissNotificationAsync:async id=>{if(dismissalFails)throw Error('dismiss');presented.delete(id);},
      cancelScheduledNotificationAsync:async id=>{if(cancellationFails)throw Error('cancel');canceled.push(id);pending.delete(id);},
      scheduleNotificationAsync:async input=>{if(schedulingFails)throw Error('schedule');pending.set(input.identifier,input);return input.identifier;},
    };
    const service = load('src/services/my-day.service.ts',{
      ...overrides,
      'expo-notifications':native,'react-native':{Platform:{OS:'android'}},'../db/repositories/my-day.repository':{myDayRepository:repo},
    }).myDayService;
    for(const p of ['undetermined','denied']) {permission=p;assert.equal((await service.sync(patient)).permission,p);assert.equal(pending.size,0);}
    assert.equal(requests,0);
    permission='granted'; await service.sync(patient,true); assert.equal(requests,1);
    assert.deepEqual(channels.get('smaran-reminders'),{name:t('as','dayNotificationTitle'),importance:4,sound:'smaran_alarm.wav',vibrationPattern:[0,500,250,500]});
    const count=pending.size; assert.equal(count,5);
    await service.sync(patient);assert.equal(pending.size,count);
    for (const item of pending.values()) assert.equal(item.trigger.channelId,'smaran-reminders','every alarm targets the sounding channel');
    // Schedules left on the retired silent channel migrate without duplicating identifiers.
    const migrated = [...pending.values()].filter(item => item.trigger.type === 'daily');
    for (const item of migrated) item.trigger = { ...item.trigger, channelId: 'my-day' };
    canceled.length = 0; await service.sync(patient); assert.equal(pending.size,count);
    for (const item of pending.values()) assert.equal(item.trigger.channelId,'smaran-reminders');
    assert.ok(migrated.every(item => canceled.includes(item.identifier)),'old channel entries cancelled once');
    assert.equal(new Set([...pending.keys()]).size,pending.size,'no duplicate identifiers after migration');
    const target=reminders[1], identifier='smaran-my-day-'+target.id;
    const privateContent={title:t('as','dayNotificationTitle'),body:t('as','dayNotificationBody'),sound:'smaran_alarm.wav',data:{reminderId:target.id,alarmSound:'smaran_alarm.wav'}};
    assert.deepEqual(pending.get(identifier).content,privateContent);
    // Matching revisions must not preserve an old sensitive payload, even during a warm sync.
    pending.get(identifier).content={title:'Synthetic medicine name',body:'Synthetic appointment notes'};
    presented.set(identifier,{identifier,content:{title:'Old private title',body:'Old private note'}});
    presented.set('other-feature',{identifier:'other-feature',content:{title:'Unrelated'}});
    presented.set('smaran-my-day-generic',{identifier:'smaran-my-day-generic',content:privateContent});
    dismissalFails=true;
    assert.equal((await service.sync(patient)).failed,true);
    assert.deepEqual(pending.get(identifier).content,privateContent,'Scheduling still completes when dismissal fails');
    assert.ok(presented.has(identifier));
    dismissalFails=false; assert.equal((await service.sync(patient)).failed,false);
    assert.ok(!presented.has(identifier));
    assert.ok(presented.has('other-feature') && presented.has('smaran-my-day-generic'));
    await service.save(patient,{...base,type:'hydration',timeOfDay:'17:30'},target.id);
    assert.ok(canceled.includes(identifier));assert.equal(pending.get(identifier).trigger.hour,17);
    assert.equal(pending.get(identifier).trigger.minute,30);
    assert.equal((await repo.get(patient,target.id)).notificationId,identifier);
    await service.setEnabled(patient,target.id,false);assert.ok(!pending.has(identifier));
    await service.setEnabled(patient,target.id,true);assert.ok(pending.has(identifier));
    schedulingFails=true;
    const saved=await service.save(patient,{...base,title:'Survives notification failure'});
    assert.equal(saved.notifications.failed,true);assert.ok(await repo.get(patient,saved.reminder.id));
    restart(); schedulingFails=false; assert.equal((await service.sync(patient)).failed,false);
    assert.ok(pending.has('smaran-my-day-'+saved.reminder.id));
    cancellationFails=true;
    assert.equal((await service.remove(patient,target.id)).failed,true);
    assert.ok((await repo.get(patient,target.id)).deletedAt);assert.ok(pending.has(identifier));
    cancellationFails=false; await service.sync(patient); assert.ok(!pending.has(identifier));
    // Recover native schedule when acknowledgement was interrupted, without another identifier.
    const recovered=await repo.get(patient,saved.reminder.id);
    await db.runAsync('UPDATE reminders SET notification_id=NULL,notification_revision=0 WHERE id=?',recovered.id);
    const oldCount=pending.size; await service.sync(patient); assert.equal(pending.size,oldCount);
    await Promise.all([service.save(patient,{...base,title:'Concurrent one'},recovered.id),service.save(patient,{...base,title:'Concurrent two'},recovered.id)]);
    assert.equal((await repo.get(patient,recovered.id)).title,'Concurrent two');
    assert.deepEqual(pending.get('smaran-my-day-'+recovered.id).content, {
      ...privateContent, data:{reminderId:recovered.id,alarmSound:'smaran_alarm.wav'},
    });
    await service.remove(patient,once.id); assert.ok(!pending.has('smaran-my-day-'+once.id));
    // Deterministic early-Done investigation. This checks requested triggers, not OS delivery.
    const RealDate = Date;
    let clock = new RealDate(2030,0,15,12,0).getTime();
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [clock])); }
      static now() { return clock; }
    };
    try {
      const earlyDaily=(await service.save(patient,{...base,title:'Early daily Done',timeOfDay:'14:00'})).reminder;
      const dailyId='smaran-my-day-'+earlyDaily.id;
      const originalTrigger=pending.get(dailyId).trigger;
      assert.equal(originalTrigger.type,'daily');
      assert.equal(originalTrigger.hour,14);
      assert.equal(originalTrigger.minute,0);
      await service.complete(patient,earlyDaily.id,localDay());
      await service.sync(patient);
      assert.equal((await repo.today(patient)).find(r=>r.id===earlyDaily.id).completed,true);
      assert.deepEqual(pending.get(dailyId).trigger,originalTrigger);
      assert.ok(!canceled.includes(dailyId));
      assert.equal([...pending.values()].filter(n=>n.identifier===dailyId).length,1);
      const earlyOnce=(await service.save(patient,{...base,title:'Early one-date Done',repeatRule:'once',scheduledDate:localDay(),timeOfDay:'15:00'})).reminder;
      const onceId='smaran-my-day-'+earlyOnce.id;
      assert.ok(pending.has(onceId));
      await service.complete(patient,earlyOnce.id,localDay());
      await service.sync(patient);
      assert.ok(!pending.has(onceId));
      assert.ok(canceled.includes(onceId));
      restart();
      assert.equal((await repo.today(patient)).find(r=>r.id===earlyDaily.id).completed,true);
      clock = new RealDate(2030,0,16,12,0).getTime();
      await service.sync(patient); await service.sync(patient);
      assert.equal((await repo.today(patient)).find(r=>r.id===earlyDaily.id).completed,false);
      assert.deepEqual(pending.get(dailyId).trigger,originalTrigger);
      assert.equal([...pending.values()].filter(n=>n.identifier===dailyId).length,1);
      assert.ok(!pending.has(onceId));
    } finally { global.Date=RealDate; }
    // Saved patient settings drive both trigger kinds, including warm language changes at matching revisions.
    const languages = ['en','hi','as','bn','mni','kha','lus'];
    assert.deepEqual(Object.keys(strings).sort(), [...languages].sort());
    const localizedDaily = await repo.save(patient,{...base,title:'Synthetic medicine name',note:'Synthetic private instructions'});
    const localizedOnce = await repo.save(patient,{...base,type:'appointment',title:'Synthetic appointment title',note:'Synthetic appointment notes',repeatRule:'once',scheduledDate:future});
    for (const language of languages) {
      await db.runAsync('UPDATE patient_settings SET language=? WHERE patient_id=?',language,patient);
      assert.deepEqual(await service.sync(patient),{permission:'granted',failed:false});
      for (const record of [localizedDaily,localizedOnce]) {
        const notification=pending.get('smaran-my-day-'+record.id);
        assert.deepEqual(notification.content,{title:t(language,'dayNotificationTitle'),body:t(language,'dayNotificationBody'),sound:'smaran_alarm.wav',data:{reminderId:record.id,alarmSound:'smaran_alarm.wav'}});
        assert.equal(notification.trigger.type,record.repeatRule==='daily'?'daily':'date');
        assert.ok(!JSON.stringify(notification.content).includes('Synthetic'));
        assert.equal((await repo.get(patient,record.id)).revision,record.revision);
      }
      for (const key of ['dayNotificationTitle','dayNotificationBody']) {
        assert.ok(strings[language][key].trim());
        assert.ok(!/[{}]/u.test(strings[language][key]));
        if(language!=='en') assert.notEqual(strings[language][key],strings.en[key]);
      }
      presented.set('smaran-my-day-generic-'+language,{identifier:'smaran-my-day-generic-'+language,
        content:{title:t(language,'dayNotificationTitle'),body:t(language,'dayNotificationBody')}});
    }
    await db.runAsync('UPDATE patient_settings SET language=? WHERE patient_id=?','as',patient);
    await service.sync(patient);
    assert.ok(languages.every(language=>presented.has('smaran-my-day-generic-'+language)),'Retain safe presented content in every language');
    const ownSchedules=JSON.stringify([...pending.values()]);
    const otherReminder=await repo.save(other,{...base,title:'Other patient private title'});
    const otherId='smaran-my-day-'+otherReminder.id;
    assert.deepEqual(await service.sync(other),{permission:'granted',failed:false}); // Missing settings: safe English, no borrowed language.
    assert.equal(pending.get(otherId).content.title,t('en','dayNotificationTitle'));
    assert.equal(JSON.stringify([...pending.values()].filter(n=>n.identifier!==otherId)),ownSchedules);
    // Each patient's existing daily alarms must rebuild after an offset change.
    // Reconciling A first must not make B's old schedule appear up to date.
    const originalOffset = Date.prototype.getTimezoneOffset;
    const changedOffset = new Date().getTimezoneOffset() + 60;
    try {
      Date.prototype.getTimezoneOffset = () => changedOffset;
      canceled.length = 0;
      await service.sync(patient);
      assert.ok(canceled.includes('smaran-my-day-' + localizedDaily.id));
      await service.sync(other);
      assert.ok(canceled.includes(otherId), 'timezone reconciliation must be scoped to each patient');
    } finally { Date.prototype.getTimezoneOffset = originalOffset; }
    selectedPatient = other;
    await service.remove(other,otherReminder.id);
    selectedPatient = patient;
    const fallback=load('src/services/my-day.service.ts',{
      './active-patient.service': activeBoundary,
      'expo-notifications':native,'react-native':{Platform:{OS:'android'}},
      '../db/repositories/my-day.repository':{myDayRepository:repo},
      '../db/repositories/patient.repository':{patientRepository:{...patientRepo,getSettings:async()=>{throw Error('Injected language read failure');}}},
      '../stores/patient-session.store': overrides['../stores/patient-session.store']
    }).myDayService;
    const fallbackSaved=await fallback.save(patient,{...base,title:'Saved despite language read failure',note:'Private free text'});
    assert.deepEqual(fallbackSaved.notifications,{permission:'granted',failed:false});
    assert.equal((await repo.get(patient,fallbackSaved.reminder.id)).note,'Private free text');
    assert.deepEqual(pending.get('smaran-my-day-'+fallbackSaved.reminder.id).content,
      {title:t('en','dayNotificationTitle'),body:t('en','dayNotificationBody'),sound:'smaran_alarm.wav',data:{reminderId:fallbackSaved.reminder.id,alarmSound:'smaran_alarm.wav'}});
    await service.sync(patient);
    assert.equal(pending.get('smaran-my-day-'+fallbackSaved.reminder.id).content.title,t('as','dayNotificationTitle'));
    assert.equal(t('unsupported','dayNotificationBody'),t('en','dayNotificationBody'));
    permission='denied'; await service.sync(patient); assert.equal(pending.size,0);
    const web=load('src/services/my-day.service.ts',{...overrides,'expo-notifications':{},'react-native':{Platform:{OS:'web'}},'../db/repositories/my-day.repository':{myDayRepository:repo}}).myDayService;
    assert.deepEqual(await web.sync(patient),{permission:'unavailable',failed:false});
    assert.deepEqual(await snapshot(),before);
    for (let i=0;i<50;i++) await repo.save(other,{...base,title:'Capacity '+i});
    await assert.rejects(repo.save(other,base),error=>error.code==='limit');
    const first=(await repo.list(other))[0]; await repo.setEnabled(other,first.id,false);
    await repo.save(other,base); await assert.rejects(repo.setEnabled(other,first.id,true),error=>error.code==='limit');
    const previousTZ=process.env.TZ;
    try {
      for(const zone of ['Asia/Kolkata','America/New_York']) {
        process.env.TZ=zone;
        assert.equal(localDateTime('2030-05-12','08:00').getHours(),8);
        assert.equal(localDay(localDateTime('2030-05-12','08:00')),'2030-05-12');
      }
      assert.throws(()=>validateReminder({...base,repeatRule:'once',scheduledDate:'2030-03-10',timeOfDay:'02:30'}));
    } finally { if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ; }
    const engine=load('src/games/memory-match/engine.ts');
    const expected=[2,3,4,6,8];
    for(let difficulty=1;difficulty<=5;difficulty++) {
      let game=engine.startPlaying(engine.startPreview(engine.createMemoryGame(difficulty,()=>0.5)));
      assert.equal(game.cards.length,expected[difficulty-1]*2);
      for(const symbol of new Set(game.cards.map(c=>c.symbolId))) {
        const indexes=game.cards.flatMap((c,i)=>c.symbolId===symbol?[i]:[]);
        game=engine.flipCard(game,indexes[0]).state; game=engine.flipCard(game,indexes[1]).state;
        game=engine.resolveComparison(game);
      }
      assert.equal(game.status,'SESSION_COMPLETE');
    }
    sqlite.close(); sqlite=new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db); await runMigrations(db);
    assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, 16);
    assert.deepEqual(await repo.list(patient),[]);
    console.log('PASS: migrations 001–007 and idempotence, existing data, constraints/FKs, patient isolation, five categories, file reopen persistence, append-only/duplicate Done, local dates, CRUD, notification permission/failure/retry/cancel/reschedule/queue and web fallback; explicit completion ownership/status, binding audit, early-Done and tomorrow schedule preservation');
    console.log('PASS: seven-language daily/once notification content, warm language rescheduling, safe presented messages, patient isolation and missing/failed language lookup fallback without losing saved reminders');
  } finally { sqlite.close(); assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(directory).startsWith('smaran-my-day-')); fs.rmSync(directory,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
