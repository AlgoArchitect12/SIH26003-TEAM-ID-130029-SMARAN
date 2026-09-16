const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./check-elderly-ux.cjs');

async function main() {
  const sqlite = new DatabaseSync(':memory:');
  const reads = [];
  let fail = false, switchAfterRead = false, activeId = 'one';
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...args),
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => {
      if (fail) throw Error('Injected read failure');
      reads.push({ sql, args });
      const result = sqlite.prepare(sql).all(...args).map(row => ({ ...row }));
      if (switchAfterRead) activeId = 'two';
      return result;
    },
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const cache = new Map(), overrides = { '../client': { getDatabase: async () => db } };
  const patientRepository = load('src/db/repositories/patient.repository.ts', overrides, cache).patientRepository;
  overrides['@db/repositories/patient.repository'] = { patientRepository };
  overrides['@/src/utils/validation'] = load('src/utils/validation.ts');
  overrides['./secure-storage.service'] = {
    SecureStorageKeys: { activeProfileId: 'active', onboardingCompleted: 'complete' },
    getSecureValue: async key => key === 'active' ? activeId : 'true',
  };
  const repo = load('src/db/repositories/cognitive.repository.ts', overrides, cache).cognitiveRepository;
  const service = load('src/services/analytics.service.ts', overrides, cache);
  const { analyticsWindow, loadAnalyticsSummary: summary, loadAnalyticsHistory: history, loadActiveAnalytics } = service;
  const { CognitiveActivityTypes: games } = load('src/db/schema.types.ts');
  const now = new Date(2026, 2, 8, 12); // Spring DST transition in New York.
  const w7 = analyticsWindow(7, now), w30 = analyticsWindow(30, now);
  const stamp = (offset, hour = 9) => new Date(2026, 2, 8 + offset, hour).toISOString();
  const completed = (game, level) => game === 'remember_lights' ? 2 * (level + 1) : game === 'number_path' ? [5, 7, 10, 10, 10][level - 1] :
    game === 'sudoku_lite' ? [3, 6, 8, 12, 16][level - 1] : game === 'chess_puzzle' ? [6, 4, 4, 3, 3][level - 1] :
    game === 'word_match' ? [3, 4, 4, 5, 6][level - 1] : 2;
  const add = async (owner, gameType, at, attempts = 4, ms = 1000, difficulty = 2) => {
    const correct = completed(gameType, difficulty);
    attempts += correct - 2; // Keep the same error counts with each game's actual completion length.
    const metrics = gameType === 'memory_match' ? { totalPairs: 2, matches: 2, repeatedMistakes: 1 }
      : ['pattern_recognition','familiar_object','picture_recall'].includes(gameType) ? { challengesCompleted: 2, correctSelections: 2, repeatedErrors: 1 }
        : { stepsCompleted: correct, correctSelections: correct, repeatedErrors: 1 };
    return repo.saveCompletedSession({ patientId: owner, gameType, ...metrics, difficulty,
      startedAt: new Date(Date.parse(at) - 5000).toISOString(), completedAt: at,
      attempts, hintsUsed: 1, averageResponseMs: ms, accuracy: correct / attempts, feedbackLabel: null, recommendedDifficulty: difficulty + 1 });
  };
  const snapshot = () => JSON.stringify(sqlite.prepare('SELECT * FROM cognitive_sessions ORDER BY id').all()) +
    JSON.stringify(sqlite.prepare('SELECT * FROM adaptive_model_state ORDER BY patient_id, game_type').all()) +
    JSON.stringify(sqlite.prepare('SELECT * FROM patient_profiles ORDER BY id').all()) +
    JSON.stringify(sqlite.prepare('SELECT * FROM patient_settings ORDER BY patient_id').all()) +
    JSON.stringify(sqlite.prepare('SELECT * FROM schema_migrations ORDER BY version').all());
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  try {
    await load('src/db/migrations/index.ts').runMigrations(db);
    for (const id of ['one', 'two', 'empty', 'weighted', 'boundary']) {
      await patientRepository.upsertProfileWithSettings({ id, preferredName: id }, { language: 'en' });
    }
    assert.equal(w7.boundaries.length, 8); assert.equal(w30.boundaries.length, 31);
    assert.equal(new Date(w7.boundaries[0]).getDate(), 2);
    assert.ok(w30.boundaries.every(value => new Date(value).getHours() === 0));
    assert.equal(analyticsWindow(1, now).boundaries.length, 2);
    assert.throws(() => analyticsWindow(6, now)); assert.throws(() => analyticsWindow(7, new Date(NaN)));
    if (process.env.TZ === 'America/New_York') {
      assert.equal((Date.parse(w7.boundaries[7]) - Date.parse(w7.boundaries[6])) / 3600000, 23);
      const fall = analyticsWindow(1, new Date(2026, 10, 1, 12));
      assert.equal((Date.parse(fall.boundaries[1]) - Date.parse(fall.boundaries[0])) / 3600000, 25);
    }
    assert.ok((await summary('empty', 7, now)).games.every(game => game.summary === null && !game.levels.length));
    assert.deepEqual(await history('empty'), { sessions: [], next: null });

    for (const game of games) {
      for (let i = 0; i < 61; i++) await add('one', game, stamp(0), 4, 1000, 1 + i % 4);
      await add('two', game, stamp(0), 10, 9000);
      const demo = await add('one', game, stamp(0));
      sqlite.prepare('UPDATE cognitive_sessions SET is_demo_seed = 1 WHERE id = ?').run(demo.id);
      await add('weighted', game, stamp(0), 4, 1000);
      await add('weighted', game, stamp(-1), 10, 3000);
      await add('weighted', game, stamp(-2), 6, 2000, 3);
    }
    // Calendar start inclusive/end exclusive, including exactly midnight and its adjacent millisecond.
    for (const at of [w30.boundaries[0], new Date(Date.parse(w30.boundaries[0]) - 1).toISOString(),
      w7.boundaries[0], new Date(Date.parse(w7.boundaries[0]) - 1).toISOString(),
      w7.boundaries.at(-1), new Date(Date.parse(w7.boundaries.at(-1)) - 1).toISOString()]) {
      await add('boundary', 'memory_match', at);
    }
    assert.equal((await summary('boundary', 7, now)).games[0].summary.sessions, 2);
    assert.equal((await summary('boundary', 30, now)).games[0].summary.sessions, 4);
    assert.equal((await summary('boundary', 1, now)).games[0].summary.sessions, 1);

    const weighted = await summary('weighted', 7, now);
    for (const game of weighted.games) {
      const row = game.summary;
      const c2 = completed(game.gameType, 2), c3 = completed(game.gameType, 3), correct = 2 * c2 + c3, attempts = correct + 14;
      assert.equal(row.sessions, 3); assert.equal(row.attempts, attempts); assert.equal(row.correct, correct);
      close(row.accuracy, correct / attempts); close(row.averageResponseMs, (46000 + 4000 * (c2 - 2) + 2000 * (c3 - 2)) / attempts);
      assert.equal(row.hints, 3); assert.equal(row.repeatedErrors, 3);
      assert.equal(row.participationDays, 3); assert.equal(row.averageElapsedMs, 5000);
      assert.equal(row.latestAt, stamp(0)); assert.equal(row.latestDifficulty, 2); assert.equal(row.recommendedDifficulty, 3);
      close(game.levels[0].accuracy, 2 * c2 / (2 * c2 + 10)); close(game.levels[0].averageResponseMs, (34000 + 4000 * (c2 - 2)) / (2 * c2 + 10));
      assert.equal(game.levels[0].sessions, 2); assert.equal(game.levels[1].sessions, 1);
      assert.notEqual(row.accuracy, (c2 / (c2 + 2) + c2 / (c2 + 8) + c3 / (c3 + 4)) / 3, 'not an unweighted mean of percentages');
    }
    // Existing schema requires core facts. Nullable feedback and invalid legacy elapsed timing remain unknown.
    const unknown = await add('weighted', 'memory_match', stamp(-3));
    sqlite.prepare("UPDATE cognitive_sessions SET started_at = 'unavailable' WHERE id = ?").run(unknown.id);
    const negative = await add('weighted', 'memory_match', stamp(-4));
    sqlite.prepare('UPDATE cognitive_sessions SET started_at = ? WHERE id = ?').run(stamp(1), negative.id);
    const paused = await add('weighted', 'memory_match', stamp(-5));
    sqlite.prepare('UPDATE cognitive_sessions SET started_at = ? WHERE id = ?').run(new Date(Date.parse(stamp(-5)) - 3600000).toISOString(), paused.id);
    const rawHistory = (await history('weighted', undefined, 50)).sessions;
    assert.equal(rawHistory.find(row => row.id === unknown.id).elapsedMs, null);
    assert.equal(rawHistory.find(row => row.id === unknown.id).feedback, null);
    assert.equal(rawHistory.find(row => row.id === negative.id).elapsedMs, null);
    assert.equal(rawHistory.find(row => row.id === paused.id).elapsedMs, 3600000);
    const timing = (await summary('weighted', 7, now)).games[0].summary;
    assert.equal(timing.elapsedSessions, 4); assert.equal(timing.sessions, 6);
    assert.equal(timing.averageElapsedMs, 3615000 / 4);
    const before = snapshot();
    sqlite.exec('PRAGMA query_only = ON');
    reads.length = 0;
    const one = await summary('one', 7, now), two = await summary('two', 30, now);
    assert.equal(reads.length, 2, 'one snapshot SELECT per summary');
    assert.ok(one.games.every(game => game.summary.sessions === 61 && game.summary.participationDays === 1));
    assert.ok(two.games.every(game => game.summary.sessions === 1 && game.summary.attempts === completed(game.gameType, 2) + 8));
    const expected = sqlite.prepare('SELECT id FROM cognitive_sessions WHERE patient_id = ? AND is_demo_seed = 0 ORDER BY completed_at DESC,id DESC').all('one').map(row => row.id);
    const seen = []; let cursor;
    do {
      const page = await history('one', cursor, 17);
      assert.ok(page.sessions.length <= 17);
      seen.push(...page.sessions.map(row => row.id));
      cursor = page.next;
      if (cursor) await assert.rejects(history('two', cursor, 17), /cursor/);
    } while (cursor);
    assert.deepEqual(seen, expected, '>50 rows with identical timestamps: no loss, no duplicates, correct order');
    assert.equal(new Set(seen).size, 61 * games.length);
    const first = await history('one', undefined, 50);
    assert.equal(first.sessions.length, 50); assert.ok(first.next);
    await assert.rejects(history('one', undefined, 51)); await assert.rejects(history('one', undefined, 0));
    await assert.rejects(history('one', { ...first.next, ceiling: NaN }));
    await assert.rejects(history('one', { ...first.next, completedAt: 'invalid' }));
    await assert.rejects(summary('', 7, now));
    await assert.rejects(repo.getAnalyticsSummary('one', ['invalid', stamp(0)]));
    assert.deepEqual((await history("one' OR 1=1 --")).sessions, []);
    assert.ok((await summary('empty', 30, now)).games.every(game => game.summary === null));
    for (const read of reads) {
      assert.match(read.sql, /patient_id = \?/);
      assert.match(read.sql, /is_demo_seed = 0/);
      assert.doesNotMatch(read.sql, /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|CREATE)\b/i);
    }
    activeId = 'one'; assert.equal((await loadActiveAnalytics(7)).patient.id, 'one');
    activeId = 'two'; await assert.rejects(loadActiveAnalytics(7, first.next), service.AnalyticsPatientChanged);
    assert.equal((await loadActiveAnalytics(7)).patient.id, 'two');
    activeId = 'empty'; assert.deepEqual((await loadActiveAnalytics(7)).history.sessions, []);
    activeId = 'missing'; await assert.rejects(loadActiveAnalytics(7), /Saved patient setup could not be loaded\./);
    activeId = 'one'; switchAfterRead = true;
    await assert.rejects(loadActiveAnalytics(7), service.AnalyticsPatientChanged);
    switchAfterRead = false;
    fail = true; await assert.rejects(summary('one', 7, now), /Injected/); fail = false;
    assert.equal((await summary('one', 7, now)).games[0].summary.sessions, 61);
    assert.equal(snapshot(), before, 'all analytics reads leave sessions, models, profiles, settings and migrations unchanged');

    sqlite.exec('PRAGMA query_only = OFF');
    const inserted = await add('one', 'memory_match', stamp(-1));
    await add('one', 'pattern_recognition', stamp(0));
    const continued = first.sessions.map(row => row.id); cursor = first.next;
    do {
      const page = await history('one', cursor, 50);
      continued.push(...page.sessions.map(row => row.id)); cursor = page.next;
    } while (cursor);
    assert.deepEqual(continued, expected, 'later inserts, including tied timestamps, excluded across every remaining page');
    const allAfter = []; cursor = undefined;
    do { const page = await history('one', cursor, 50); allAfter.push(...page.sessions.map(row => row.id)); cursor = page.next; } while (cursor);
    assert.ok(allAfter.includes(inserted.id), 'new traversal includes new completions');
    console.log(`PASS analytics (${process.env.TZ || 'device local'}): real SQLite/migrations/repository/service; all ${games.length} games; empty, two patients, active switch and in-flight switch; 1/7/30 calendar days; midnight/DST; weighted game/level metrics; ${61 * games.length} tied sessions; pagination; unknown timing/feedback; demo exclusion; read-only; failure/retry.`);
  } finally { sqlite.close(); }

  const { analyticsStrings } = load('src/i18n/analytics-strings.ts');
  const { strings } = load('src/i18n/index.ts');
  const slots = value => [...value.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort();
  for (const [language, catalog] of Object.entries(analyticsStrings)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(analyticsStrings.en).sort());
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim()); assert.deepEqual(slots(value), slots(analyticsStrings.en[key]));
      assert.equal(strings[language][key], value, 'wired into actual catalog');
      if (language !== 'en') assert.notEqual(value, analyticsStrings.en[key], 'no English placeholder fallback');
      assert.doesNotMatch(value, /dementia score|cognitive.health score|severity|progression|decline|improvement|clinical risk|diagnos|treatment recommendation/i);
    }
  }
  const production = ['app/caregiver/activity.tsx', 'src/services/analytics.service.ts'];
  for (const file of production) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /\b(fetch|axios|firebase|supabase|saveCompletedSession|recommendDifficulty|updateModelFromOptionalFeedback|setInterval|isDemoSeed)\b/);
    assert.doesNotMatch(source, /dementia score|cognitive.health score|severity|progression|decline prediction|clinical risk/i);
  }
  const screen = fs.readFileSync(path.join(__dirname, '../app/caregiver/activity.tsx'), 'utf8');
  assert.doesNotMatch(screen, /useLocalSearchParams|useGlobalSearchParams|numberOfLines|ellipsizeMode/);
  assert.match(screen, /AppState.addEventListener/); assert.match(screen, /request.current !== ticket/);
  assert.doesNotMatch(screen, /careNextLevel|careLevelSource/, 'window recommendations must use session-specific wording');
  assert.match(screen, /accessibilityState=\{\{ selected: days === value \}\}/);
  assert.match(screen, /accessibilityState=\{\{ expanded: expandedGame === game.gameType \}\}/);
  assert.match(fs.readFileSync(path.join(__dirname, '../components/ui/smaran-button.tsx'), 'utf8'),
    /accessibilityState=\{\{ \.\.\.accessibilityState, busy: loading, disabled \}\}/,
    'forward selected/expanded state while preserving actual busy/disabled state');
  await assert.rejects(load('src/db/client.web.ts').getDatabase(), /supported native platform/);
  console.log('PASS analytics: seven typed catalogs, all interpolations, no new English fallback, factual wording and read-only/offline UI boundary. Native-speaker review still required.');
}

if (require.main === module) main().then(() => {
  if (!process.env.SMARAN_ANALYTICS_TZ_CHILD) for (const TZ of ['Asia/Kolkata', 'UTC', 'America/New_York']) {
    const child = spawnSync(process.execPath, [__filename], { env: { ...process.env, TZ, SMARAN_ANALYTICS_TZ_CHILD: '1' }, encoding: 'utf8' });
    process.stdout.write(child.stdout); process.stderr.write(child.stderr); assert.equal(child.status, 0, TZ);
  }
}).catch(error => { console.error(error); process.exitCode = 1; });
