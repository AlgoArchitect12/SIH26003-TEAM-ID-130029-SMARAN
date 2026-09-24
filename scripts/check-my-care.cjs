const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');

async function main() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const reads = [];
  let failReads = false;
  const read = (sql, args, all) => {
    if (failReads && /personal_memories/u.test(sql)) throw new Error('Injected SQLite failure');
    reads.push({ sql, args });
    const query = sqlite.prepare(sql);
    return all ? query.all(...args).map(row => ({ ...row })) : query.get(...args) ?? null;
  };
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    getFirstAsync: async (sql, ...args) => read(sql, args, false),
    getAllAsync: async (sql, ...args) => read(sql, args, true),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...args),
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const overrides = { '../client': { getDatabase: async () => db } };
  const cache = new Map();
  const patientRepo = load('src/db/repositories/patient.repository.ts', overrides, cache).patientRepository;
  const cognitive = load('src/db/repositories/cognitive.repository.ts', overrides, cache).cognitiveRepository;
  const dayRepo = load('src/db/repositories/my-day.repository.ts', overrides, cache).myDayRepository;
  const { loadCaregiverDashboard: dashboard, careWindows } = load('src/services/caregiver.service.ts', overrides, cache);
  const { localDay, localDateTime } = load('src/my-day/types.ts');
  const patient = 'care-one', other = 'care-two', empty = 'care-empty';
  // DST transition day in America/New_York, ordinary calendar day in India and UTC.
  const now = new Date(2026, 2, 8, 12, 0, 0);
  const w = careWindows(now), day = localDay(now), tomorrow = localDay(w.end);
  const iso = offset => new Date(now.getTime() + offset).toISOString();
  const stamp = (dayOffset, time = '09:00') => localDateTime(localDay(new Date(2026, 2, 8 + dayOffset)), time).toISOString();
  const session = async (id, owner, at, demo = 0) => db.runAsync(`INSERT INTO cognitive_sessions
    (id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,hints_used,repeated_mistakes,avg_response_ms,accuracy,recommended_difficulty,is_demo_seed,created_at)
    VALUES (?,?,'memory_match',2,?,?,3,4,3,0,0,1250.5,0.75,3,?,?)`, id, owner, at, at, demo, at);
  const reminder = async (id, type, time, repeat = 'daily', date = null, enabled = 1, deleted = null, owner = patient) => {
    await db.runAsync(`INSERT INTO reminders (id,patient_id,type,title,time_of_day,repeat_rule,scheduled_date,is_enabled,deleted_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, id, owner, type, id, time, repeat, date, enabled, deleted, iso(-10000), iso(-10000));
  };
  const complete = (id, date = day, time = '09:00', owner = patient) => db.runAsync(`INSERT INTO reminder_events
    (reminder_id,patient_id,scheduled_for,status,completed_at,created_at) VALUES (?,?,?,'completed',?,?)`, id, owner, `${date}T${time}`, iso(-2000), iso(-2000));
  try {
    await load('src/db/migrations/index.ts').runMigrations(db);
    for (const id of [patient, other, empty]) await patientRepo.upsertProfileWithSettings({ id, preferredName: id }, { language: 'as' });
    assert.equal(await dashboard('not-present', now), null);
    for (const invalid of ['', null, undefined, 'x'.repeat(129)]) await assert.rejects(dashboard(invalid, now));
    await assert.rejects(dashboard(patient, new Date(NaN)));
    const blank = await dashboard(empty, now);
    assert.deepEqual(blank.patient, { id: empty, preferredName: empty });
    assert.deepEqual(blank.cognitive, { today: 0, last7: 0, previous7: 0, recent: [] });
    assert.deepEqual(blank.routine, { today: [], done: 0, pending: 0 });
    assert.deepEqual(blank.memories, { count: 0, recent: [] });
    assert.deepEqual(blank.upcoming, []); assert.equal(blank.appointment, null); assert.deepEqual(blank.recentActivity, []);
    assert.equal(await dashboard("care-one' OR 1=1 --", now), null, 'bound malicious ID does not select a patient');

    for (const [id, date] of [['outside', new Date(w.previous7.getTime() - 1)], ['previous-start', w.previous7],
      ['previous-end', new Date(w.last7.getTime() - 1)], ['last-start', w.last7],
      ['yesterday-end', new Date(w.today.getTime() - 1)], ['today-start', w.today], ['latest', new Date(iso(-1000))]]) {
      await session(id, patient, date.toISOString());
    }
    await session('other-session', other, iso(-500));
    await session('demo', patient, iso(500), 1);
    let result = await dashboard(patient, now);
    assert.equal(result.cognitive.today, 2); assert.equal(result.cognitive.last7, 4); assert.equal(result.cognitive.previous7, 2);
    assert.equal(result.cognitive.recent[0].id, 'latest');
    assert.equal(result.cognitive.recent[0].accuracy, 0.75); assert.equal(result.cognitive.recent[0].hintsUsed, 0);
    assert.equal(result.cognitive.recent[0].difficulty, 2); assert.equal(result.cognitive.recent[0].recommendedDifficulty, 3);
    assert.equal(result.cognitive.recent[0].totalPairs, 3); assert.equal(result.cognitive.recent[0].attempts, 4);
    assert.equal(result.cognitive.recent[0].averageResponseMs, 1250.5);
    await session('end-boundary', patient, w.end.toISOString());
    assert.equal(await cognitive.countSessions(patient, w.today, w.end), 2, 'exclusive local end');
    sqlite.prepare('DELETE FROM cognitive_sessions WHERE id = ?').run('end-boundary');
    await db.runAsync("INSERT INTO adaptive_model_state VALUES (?,'memory_match',99,99,99,99,99,99,100,?)", patient, iso(0));
    assert.deepEqual((await dashboard(patient, now)).cognitive, result.cognitive, 'model weights never treated as a level');
    for (let i = 0; i < 55; i++) await session(`bulk-${i}`, other, iso(-4000 - i));
    assert.equal((await dashboard(other, now)).cognitive.today, 56, 'counts not limited to recent-session cap');

    await reminder('early-done', 'medicine', '18:00'); await complete('early-done', day, '18:00');
    await assert.rejects(complete('early-done', day, '19:00'), /UNIQUE/u);
    await reminder('past-daily', 'hydration', '08:00');
    await reminder('next', 'hydration', '13:00');
    await reminder('once-today', 'custom', '15:00', 'once', day);
    await reminder('appointment', 'appointment', '10:30', 'once', tomorrow);
    await reminder('past-once', 'activity', '09:00', 'once', localDay(new Date(2026, 2, 7)));
    await reminder('disabled', 'custom', '12:01', 'daily', null, 0); await complete('disabled');
    await reminder('deleted', 'custom', '12:02', 'daily', null, 0, iso(-1000)); await complete('deleted');
    await reminder('other-reminder', 'medicine', '12:03', 'daily', null, 1, null, other); await complete('other-reminder', day, '09:00', other);
    await assert.rejects(complete('next', day, '09:00', other), /FOREIGN KEY/u);
    await reminder('moved-appointment', 'appointment', '16:00', 'once', tomorrow);
    await complete('moved-appointment', day, '16:00'); // old completion must not complete tomorrow's occurrence
    result = await dashboard(patient, now);
    assert.equal(result.routine.today.length, 4); assert.equal(result.routine.done, 1); assert.equal(result.routine.pending, 3);
    assert.deepEqual(result.routine.today, await dayRepo.today(patient, now), 'same My Day semantics');
    assert.equal(result.upcoming[0].reminder.id, 'next');
    assert.equal(result.appointment.reminder.id, 'appointment');
    assert.equal(localDay(new Date(result.appointment.scheduledAt)), tomorrow);
    assert.ok(result.upcoming.some(item => item.reminder.id === 'moved-appointment'));
    const later = await dashboard(patient, localDateTime(day, '17:00'));
    assert.equal(localDay(new Date(later.upcoming.find(item => item.reminder.id === 'early-done').scheduledAt)), tomorrow);
    assert.equal(localDay(new Date(later.upcoming.find(item => item.reminder.id === 'past-daily').scheduledAt)), tomorrow);
    await complete('once-today', day, '15:00');
    assert.ok(!(await dashboard(patient, now)).upcoming.some(item => item.reminder.id === 'once-today'));
    assert.ok(result.recentActivity.some(item => item.kind === 'reminder'), 'genuine completion history including removed reminders');
    assert.ok(result.recentActivity.filter(item => item.kind === 'reminder').every(item => item.name === undefined), 'no invented historical title');

    const memory = async (id, owner, created, updated, photo = null) => db.runAsync('INSERT INTO personal_memories VALUES (?,?,?,?,?,?,?,?)',
      id, owner, `Stored ${id}`, 'Stored relationship', 'Stored description', photo, created, updated);
    await memory('memory-old', patient, stamp(-4), stamp(-4));
    await memory('memory-new', patient, stamp(-3), iso(-100), `memories/${patient}/${'a'.repeat(32)}.jpg`);
    await memory('memory-other', other, iso(0), iso(0));
    reads.length = 0;
    const snapshot = () => ['patient_profiles', 'patient_settings', 'cognitive_sessions', 'adaptive_model_state', 'reminders', 'reminder_events', 'personal_memories'].map(table => sqlite.prepare('SELECT * FROM ' + table).all());
    const before = snapshot();
    result = await dashboard(patient, now);
    assert.deepEqual(snapshot(), before, 'read-only dashboard');
    assert.equal(result.memories.count, 2); assert.equal(result.memories.recent[0].id, 'memory-new');
    assert.equal(result.recentActivity[0].kind, 'memoryUpdated');
    assert.ok(result.recentActivity.some(item => item.kind === 'memoryCreated'));
    assert.equal(result.recentActivity.filter(item => item.id === 'updated-memory-old').length, 0);
    assert.ok(result.recentActivity.every((item, index, rows) => !index || Date.parse(rows[index - 1].at) >= Date.parse(item.at)));
    assert.ok(!JSON.stringify(result).includes(other));
    assert.ok(result.routine.today.every(item => item.patientId === patient));
    assert.ok(result.upcoming.every(item => item.reminder.patientId === patient));
    for (const { sql, args } of reads) {
      assert.match(sql, /^\s*SELECT/iu); assert.ok(args.includes(patient), 'each read binds patient ID');
      assert.match(sql, /WHERE (?:e\.)?(?:patient_id|id) = \?/u, 'no global aggregate');
    }
    assert.deepEqual((await dashboard(empty, now)).recentActivity, []);
    failReads = true; await assert.rejects(dashboard(patient, now), /Injected SQLite failure/u); failReads = false;
    assert.equal((await dashboard(patient, now)).memories.count, 2, 'retry works, failed reads never become zeros');

    const flags = { active: patient, complete: 'true' };
    const resolver = load('src/services/active-patient.service.ts', {
      '@db/repositories/patient.repository': { patientRepository: patientRepo },
      '@/src/utils/validation': load('src/utils/validation.ts'),
      './secure-storage.service': { SecureStorageKeys: { activeProfileId: 'active', onboardingCompleted: 'complete' }, getSecureValue: async key => flags[key] },
    });
    assert.equal((await resolver.resolveActivePatient()).profile.id, patient);
    flags.active = null; flags.complete = null;
    await assert.rejects(resolver.resolveActivePatient(), /More than one local patient/, 'Missing flags cannot pick between patients');
    flags.active = 'missing'; await assert.rejects(resolver.resolveActivePatient(), /Saved patient setup/);
    assert.equal(flags.active, 'missing', 'Recovery must preserve flags');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 15);
    assert.equal(w.end.getHours(), 0); assert.equal(w.last7.getHours(), 0);
    assert.equal(localDay(w.last7), '2026-03-02'); assert.equal(localDay(w.previous7), '2026-02-23');
    if (process.env.TZ === 'America/New_York') assert.equal((w.end - w.today) / 3600000, 23);
    console.log(`PASS (${process.env.TZ || 'device local'}): real SQLite, empty/missing profile, patient isolation, bound reads, read-only snapshot, >50 counts, date boundaries, real session levels, routine math, completion ownership, duplicate prevention, upcoming once/daily/appointments, memory/feed ordering and failure/retry`);
  } finally { sqlite.close(); }

  const { careStrings } = load('src/i18n/care-strings.ts');
  for (const catalog of Object.values(careStrings)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(careStrings.en).sort());
    for (const [key, text] of Object.entries(catalog)) {
      assert.ok(text.trim());
      const slots = value => [...value.matchAll(/\{(\w+)\}/gu)].map(m => m[1]).sort();
      assert.deepEqual(slots(text), slots(careStrings.en[key]));
    }
  }
  assert.equal(careStrings.en.careDone, 'Marked done in Smaran');
  const production = ['app/caregiver/home.tsx', 'src/caregiver/types.ts', 'src/services/caregiver.service.ts', 'src/i18n/care-strings.ts'];
  for (const filename of production) {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    assert.doesNotMatch(source, /\b(fetch|axios|supabase|firebase|Bhashini|setInterval)\b/u);
    assert.doesNotMatch(source, /dementia score|clinical score|medicine taken|adherence|\b(improving|worsening|deterioration|severity|progression|decline)\b/iu);
  }
  const screen = fs.readFileSync(path.join(__dirname, '../app/caregiver/home.tsx'), 'utf8');
  assert.match(screen, /useIsFocused/u); assert.match(screen, /\[focused, attempt, router\]/u);
  assert.match(screen, /MemoryPhoto/u); assert.doesNotMatch(screen, /numberOfLines|ellipsizeMode/u);
  assert.deepEqual(fs.readdirSync(path.join(__dirname, '../src/db/migrations')).filter(file => /^\d/u.test(file)).sort(),
    ['001_core_bootstrap.ts','002_cognitive_adaptation.ts','003_multilingual_expansion.ts','004_my_day.ts','005_my_memories.ts','006_cognitive_expansion.ts','007_cognitive_ai_expansion.ts','008_auth_sync.ts','009_extra_cognitive_games.ts','010_care_circle_reports.ts','011_sync_consent.ts','012_three_cognitive_games.ts', '013_report_delivery.ts', '014_patient_location.ts','015_live_location.ts']);
  const { validateMemoryPhotoPath } = load('src/memories/types.ts');
  assert.throws(() => validateMemoryPhotoPath('care-one', 'memories/care-two/' + 'a'.repeat(32) + '.jpg'));
  assert.throws(() => validateMemoryPhotoPath('care-one', '../outside.jpg'));
  console.log('PASS: seven-language caregiver parity, factual wording, offline dependency scan, focus refresh contract, existing photo-path guards, approved migration 007 registered');
}
if (require.main === module) {
  main().then(() => {
    if (!process.env.SMARAN_CARE_TZ_CHILD) for (const TZ of ['Asia/Kolkata', 'UTC', 'America/New_York']) {
      const child = spawnSync(process.execPath, [__filename], { env: { ...process.env, TZ, SMARAN_CARE_TZ_CHILD: '1' }, encoding: 'utf8' });
      process.stdout.write(child.stdout); process.stderr.write(child.stderr);
      assert.equal(child.status, 0, TZ);
    }
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
