const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, pre8, A, stamp } = require('./check-auth-sync-migration.cjs');
const { insertRow, rowFor, games: oldGames } = require('./check-cognitive-migration.cjs');
const engine = load('src/games/selection-engine.ts');
const { prepareGridActivity } = load('src/games/grid-activities.ts');
const { CognitiveActivityTypes: games } = load('src/db/schema.types.ts');
const { extraGameStrings } = load('src/i18n/extra-game-strings.ts');
const { t, strings } = load('src/i18n/index.ts');
const extra = ['remember_lights', 'number_path'];
const tick = () => new Promise(setImmediate);
const seeded = (seed = 123) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const prepare = (game, level) => prepareGridActivity(game, level, seeded());

let currentPlayTime = Date.parse(stamp);
function play(game, level, wrong = true) {
  const activity = prepare(game, level);
  let now = currentPlayTime, state = engine.createSelection(activity.tasks, now);
  assert.throws(() => engine.finalizeSelection(state, game));
  for (const [index, task] of activity.tasks.entries()) {
    if (index === 0 && wrong) {
      const mistake = task.choices.find(choice => choice !== task.answer);
      for (const hint of [0, 1, 3]) {
        state = engine.chooseSelection(state, activity.tasks, mistake, now += 1000);
        assert.equal(state.hintLevel, hint); assert.equal(state.position, 0);
        assert.equal(state.correctSelections, 0, 'coaching never invents successful taps');
      }
      assert.equal(engine.chooseSelection(state, activity.tasks, mistake, now), state);
    }
    state = engine.resumeSelection(state, now += 60000);
    state = engine.chooseSelection(state, activity.tasks, task.answer, now += 1000);
    assert.equal(engine.chooseSelection(state, activity.tasks, task.answer, now), state, 'rapid double tap is ignored');
    if (index < activity.tasks.length - 1) state = engine.continueSelection(state, now += 10000);
  }
  const value = engine.finalizeSelection(state, game);
  assert.equal(value.stepsCompleted, activity.tasks.length);
  assert.equal(value.correctSelections, value.stepsCompleted);
  assert.equal(value.attempts, value.correctSelections + (wrong ? 3 : 0));
  assert.equal(value.repeatedErrors, wrong ? 2 : 0); assert.equal(value.hintsUsed, wrong ? 2 : 0);
  assert.equal(value.accuracy, value.correctSelections / value.attempts);
  assert.equal(value.averageResponseMs, 1000, 'observation/continuation/background excluded by resume boundary');
  assert.ok(!('challengesCompleted' in value) && !('totalPairs' in value));
  currentPlayTime = now + 1000;
  return value;
}

function contracts() {
  assert.deepEqual(games, [...oldGames, ...extra, 'sudoku_lite', 'chess_puzzle', 'word_match']);
  const titles = load('src/games/presentation.ts').activityTitleKeys;
  for (const game of extra) {
    assert.ok(titles[game]);
    const route = game === 'remember_lights' ? 'remember-lights' : 'number-path';
    assert.match(fs.readFileSync(`app/patient/games/${route}.tsx`, 'utf8'), new RegExp(`gameType="${game}"`));
    assert.ok(fs.readFileSync('app/patient/games/index.tsx', 'utf8').includes(`/patient/games/${route}`));
    for (const level of [0, 6, NaN, 2.5]) assert.throws(() => prepare(game, level));
    for (let level = 1; level <= 5; level++) {
      const a = prepare(game, level);
      assert.deepEqual(a, prepare(game, level));
      assert.notDeepEqual(a, prepareGridActivity(game, level, seeded(456)), 'seed controls spatial/sequence variation');
      assert.equal(new Set(a.tiles).size, a.tiles.length);
      if (game === 'number_path') {
        assert.deepEqual(a.tasks.map(task => Number(task.answer)), Array.from({ length: [5, 7, 10, 10, 10][level - 1] }, (_, i) => i + 1));
        assert.deepEqual([...a.tiles].sort((x, y) => Number(x) - Number(y)), a.tasks.map(task => task.answer));
      } else { assert.equal(a.rounds, 2); assert.equal(a.roundLength, level + 1); assert.ok(a.presentationMs >= 1400); }
      play(game, level); play(game, level, false);
      let state = engine.createSelection(a.tasks, 0);
      for (let i = 1; i <= 3; i++) { state = engine.hintSelection(state); assert.equal(state.hintLevel, i); }
      assert.equal(engine.hintSelection(state), state);
    }
  }
  for (const [language, catalog] of Object.entries(extraGameStrings)) {
    for (const key of ['lightsInstructions', 'numberInstructions']) {
      assert.ok(!catalog[key].includes(t(language, 'continue')), 'Instructions must not ask for the removed per-answer Continue button');
    }
    assert.deepEqual(Object.keys(catalog), Object.keys(extraGameStrings.en));
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim()); assert.equal(strings[language][key], value);
      const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      assert.deepEqual(slots(value), slots(extraGameStrings.en[key]));
      if (language !== 'en') assert.notEqual(value, extraGameStrings.en[key]);
    }
  }
  for (const file of ['src/games/grid-activities.ts', 'components/games/grid-activity-board.tsx', 'src/i18n/extra-game-strings.ts']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /among\s*us|simon\s*says|reactor|unlock\s*manifolds|countdown|setInterval|https?:|diagnos|dementia stage|prevent cognitive|slow cognitive/i);
  }
  for (const file of [...fs.readdirSync('src/db/migrations').filter(f => /^00[1-8]_/.test(f)).map(f => 'src/db/migrations/' + f),
    'supabase/migrations/20260912000000_auth_sync.sql', 'src/db/client.web.ts']) {
    assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), execFileSync('git', ['show', '9a4f43c:' + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n'), file + ' unchanged');
  }
  // MVP-23 authorizes SDK-54 PDF dependencies plus required network/mail
  // dependencies for care-circle reports. GPS left the product surface, so its
  // packages are absent. Preserve all existing fields while explicitly
  // validating each required new dependency.
  for (const file of ['package.json','package-lock.json']) {
    const before = JSON.parse(execFileSync('git',['show','a58ea61:'+file],{encoding:'utf8'}));
    const after = require('./check-dependency-security.cjs').readBeforeSecurityUpdate(file);
    const dependencies = file === 'package.json' ? after.dependencies : after.packages[''].dependencies;
    if (file === 'package-lock.json') {
      assert.deepEqual(after.packages['node_modules/expo-asset'], before.packages['node_modules/expo/node_modules/expo-asset'], 'SDK asset peer hoisted without upgrade');
      delete before.packages['node_modules/expo/node_modules/expo-asset'];
    }
    for (const [name,version] of Object.entries({'expo-network':'~8.0.8','expo-print':'~15.0.8','expo-sharing':'~14.0.8','expo-mail-composer':'~15.0.8','expo-location':'~19.0.8','react-native-maps':'1.20.1','expo-audio':'~1.1.1','expo-battery':'~10.0.8','expo-asset':'~12.0.13'})) {
      assert.equal(dependencies[name],version,name + ' required'); delete dependencies[name];
      if (file === 'package-lock.json') { assert.equal(after.packages['node_modules/'+name].version,version.replace(/^~/,'')); delete after.packages['node_modules/'+name]; }
    }
    // GPS left the product surface, so its packages and their transitive lock
    // entries are gone; the remaining required Expo modules pull no extra entries.
    assert.equal(after.version,'1.0.1');before.version='1.0.1';
    if (file === 'package-lock.json') {
      assert.equal(after.packages['node_modules/unimodules-app-loader'],undefined);
      assert.equal(after.packages['node_modules/@types/geojson'].version,'7946.0.16');delete after.packages['node_modules/@types/geojson'];
      before.packages[''].version='1.0.1';
    }
    assert.deepEqual(after,before,'all other dependency fields preserved: '+file);
  }
  console.log('PASS extra games: eight-game catalog/routes, seeded playable rounds at all five levels, full 1–10, coaching/hints/completion, truthful telemetry, seven catalogs, original UI, historical source preservation.');
}

async function runtime() {
  const r = createDatabase(), cache = new Map();
  r.active = 'one';
  r.overrides = { '../client': { getDatabase: async () => r.db }, './active-patient.service': {
    resolveActivePatient: async () => ({ status: 'ready', profile: { id: r.active } }),
  } };
  r.module = file => load(file, r.overrides, cache);
  r.repo = r.module('src/db/repositories/cognitive.repository.ts').cognitiveRepository;
  r.session = r.module('src/stores/patient-session.store.ts');
  r.cognitive = r.module('src/stores/cognitive-session.store.ts').useCognitiveSessionStore;
  r.onboarding = r.module('src/stores/onboarding.store.ts').useOnboardingStore;
  r.run = r.module('src/db/migrations/index.ts').runMigrations;
  r.rows = table => r.sqlite.prepare(`SELECT rowid AS saved_rowid,* FROM ${table} ORDER BY rowid`).all();
  return r;
}

async function migrationChecks() {
  const r = await runtime();
  try {
    await pre8(r.db);
    const m8 = r.module('src/db/migrations/008_auth_sync.ts').authSyncMigration;
    await r.db.withExclusiveTransactionAsync(async db => { await m8.up(db); await db.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)', 8, m8.name, stamp); });
    for (const id of ['one', 'two']) {
      await r.module('src/db/repositories/patient.repository.ts').patientRepository.upsertProfileWithSettings({ id, preferredName: id }, { language: id === 'one' ? 'en' : 'hi' });
      for (const game of oldGames) {
        insertRow(r.sqlite, 'cognitive_sessions', rowFor(game, `${id}-${game}`, id));
        const model = r.module('src/ai/adaptive-engine.ts').createInitialAdaptiveModel(id, game);
        insertRow(r.sqlite, 'adaptive_model_state', { patient_id: id, game_type: game, bias: model.bias,
          weight_accuracy: model.weights.accuracy, weight_pace: model.weights.pace, weight_memory: model.weights.memory,
          weight_hints: model.weights.hints, weight_stability: model.weights.stability, sample_count: 7, updated_at: stamp });
      }
    }
    // Seed the historical 008 ownership shape; current link() requires migration 011.
    await r.db.runAsync('INSERT INTO sync_accounts(owner_id,linked_at) VALUES(?,?)', A, stamp);
    await r.db.runAsync('INSERT INTO sync_patient_owners(patient_id,owner_id,linked_at) SELECT id,?,? FROM patient_profiles', A, stamp);
    await r.db.runAsync('UPDATE sync_installation SET default_owner_id=? WHERE singleton=1', A);
    r.sqlite.exec(`CREATE INDEX extra_game_test_index ON cognitive_sessions(completed_at DESC) WHERE is_demo_seed = 0;
      CREATE TRIGGER extra_game_test_trigger AFTER UPDATE ON patient_settings BEGIN SELECT count(*) FROM cognitive_sessions; END;`);
    const tables = r.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(row => row.name);
    const snapshot = () => Object.fromEntries(tables.map(table => [table, r.rows(table)]));
    const schema = () => r.sqlite.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name').all();
    const before = snapshot(), beforeSchema = schema();
    const fks = Object.fromEntries(tables.map(table => [table, r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all()]));
    for (const fault of ['DROP TRIGGER', 'CREATE TABLE cognitive_sessions_v9', 'CREATE INDEX extra_game_test_index', 'CREATE TRIGGER sync_initial_snapshot', 'INSERT INTO schema_migrations']) {
      r.db.fault = fault; await assert.rejects(r.run(r.db), /Injected/);
      assert.deepEqual(snapshot(), before, fault + ' rollback rows/outbox/models');
      assert.deepEqual(schema(), beforeSchema, fault + ' rollback schema/triggers');
    }
    r.db.fault = null;
    const originalAll = r.db.getAllAsync;
    r.db.getAllAsync = async (sql, ...args) => sql === 'PRAGMA foreign_key_check' ? [{}] : originalAll(sql, ...args);
    await assert.rejects(r.run(r.db), /foreign key/); assert.deepEqual(snapshot(), before); assert.deepEqual(schema(), beforeSchema);
    r.db.getAllAsync = originalAll;
    const migration11 = r.module('src/db/migrations/011_sync_consent.ts').syncConsentMigration;
    const runThrough11 = load('src/db/migrations/index.ts', { './011_sync_consent': { syncConsentMigration: { ...migration11, up: async tx => {
      // Preserve every historical assertion before the deliberate 011 consent metadata change.
      for (const table of tables) {
        assert.deepEqual(table === 'schema_migrations' ? r.rows(table).slice(0, 8) : r.rows(table), before[table], 'exact fields/IDs/rowids: ' + table);
        assert.deepEqual(r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all(), fks[table]);
      }
      for (const item of beforeSchema.filter(item => item.type === 'trigger' || item.type === 'index')) assert.deepEqual(schema().find(row => row.name === item.name), item);
      await migration11.up(tx);
    } } } }).runMigrations;
    await runThrough11(r.db);
    const after = snapshot(); await r.run(r.db); assert.deepEqual(snapshot(), after, 'registry replay is idempotent');
    assert.equal(r.rows('schema_migrations').length, 16);
    for (const game of extra) {
      const count = prepare(game, 1).tasks.length;
      const row = { ...rowFor('sequence_memory', 'new-' + game, 'one', 1), game_type: game, steps_completed: count,
        correct_selections: count, attempts: count + 2, accuracy: count / (count + 2) };
      const outbox = r.rows('sync_outbox').length;
      insertRow(r.sqlite, 'cognitive_sessions', row);
      assert.equal(r.rows('sync_outbox').length, outbox + 1, 'restored sync trigger enqueues exactly once');
      const event = r.rows('sync_outbox').at(-1);
      r.module('src/cloud/sync-contract.ts').validateCloudRecord({ owner_id: A, patient_id: 'one', entity_type: 'cognitive_sessions', entity_id: row.id,
        payload: JSON.parse(event.payload), deleted: false, version: 1 }, A);
      for (const change of [{ steps_completed: 1 }, { steps_completed: null }, { steps_completed: 4.5 }, { correct_selections: count - 1 }, { accuracy: 0 }, { game_type: 'unknown' }, { recommended_difficulty: 5 }, { patient_id: 'absent' }]) {
        assert.throws(() => insertRow(r.sqlite, 'cognitive_sessions', { ...row, id: 'invalid', ...change }));
      }
    }
    assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(r.sqlite.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { r.sqlite.close(); }
  for (const fk of [0, 1]) {
    const r = await runtime();
    try { r.sqlite.exec(`PRAGMA foreign_keys=${fk}`); await r.run(r.db); await r.run(r.db);
      assert.equal(r.rows('schema_migrations').length, 16); assert.equal(r.rows('cognitive_sessions').length, 0);
      assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { r.sqlite.close(); }
  }
  console.log('PASS migration 009: populated 001–008 upgrade, exact 12 historical sessions/12 models/all patient and sync rows/IDs/rowids/indexes/triggers/FKs, six rollback points, no sync echo, restored enqueue, fresh FK on/off, replay, malformed metrics.');
}

async function persistenceChecks() {
  const r = await runtime();
  try {
    await r.run(r.db);
    for (const id of ['one', 'two']) await r.module('src/db/repositories/patient.repository.ts').patientRepository.upsertProfileWithSettings({ id, preferredName: id }, { language: 'en' });
    const ai = r.module('src/ai/adaptive-engine.ts'), { extractAdaptiveFeatures } = r.module('src/ai/feature-extractor.ts');
    const service = r.module('src/services/cognitive.service.ts');
    const pending = (game, level) => {
      const telemetry = play(game, level), model = ai.createInitialAdaptiveModel(r.active, game);
      const extraction = extractAdaptiveFeatures({ patientId: r.active, currentDifficulty: level, telemetry, recentSessions: [] });
      return { patientId: r.active, telemetry, model, extraction, currentDifficulty: level, initialRecommendation: ai.recommendDifficulty(level, extraction.features, model) };
    };
    for (const id of ['one', 'two', 'one']) {
      r.active = id;
      r.session.usePatientSessionStore.setState(s => ({ patientId: id, revision: s.revision + 1 }));
      for (const game of extra) for (let level = 1; level <= 5; level++) {
        const p = pending(game, level), otherBefore = r.rows('cognitive_sessions').filter(row => row.patient_id !== id);
        const saved = await service.saveCognitiveResult(p, 'comfortable');
        const read = await r.repo.getSessionById(id, saved.session.id);
        for (const key of ['gameType', 'stepsCompleted', 'correctSelections', 'attempts', 'hintsUsed', 'repeatedErrors', 'averageResponseMs', 'accuracy']) assert.equal(read[key], p.telemetry[key]);
        assert.equal(read.patientId, id); assert.equal(await r.repo.getSessionById(id === 'one' ? 'two' : 'one', read.id), null);
        assert.deepEqual(r.rows('cognitive_sessions').filter(row => row.patient_id !== id), otherBefore);
        assert.ok(Math.abs(read.recommendedDifficulty - level) <= 1 && read.recommendedDifficulty >= 1 && read.recommendedDifficulty <= 5);
        const foreign = [{ ...read, patientId: 'absent' }, { ...read, gameType: 'memory_match' }, { ...read, isDemoSeed: true }];
        assert.deepEqual(extractAdaptiveFeatures({ patientId: id, currentDifficulty: level, telemetry: p.telemetry, recentSessions: foreign }), p.extraction);
        assert.equal((await r.repo.getAdaptiveModel(id, game)).gameType, game);
      }
    }
    for (const game of extra) {
      const p = pending(game, 3), model = await r.repo.getAdaptiveModel('one', game);
      await service.saveCognitiveResult(p, null); assert.deepEqual(await r.repo.getAdaptiveModel('one', game), model, 'skipping feedback leaves learning unchanged');
      for (const level of [1, 2, 3, 4, 5]) for (const score of [0, .25, .5, .75, 1]) {
        const next = ai.recommendDifficulty(level, { accuracy: score, relativePace: score, workingMemory: score, independence: score, stability: score }, model).recommendedDifficulty;
        assert.ok(next >= 1 && next <= 5 && Math.abs(next - level) <= 1);
      }
      const snapshot = () => JSON.stringify([r.rows('cognitive_sessions'), r.rows('adaptive_model_state'), r.rows('sync_outbox')]);
      for (const phase of ['resolution', 'database', 'patient', 'session', 'model', 'readback']) {
        const before = snapshot();
        const original = { resolve: r.overrides['./active-patient.service'].resolveActivePatient, database: r.overrides['../client'].getDatabase, first: r.db.getFirstAsync, run: r.db.runAsync };
        const flip = () => r.session.usePatientSessionStore.setState(s => ({ revision: s.revision + 2 }));
        r.overrides['./active-patient.service'].resolveActivePatient = async () => { const value = await original.resolve(); if (phase === 'resolution') flip(); return value; };
        r.overrides['../client'].getDatabase = async () => { if (phase === 'database') flip(); return r.db; };
        r.db.getFirstAsync = async (sql, ...args) => { const value = await original.first(sql, ...args); if ((phase === 'patient' && sql.includes('SELECT id FROM patient_profiles')) || (phase === 'readback' && sql.includes('SELECT * FROM cognitive_sessions WHERE patient_id'))) flip(); return value; };
        r.db.runAsync = async (sql, ...args) => { const value = await original.run(sql, ...args); if ((phase === 'session' && sql.includes('INSERT INTO cognitive_sessions')) || (phase === 'model' && sql.includes('INSERT INTO adaptive_model_state'))) flip(); return value; };
        await assert.rejects(service.saveCognitiveResult(p, 'easy'), /patient changed/); assert.equal(snapshot(), before, game + ': A→B→A at ' + phase);
        r.db.getFirstAsync = original.first; r.db.runAsync = original.run;
        r.overrides['./active-patient.service'].resolveActivePatient = original.resolve; r.overrides['../client'].getDatabase = original.database;
      }
    }
    const aggregates = await r.repo.getAnalyticsSummary('one', ['2026-09-12T00:00:00.000Z', '2026-09-13T00:00:00.000Z']);
    assert.deepEqual(new Set(aggregates.map(row => row.gameType)), new Set(extra));
    for (const row of aggregates.filter(row => row.difficulty === null)) {
      assert.equal(row.sessions, 11);
      const saved = r.rows('cognitive_sessions').filter(s => s.patient_id === 'one' && s.game_type === row.gameType);
      assert.equal(row.attempts, saved.reduce((n, s) => n + s.attempts, 0)); assert.equal(row.correct, saved.reduce((n, s) => n + s.correct_selections, 0));
    }
    assert.equal(await r.repo.countSessions('two', new Date('2026-09-12'), new Date('2026-09-13')), 10);
  } finally { r.sqlite.close(); }
  console.log('PASS extra games persistence: actual repository/service/adaptive engine, all levels, exact metrics/readback, optional learning, per-game/patient isolation, A→B→A at six async boundaries for BOTH games, factual caregiver aggregates.');
}

async function screenChecks() {
  const r = await runtime();
  const hook = store => Object.assign(selector => selector(store.getState()), { getState: store.getState });
  const native = { View: 'View', StyleSheet: { create: s => s }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isScreenReaderEnabled: async () => true, addEventListener: () => ({ remove() {} }) } };
  try {
    await r.run(r.db);
    for (const language of Object.keys(strings)) for (const game of extra) for (const level of [1, 5]) {
      let current = true;
      const routes = [], router = { replace: route => routes.push(route), dismissTo: route => routes.push(route) };
      const overrides = {
        'expo-router': { useRouter: () => router }, 'react-native': native, '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
        '@react-navigation/native': { useIsFocused: () => true }, '@/hooks/use-reduced-motion': { useReducedMotion: () => true },
        '@/hooks/use-theme-color': { useThemeColors: () => ({}) },
        '@/src/stores/patient-session.store': { capturePatientRequest: () => () => current },
        '@/src/stores/onboarding.store': { useOnboardingStore: hook(r.onboarding) },
        '@/src/stores/cognitive-session.store': { useCognitiveSessionStore: hook(r.cognitive) },
        '@services/active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'one' }, settings: { language, textSize: 'extra-large', highContrast: true, reducedMotion: true, voiceGuidance: true } }) },
        '@db/repositories/cognitive.repository': { cognitiveRepository: { getRecentSessions: async () => [{ recommendedDifficulty: level }], getAdaptiveModel: async () => null } },
      };
      for (const name of ['adaptive-engine', 'feature-extractor', 'cognitive-coach']) overrides['@ai/' + name] = r.module('src/ai/' + name + '.ts');
      for (const name of ['selection-engine', 'presentation', 'pattern-recognition', 'routine-recall', 'recall-activities', 'grid-activities', 'sudoku-lite', 'chess-puzzle', 'word-match', 'memory-match/assets']) overrides['@/src/games/' + name] = r.module('src/games/' + name + '.ts');
      overrides['@components/games/answer-feedback'] = load('components/games/answer-feedback.tsx', overrides);
      overrides['@/src/games/grid-activities'] = { prepareGridActivity: prepare };
      const parent = screen('components/games/selection-activity-screen.tsx', overrides, { gameType: game });
      parent(); await tick();
      const byId = (tree, id) => nodes(tree).find(n => n.props?.testID === id);
      byId(parent(), 'activity-start').props.onPress();
      let props, board, key, state;
      const render = () => {
        const node = nodes(parent()).find(n => n.type === 'GridActivityBoard');
        if (key !== node.key || !board) { props = { ...node.props }; key = node.key; board = screen('components/games/grid-activity-board.tsx', overrides, props); }
        else Object.assign(props, node.props);
        state = props.selection;
        return board();
      };
      const click = id => { const n = byId(render(), id); assert.ok(n, id); assert.ok(!n.props.disabled, id + ' enabled'); n.props.onPress(); };
      const watch = () => {
        if (byId(render(), 'lights-play')) click('lights-play');
        for (let i = 0; i < level + 1; i++) if (byId(render(), 'lights-next')) click('lights-next');
        click('lights-ready');
      };
      const a = prepare(game, level);
      for (let index = 0; index < a.tasks.length; index++) {
        if (game === 'remember_lights' && index % a.roundLength === 0) {
          const before = state?.attempts ?? 0;
          const tile = byId(render(), 'grid-tile-1'); assert.ok(tile.props.disabled); tile.props.onPress(); render(); assert.equal(state.attempts, before);
          watch();
        }
        const task = a.tasks[index];
        if (index === 0) {
          const wrong = task.choices.find(c => c !== task.answer);
          click('grid-tile-' + wrong); render(); assert.equal(state.hintLevel, 0); assert.equal(state.correctSelections, 0);
          assert.ok(nodes(render()).some(n => n.props?.children === t(language, game === 'remember_lights' ? 'gridWrong' : 'numberWrong', { answer: task.answer })));
          assert.equal(byId(render(), 'grid-tile-' + wrong).props.accessibilityHint, t(language, 'answerWrong'), 'wrong tile carries a non-color status hint');
          click('grid-tile-' + wrong); render(); assert.equal(state.hintLevel, 1);
          if (game === 'remember_lights') { assert.ok(byId(render(), 'lights-next'), 'second error really replays'); watch(); }
          click('grid-tile-' + wrong); render(); assert.equal(state.hintLevel, 3);
          assert.ok(byId(render(), 'grid-tile-' + wrong).props.disabled);
        }
        click('grid-tile-' + task.answer); render(); assert.equal(state.correctSelections, index + 1);
        assert.ok(byId(render(), 'grid-tile-' + task.answer).props.accessibilityState.selected, 'correct tile exposes a non-color selected state');
        if (game === 'number_path') {
          const tile = byId(render(), 'grid-tile-' + task.answer);
          assert.ok(tile.props.accessibilityState.selected); assert.equal(tile.props.accessibilityLabel, t(language, 'numberDone', { number: task.answer }));
        }
        const stale = byId(render(), 'grid-tile-' + task.answer).props.onPress; stale(); render(); assert.equal(state.correctSelections, index + 1);
        if (index === a.tasks.length - 1) {
          current = false; parent.advance(); assert.deepEqual(routes, []); current = true; props.onContinue();
        }
        parent.advance(); render();
      }
      assert.deepEqual(routes, ['/patient/games/result']);
      const p = r.cognitive.getState().pending;
      assert.equal(p.telemetry.gameType, game); assert.equal(p.telemetry.correctSelections, a.tasks.length);
      assert.equal(p.telemetry.attempts, a.tasks.length + 3); assert.equal(p.telemetry.hintsUsed, 2);
      current = false;
    }
  } finally { r.sqlite.close(); }
  console.log('PASS actual new screen + board handlers: both games × seven languages × levels 1/5, disabled observation taps, manual playback, real replay hint, reveal/selected labels, rapid taps, all rounds, pending result, stale completion guard (native boundaries substituted).');
}

async function playbackChecks() {
  const timers = new Map(), originalTimer = global.setTimeout, originalClear = global.clearTimeout;
  let sequence = 0;
  global.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence; };
  global.clearTimeout = id => timers.delete(id);
  try {
    for (const level of [1, 5]) {
      timers.clear();
      let current = true, focused = true, background;
      const activity = prepare('remember_lights', level);
      const props = { activity, selection: engine.createSelection(activity.tasks, Date.now()), language: 'en', voice: false,
        isCurrent: () => current, onChange: fn => { props.selection = fn(props.selection); }, onContinue() {} };
      const render = screen('components/games/grid-activity-board.tsx', {
        'react-native': { View: 'View', StyleSheet: { create: s => s },
          AppState: { currentState: 'active', addEventListener: (_, fn) => { background = fn; return { remove() {} }; } },
          AccessibilityInfo: { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove() {} }) } },
        '@react-navigation/native': { useIsFocused: () => focused }, '@/hooks/use-reduced-motion': { useReducedMotion: () => false },
        '@/hooks/use-theme-color': { useThemeColors: () => ({}) }, '@ai/cognitive-coach': load('src/ai/cognitive-coach.ts'),
        '@/src/games/selection-engine': engine,
        '@components/games/answer-feedback': load('components/games/answer-feedback.tsx'),
      }, props);
      const find = id => nodes(render()).find(n => n.props?.testID === id);
      find('lights-play').props.onPress(); render();
      for (let frame = 0; frame < activity.roundLength * 2; frame++) {
        assert.ok(find('grid-tile-1').props.disabled);
        const [id, timer] = timers.entries().next().value;
        assert.equal(timer.ms, frame % 2 ? 700 : activity.presentationMs);
        timers.delete(id); timer.fn(); render();
      }
      assert.equal(timers.size, 0); assert.ok(find('lights-ready'));
      find('lights-ready').props.onPress();
      find('activity-hint').props.onPress(); render();
      assert.equal(props.selection.hintsUsed, 1); assert.equal(timers.values().next().value.ms, 2400, 'hint replay is slower');
      const before = props.selection.attempts, staleTile = find('grid-tile-1').props.onPress;
      staleTile(); assert.equal(props.selection.attempts, before);
      background('background'); render();
      for (const timer of timers.values()) timer.fn(); timers.clear(); render();
      assert.ok(find('lights-play'), 'background discards interrupted observation and offers replay');
      background('active'); render(); find('lights-play').props.onPress(); render();
      current = false; for (const timer of timers.values()) timer.fn(); timers.clear();
      staleTile(); assert.equal(props.selection.attempts, before, 'stale patient cannot tap or progress playback');
      focused = false; render(); assert.ok(find('lights-play'));
      await tick();
    }
  } finally { global.setTimeout = originalTimer; global.clearTimeout = originalClear; }
  console.log('PASS timed playback: L1/L5 emphasis/gaps, input lock, slower hint, background/re-entry and stale timer/focus guards.');
}

function cloudChecks() {
  const old = fs.readFileSync('supabase/migrations/20260912000000_auth_sync.sql', 'utf8');
  const next = fs.readFileSync('supabase/migrations/20260913000000_extra_cognitive_games.sql', 'utf8');
  const func = sql => sql.slice(sql.indexOf('function public.valid_sync_record'), sql.indexOf('$$;', sql.indexOf('function public.valid_sync_record')) + 3).replace(/\r\n/g, '\n');
  const normalized = func(next).replaceAll(",'remember_lights','number_path'", '')
    .split('\n').filter(line => !line.includes("p->>'game_type' = 'remember_lights'") && !line.includes("p->>'game_type' = 'number_path'")).join('\n');
  assert.equal(normalized, func(old), 'only the activity allowlist, step mapping, and two completion rules changed');
  assert.match(next, /create or replace function public.valid_sync_record/);
  assert.doesNotMatch(next, /create table|drop |alter table|grant |revoke |security definer/i);
  const { validInstruction } = load('supabase/functions/online-ai/contract.ts');
  for (const game of games) assert.ok(validInstruction({ version: 1, task: 'game-instruction', activity: game, language: 'en' }));
  assert.ok(!validInstruction({ version: 1, task: 'game-instruction', activity: 'unknown', language: 'en' }));
  console.log('PASS cloud source compatibility: exact unchanged validator outside three required extensions, all eight instruction IDs; PostgreSQL execution is a separate disposable-database check.');
}

async function main() { contracts(); await migrationChecks(); await persistenceChecks(); await screenChecks(); await playbackChecks(); cloudChecks(); }
module.exports = { prepare, play };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
