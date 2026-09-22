const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, rowFor, insertRow, games, stamp } = require('./check-cognitive-migration.cjs');
const tick = () => new Promise(setImmediate);
const engine = load('src/games/selection-engine.ts');
const coach = load('src/ai/cognitive-coach.ts');
const patterns = load('src/games/pattern-recognition.ts');
const routines = load('src/games/routine-recall.ts');
const recall = load('src/games/recall-activities.ts');
const { t, strings } = load('src/i18n/index.ts');
const { activityTitleKeys } = load('src/games/presentation.ts');
const prepare = (game, level) => game === 'pattern_recognition' ? patterns.preparePatterns(level)
  : game === 'routine_recall' ? routines.prepareRoutine(level).tasks
    : game === 'familiar_object' ? recall.prepareFamiliarObjects(level)
      : game === 'sequence_memory' ? recall.prepareSequence(level).tasks : recall.preparePictures(level).tasks;

function play(game, level, wrong = true) {
  const tasks = prepare(game, level);
  let now = Date.parse(stamp), state = engine.createSelection(tasks, now);
  assert.throws(() => engine.finalizeSelection(state, game));
  assert.equal(engine.continueSelection(state, now), state);
  assert.equal(engine.chooseSelection(state, tasks, 'unknown', now), state);
  for (const [index, task] of tasks.entries()) {
    assert.equal(state.hintLevel, 0, 'support resets for the next question');
    assert.equal(new Set(task.choices).size, task.choices.length);
    assert.equal(task.choices.filter(choice => choice === task.answer).length, 1);
    if (!index && wrong) {
      const mistake = task.choices.find(choice => choice !== task.answer);
      for (let n = 1; n <= 3; n++) {
        state = engine.chooseSelection(state, tasks, mistake, now += 1000);
        assert.equal(state.wrongAnswers, n); assert.equal(state.feedback, 'retry');
        assert.equal(state.hintLevel, [0, 1, 3][n - 1]);
        assert.equal(state.correctSelections, 0, 'support never invents a correct selection');
      }
      assert.equal(state.hintsUsed, 2, 'count support actually delivered, not skipped stages');
      assert.equal(engine.chooseSelection(state, tasks, mistake, now), state, 'revealed answer locks distractors');
      assert.equal(engine.hintSelection(state), state, 'no repeated hint inflation at maximum support');
    }
    state = engine.resumeSelection(state, now += 60000);
    state = engine.chooseSelection(state, tasks, task.answer, now += 1000);
    assert.equal(state.feedback, 'correct');
    assert.equal(engine.chooseSelection(state, tasks, task.answer, now), state, 'double tap cannot double count');
    if (index < tasks.length - 1) state = engine.continueSelection(state, now += 10000);
  }
  const value = engine.finalizeSelection(state, game);
  assert.equal(value.correctSelections, tasks.length);
  assert.equal(value.attempts, tasks.length + (wrong ? 3 : 0));
  assert.equal(value.repeatedErrors, wrong ? 2 : 0);
  assert.equal(value.hintsUsed, wrong ? 2 : 0);
  assert.equal(value.accuracy, tasks.length / value.attempts);
  assert.equal(value.averageResponseMs, 1000, 'preview, background and Continue waiting excluded');
  assert.ok(!('matches' in value) && !('totalPairs' in value) && !('repeatedMistakes' in value));
  return value;
}

function gameChecks() {
  for (const bad of [0, 6, 1.5, NaN, -1]) {
    for (const game of games.slice(1)) assert.throws(() => prepare(game, bad));
  }
  for (let level = 1; level <= 5; level++) {
    for (const game of games.slice(1)) {
      assert.deepEqual(prepare(game, level), prepare(game, level), 'deterministic offline content');
      play(game, level); play(game, level, false);
      let state = engine.createSelection(prepare(game, level), 0);
      for (let hint = 1; hint <= 3; hint++) { state = engine.hintSelection(state); assert.equal(state.hintLevel, hint); }
      assert.equal(state.hintsUsed, 3); assert.equal(engine.hintSelection(state), state);
    }
    const sequence = recall.prepareSequence(level), pictures = recall.preparePictures(level);
    assert.equal(sequence.preview.length, level + 1);
    assert.deepEqual(sequence.tasks.map(task => task.answer), sequence.preview);
    if (level >= 3) assert.ok(new Set(sequence.preview).size < sequence.preview.length, 'higher levels include repeated positions');
    assert.equal(new Set(pictures.preview).size, pictures.preview.length);
    for (const task of pictures.tasks) assert.deepEqual(task.choices.filter(choice => pictures.preview.includes(choice)), [task.answer], 'only one pictured answer, no ambiguous distractors');
    for (const task of patterns.preparePatterns(level)) {
      assert.equal(task.kind, level === 1 ? 'match' : level < 4 ? 'next' : 'missing');
      assert.equal(task.answer, task.kind === 'match' ? task.sequence[0] : task.kind === 'next'
        ? task.group[task.sequence.length % task.group.length] : task.sequence[task.missingIndex]);
      if (task.kind === 'missing') assert.ok(task.missingIndex > 0 && task.missingIndex < task.sequence.length - 1);
    }
    assert.equal(recall.prepareFamiliarObjects(level)[0].choices.length, level + 1);
  }
  for (const game of games) {
    let state = coach.initialCoach;
    assert.equal(coach.coachHintKey(game, state), null);
    state = coach.coachAnswer(state, false); assert.equal(state.hintLevel, 0);
    state = coach.coachAnswer(state, false); assert.equal(state.hintLevel, 1);
    assert.ok(coach.coachHintKey(game, state));
    assert.equal(coach.coachAnswer(state, true), state, 'correct response does not deliver an extra hint');
    state = coach.coachAnswer(state, false); assert.equal(state.hintLevel, 3);
  }
  assert.equal(t('en', 'coachWrong'), "That answer isn't correct. Try once more.");
  console.log('PASS cognitive AI: five selection games × five levels × supported/perfect play; distinct mechanics; truthful metrics; progressive coach; explicit wrong/correct responses; reveal/tap/continue guards');
}

async function runtime() {
  const { sqlite, db } = createDatabase(), cache = new Map();
  const overrides = { '../client': { getDatabase: async () => db }, './active-patient.service': {
    resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'one' } }),
  } };
  const module = file => load(file, overrides, cache);
  await module('src/db/migrations/index.ts').runMigrations(db);
  const patient = module('src/db/repositories/patient.repository.ts').patientRepository;
  for (const id of ['one', 'two']) await patient.upsertProfileWithSettings({ id, preferredName: id }, { language: 'en', textSize: 'extra-large', highContrast: true, reducedMotion: true });
  return { sqlite, db, overrides, module, patient, repo: module('src/db/repositories/cognitive.repository.ts').cognitiveRepository,
    service: module('src/services/cognitive.service.ts'), session: module('src/stores/patient-session.store.ts'),
    cognitive: module('src/stores/cognitive-session.store.ts').useCognitiveSessionStore, onboarding: module('src/stores/onboarding.store.ts').useOnboardingStore };
}

async function persistenceChecks() {
  const r = await runtime();
  const { extractAdaptiveFeatures } = r.module('src/ai/feature-extractor.ts');
  const { createInitialAdaptiveModel, recommendDifficulty } = r.module('src/ai/adaptive-engine.ts');
  const snapshot = () => JSON.stringify(['cognitive_sessions', 'adaptive_model_state'].map(table => r.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
  const memory = r.module('src/games/memory-match/telemetry.ts');
  let state = memory.createTelemetry(Date.parse(stamp));
  state = memory.recordComparison(state, ['home', 'leaf'], false, Date.parse(stamp) + 1000);
  state = memory.recordComparison(state, ['home', 'home'], true, Date.parse(stamp) + 2000);
  state = memory.recordComparison(state, ['leaf', 'leaf'], true, Date.parse(stamp) + 3000);
  const values = [memory.finalizeTelemetry(state, 2, Date.parse(stamp) + 3000), ...games.slice(1).map(game => play(game, 2))];
  const pendingFor = value => {
    const extraction = extractAdaptiveFeatures({ patientId: 'one', currentDifficulty: 2, recentSessions: [], telemetry: value });
    const model = createInitialAdaptiveModel('one', value.gameType);
    return { patientId: 'one', currentDifficulty: 2, telemetry: value, extraction, model,
      initialRecommendation: recommendDifficulty(2, extraction.features, model) };
  };
  try {
    for (const value of values) {
      const pending = pendingFor(value), other = { ...pending, patientId: 'two' };
      await assert.rejects(r.service.saveCognitiveResult(other, 'easy'), /patient changed/);
      const skipped = await r.service.saveCognitiveResult(pending, null);
      assert.equal(await r.repo.getAdaptiveModel('one', value.gameType), null, 'skip does not create trained model');
      const unrelatedBefore = r.sqlite.prepare('SELECT * FROM adaptive_model_state WHERE game_type != ?').all(value.gameType);
      const saved = await r.service.saveCognitiveResult(pending, 'easy');
      assert.equal(saved.session.gameType, value.gameType);
      assert.equal((await r.repo.getAdaptiveModel('one', value.gameType)).sampleCount, 1);
      assert.deepEqual(r.sqlite.prepare('SELECT * FROM adaptive_model_state WHERE game_type != ?').all(value.gameType), unrelatedBefore);
      const stored = await r.repo.getSessionById('one', saved.session.id);
      assert.deepEqual(stored, saved.session); assert.equal(await r.repo.getSessionById('two', stored.id), null);
      assert.equal(stored.attempts, value.attempts); assert.equal(stored.hintsUsed, value.hintsUsed);
      assert.equal(stored.averageResponseMs, value.averageResponseMs); assert.equal(stored.accuracy, value.accuracy);
      const raw = r.sqlite.prepare('SELECT * FROM cognitive_sessions WHERE id = ?').get(stored.id);
      if (value.gameType !== 'memory_match') {
        assert.equal(raw.total_pairs, null); assert.equal(raw.matches, null); assert.equal(raw.repeated_mistakes, null);
        assert.equal(raw.correct_selections, value.correctSelections); assert.equal(raw.repeated_errors, value.repeatedErrors);
        assert.equal(raw[['routine_recall', 'sequence_memory'].includes(value.gameType) ? 'challenges_completed' : 'steps_completed'], null);
      }
      const unrelated = [ { ...stored, patientId: 'two', averageResponseMs: 1 }, { ...stored, isDemoSeed: true },
        ...games.filter(game => game !== value.gameType).map(gameType => ({ ...stored, gameType })) ];
      assert.deepEqual(extractAdaptiveFeatures({ patientId: 'one', currentDifficulty: 2, recentSessions: unrelated, telemetry: value }), pending.extraction);
      for (let level = 1; level <= 5; level++) for (const score of [0, .25, .5, .75, 1]) {
        const recommendation = recommendDifficulty(level, { accuracy: score, relativePace: score, workingMemory: score, independence: score, stability: score }, pending.model);
        assert.ok(recommendation.recommendedDifficulty >= 1 && recommendation.recommendedDifficulty <= 5 && Math.abs(recommendation.recommendedDifficulty - level) <= 1);
      }
      assert.ok(Math.abs(skipped.recommendation.recommendedDifficulty - 2) <= 1);
    }
    const { loadCaregiverDashboard } = r.module('src/services/caregiver.service.ts');
    const dashboard = await loadCaregiverDashboard('one', new Date('2026-09-10T12:00:00'));
    assert.equal(dashboard.cognitive.today, 12);
    assert.equal((await loadCaregiverDashboard('two', new Date('2026-09-10T12:00:00'))).cognitive.today, 0);
    const aggregates = await r.repo.getAnalyticsSummary('one', ['2026-09-10T00:00:00.000Z', '2026-09-11T00:00:00.000Z']);
    assert.deepEqual(new Set(aggregates.map(row => row.gameType)), new Set(games));
    for (const row of aggregates) {
      const value = values.find(item => item.gameType === row.gameType);
      assert.equal(row.sessions, 2); assert.equal(row.attempts, 2 * value.attempts);
      assert.equal(row.correct, 2 * (value.matches ?? value.correctSelections));
    }
    const pending = pendingFor(values[1]);
    const flip = () => r.session.usePatientSessionStore.setState(s => ({ revision: s.revision + 2 })); // A → B → A is still stale.
    for (const phase of ['resolution', 'database', 'patient', 'session', 'model', 'readback']) {
      const before = snapshot(), originals = { first: r.db.getFirstAsync, run: r.db.runAsync, database: r.overrides['../client'].getDatabase,
        resolve: r.overrides['./active-patient.service'].resolveActivePatient };
      r.overrides['./active-patient.service'].resolveActivePatient = async () => { const result = await originals.resolve(); if (phase === 'resolution') flip(); return result; };
      r.overrides['../client'].getDatabase = async () => { if (phase === 'database') flip(); return r.db; };
      r.db.getFirstAsync = async (sql, ...args) => {
        const result = await originals.first(sql, ...args);
        if ((phase === 'patient' && sql.includes('SELECT id FROM patient_profiles')) || (phase === 'readback' && sql.includes('SELECT * FROM cognitive_sessions WHERE patient_id'))) flip();
        return result;
      };
      r.db.runAsync = async (sql, ...args) => {
        const result = await originals.run(sql, ...args);
        if ((phase === 'session' && sql.includes('INSERT INTO cognitive_sessions')) || (phase === 'model' && sql.includes('INSERT INTO adaptive_model_state'))) flip();
        return result;
      };
      await assert.rejects(r.service.saveCognitiveResult(pending, 'easy'), /patient changed/);
      assert.equal(snapshot(), before, 'switch at ' + phase + ' preserves every session and model');
      r.db.getFirstAsync = originals.first; r.db.runAsync = originals.run;
      r.overrides['../client'].getDatabase = originals.database; r.overrides['./active-patient.service'].resolveActivePatient = originals.resolve;
    }
    r.session.usePatientSessionStore.setState({ switching: true });
    await assert.rejects(r.service.saveCognitiveResult(pending, null), /patient changed/);
    r.session.usePatientSessionStore.setState({ switching: false });
    await assert.rejects(r.service.saveCognitiveResult({ ...pending, model: createInitialAdaptiveModel('one', 'memory_match') }, 'easy'), /model does not match/);
    assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS cognitive AI: real SQLite/repository/service saves for all six games; null non-applicable fields; independent models/feedback; patient isolation; factual caregiver analytics; A→B→A rollback at six async boundaries');
  } finally { r.sqlite.close(); }
}

// Screen event handlers and state run unchanged; only native/UI boundaries are replaced.
const hook = store => Object.assign(selector => selector(store.getState()), { getState: store.getState });
function screenBoundaries(r, settings, game, level) {
  const navigation = [], listeners = [];
  const router = { replace: route => navigation.push(route), dismissTo: route => navigation.push(route), push: route => navigation.push(route) };
  const overrides = {
    'expo-router': { useRouter: () => router }, '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
    'react-native': { View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 360, height: 800 }),
      AppState: { addEventListener: (_, handler) => { listeners.push(handler); return { remove() {} }; } } },
    '@/src/stores/patient-session.store': r.session,
    '@/src/stores/onboarding.store': { useOnboardingStore: hook(r.onboarding) },
    '@/src/stores/cognitive-session.store': { useCognitiveSessionStore: hook(r.cognitive) },
    '@services/active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'one' }, settings }) },
    '@db/repositories/cognitive.repository': { cognitiveRepository: r.repo },
    '@/hooks/use-theme-color': { useThemeColors: () => ({ text: '#123', border: '#456', surface: '#fff', primary: '#075' }) },
  };
  for (const file of ['adaptive-engine', 'feature-extractor', 'cognitive-coach']) overrides['@ai/' + file] = r.module('src/ai/' + file + '.ts');
  for (const file of ['presentation', 'selection-engine', 'pattern-recognition', 'routine-recall', 'recall-activities', 'grid-activities', 'sudoku-lite', 'chess-puzzle', 'word-match',
    'memory-match/assets', 'memory-match/difficulty', 'memory-match/engine', 'memory-match/telemetry']) overrides['@/src/games/' + file] = r.module('src/games/' + file + '.ts');
  insertRow(r.sqlite, 'cognitive_sessions', rowFor(game, `${game}-${settings.language}-${level}`, 'one', level));
  r.onboarding.getState().setLanguage(settings.language);
  return { overrides, navigation, listeners };
}

async function screenChecks() {
  for (const language of Object.keys(strings)) for (const level of [1, 5]) for (const game of games) {
    const r = await runtime();
    try {
      const settings = { ...await r.patient.getSettings('one'), language };
      const { overrides, navigation } = screenBoundaries(r, settings, game, level);
      const render = screen(path.join(__dirname, '..', game === 'memory_match' ? 'app/patient/games/memory-match.tsx' : 'components/games/selection-activity-screen.tsx'), overrides, { gameType: game });
      render(); await tick();
      let tree = render();
      const text = () => nodes(tree).filter(node => node.type === 'ThemedText').map(node => node.props.children).join(' ');
      const byId = id => nodes(tree).find(node => node.props?.testID === id);
      const byLabel = key => nodes(tree).find(node => node.type === 'SmaranButton' && node.props.label === t(language, key));
      const press = node => { assert.ok(node, `${game}: missing control`); assert.ok(!node.props.disabled, `${game}: disabled control`); node.props.onPress(); tree = render(); };
      assert.ok(text().includes(t(language, activityTitleKeys[game])));
      if (game === 'memory_match') {
        press(byLabel('gameStart'));
        let cards = nodes(tree).filter(node => node.type === 'MemoryCard');
        assert.ok(cards.every(card => card.props.disabled));
        assert.deepEqual(cards.map(card => card.props.positionLabel), cards.map((_, index) => new Intl.NumberFormat(language).format(index + 1)));
        const first = 0, wrong = cards.findIndex(card => card.props.symbol.id !== cards[first].props.symbol.id);
        press(byLabel('recallReady'));
        for (let n = 1; n <= 3; n++) {
          cards = nodes(tree).filter(node => node.type === 'MemoryCard'); press(cards[first]);
          cards = nodes(tree).filter(node => node.type === 'MemoryCard'); press(cards[wrong]);
          assert.ok(nodes(tree).some(node => node.type === 'EncouragementBanner' && node.props.message === t(language, n === 1 ? 'coachWrong' : 'coachTogether')));
          render.advance(); tree = render();
          if (n === 2 && level === 5) {
            press(byLabel('gameHint'));
            assert.equal(nodes(tree).filter(node => node.type === 'MemoryCard' && node.props.hinted).length, 1, 'second hint focuses one visible card');
          }
        }
        cards = nodes(tree).filter(node => node.type === 'MemoryCard');
        assert.equal(cards.filter(card => !card.props.disabled).length, 2, 'revealed pair is tappable, other cards disabled');
        while (!r.cognitive.getState().pending) {
          cards = nodes(tree).filter(node => node.type === 'MemoryCard');
          const a = cards.findIndex(card => !card.props.disabled && card.props.state === 'hidden');
          const b = cards.findIndex((card, index) => index !== a && card.props.symbol.id === cards[a].props.symbol.id && card.props.state !== 'matched');
          press(cards[a]); cards = nodes(tree).filter(node => node.type === 'MemoryCard'); press(cards[b]);
          render.advance(); tree = render();
        }
        const value = r.cognitive.getState().pending.telemetry;
        assert.equal(value.attempts, value.totalPairs + 3); assert.equal(value.repeatedMistakes, 2); assert.equal(value.hintsUsed, level === 5 ? 3 : 2);
        await new Promise(resolve => setTimeout(resolve, 5));
      } else {
        const tasks = prepare(game, level);
        if (game === 'sequence_memory') {
          while (byId('activity-next-preview')) press(byId('activity-next-preview'));
        }
        press(byId('activity-start'));
        // Recall previews are not mounted after Start, so neither sight nor screen readers receive the answers.
        if (game === 'sequence_memory' || game === 'picture_recall') assert.ok(!nodes(tree).some(node => node.type?.name === 'PictureRow'));
        const wrong = tasks[0].choices.find(choice => choice !== tasks[0].answer);
        press(byId('choice-' + wrong)); assert.ok(text().includes(t(language, 'coachWrong')));
        press(byId('choice-' + wrong)); assert.ok(text().includes(t(language, 'coachTogether')));
        if (level === 5) {
          press(byId('activity-hint'));
          if (game === 'sequence_memory' || game === 'picture_recall' || game === 'familiar_object') {
            assert.ok(nodes(tree).some(node => node.type?.name === 'PictureRow'), 'second hint shows the game-specific picture support');
          }
        }
        press(byId('choice-' + wrong)); assert.equal(byId('choice-' + wrong).props.disabled, true);
        for (const task of tasks) {
          const answer = byId('choice-' + task.answer); press(answer);
          answer.props.onPress(); tree = render(); // stale callback / rapid duplicate.
          assert.ok(text().includes(t(language, 'coachCorrect')));
          render.advance(); tree = render();
        }
        const pending = r.cognitive.getState().pending;
        assert.equal(pending.telemetry.attempts, tasks.length + 3); assert.equal(pending.telemetry.hintsUsed, level === 5 ? 3 : 2);
        assert.equal(pending.telemetry.correctSelections, tasks.length);
        // Start/answer/finish handlers from the old mounted screen cannot restore a cleared session.
        r.session.usePatientSessionStore.setState(s => ({ revision: s.revision + 2 }));
        r.cognitive.getState().clear();
        render.advance(); tree = render();
        assert.equal(r.cognitive.getState().pending, null);
      }
      assert.deepEqual(navigation, ['/patient/games/result']);
    } finally { r.sqlite.close(); }
  }
  console.log('PASS cognitive AI: actual six screen flows × seven languages × levels 1/5; preview hiding; persistent wrong/hint/reveal/correct feedback; explicit continuation; rapid taps; telemetry and stale handlers (native boundaries stubbed)');
}

function catalogChecks() {
  const { cognitiveAIStrings } = load('src/i18n/cognitive-ai-strings.ts');
  const slots = value => [...value.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort();
  for (const [language, catalog] of Object.entries(cognitiveAIStrings)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(cognitiveAIStrings.en).sort());
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim()); assert.deepEqual(slots(value), slots(cognitiveAIStrings.en[key]));
      assert.equal(strings[language][key], value);
      if (language !== 'en') assert.notEqual(value, cognitiveAIStrings.en[key], 'no English placeholder fallback');
    }
  }
  for (const file of ['src/ai/cognitive-coach.ts', 'src/games/recall-activities.ts', 'components/games/selection-activity-screen.tsx', 'app/patient/games/memory-match.tsx']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /\b(fetch|axios|OpenAI|Gemini|Anthropic|apiKey|setInterval)\b/);
    assert.doesNotMatch(source, /dementia score|disease severity|cognitive decline|too slow|you failed/i);
  }
  console.log('PASS cognitive AI: seven fully wired catalogs, non-English values, placeholder parity, no provider SDK/network/clinical output');
}

async function main() { gameChecks(); await persistenceChecks(); await screenChecks(); catalogChecks(); }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
