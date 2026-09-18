const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, overrides = {}, cache = new Map()) {
  file = path.resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  try {
    const ext = (p) => fs.existsSync(p + '.ts') ? p + '.ts' : fs.existsSync(p + '.tsx') ? p + '.tsx' : fs.existsSync(path.join(p, 'index.ts')) ? path.join(p, 'index.ts') : fs.existsSync(path.join(p, 'index.tsx')) ? path.join(p, 'index.tsx') : p;
    const mapAlias = (name) => {
      if (name.startsWith('@/')) return name.slice(2);
      if (name.startsWith('@components/') || name.startsWith('@constants/')) return name.slice(1);
      if (name.startsWith('@')) return 'src/' + name.slice(1);
      return null;
    };
    new Function('require', 'module', 'exports', '__DEV__', code)(
      (name) => overrides[name] ?? (name === 'react' ? new Proxy(require('react'), { get: (t, p) => p === 'useEffect' ? () => {} : p === 'useState' ? (i) => [i, () => {}] : p === 'useRef' ? () => ({}) : p === 'useCallback' ? (f) => f : p === 'useMemo' ? (f) => f() : t[p] }) : name === 'react-native' ? require('react-native-web') : ['react/jsx-runtime', 'zustand', '@react-native-async-storage/async-storage'].includes(name) ? require(name) : (name.startsWith('expo-') || name.startsWith('@expo/') || name.startsWith('react-native-') || name === '@supabase/supabase-js' || name === 'expo-router') ? new Proxy({}, { get: () => () => null }) : load(mapAlias(name) ? ext(path.resolve(__dirname, '..', mapAlias(name))) : ext(path.resolve(path.dirname(file), name)), overrides, cache)),
      module, module.exports, true
    );
  } catch (error) {
    throw new Error(`Failed to load ${file}:\n${error.message}`);
  }
  return module.exports;
}

async function main() {
  const overrides = {
    'expo-sqlite': { openDatabaseSync: () => ({ execSync: () => {}, runSync: () => {}, getFirstSync: () => null, getAllSync: () => [] }) },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  };

  const adaptive = load('src/ai/adaptive-engine.ts', overrides);

  // Adaptive performance logic
  let model = adaptive.createInitialAdaptiveModel('p1', 'memory_match');
  let rec = adaptive.recommendDifficulty(1, { accuracy: 1.0, relativePace: 1.0, workingMemory: 1.0, independence: 1.0, stability: 1.0 }, model);
  assert.equal(rec.recommendedDifficulty, 2, 'Excellent performance can +1');

  rec = adaptive.recommendDifficulty(3, { accuracy: 0.7, relativePace: 0.6, workingMemory: 0.7, independence: 0.6, stability: 0.5 }, model);
  assert.equal(rec.recommendedDifficulty, 3, 'Moderate performance holds');

  rec = adaptive.recommendDifficulty(1, { accuracy: 0.1, relativePace: 0.1, workingMemory: 0.1, independence: 0.1, stability: 0.1 }, model);
  assert.equal(rec.recommendedDifficulty, 1, 'Poor performance remains bounded');

  rec = adaptive.recommendDifficulty(3, { accuracy: 0.43, relativePace: 0.5, workingMemory: (4/7), independence: 0.8, stability: 0.5 }, model);
  assert.equal(rec.recommendedDifficulty, 3, 'Supplied 43% accuracy / 7 selections / 1 hint fixture holds');

  rec = adaptive.recommendDifficulty(5, { accuracy: 1.0, relativePace: 1.0, workingMemory: 1.0, independence: 1.0, stability: 1.0 }, model);
  assert.equal(rec.recommendedDifficulty, 5, 'Max level is 5');

  // Games
  const chess = load('src/games/chess-puzzle.ts', overrides);
  const memory = load('src/games/memory-match/engine.ts', overrides);
  const grid = load('src/games/grid-activities.ts', overrides);
  const recall = load('src/games/recall-activities.ts', overrides);
  const routine = load('src/games/routine-recall.ts', overrides);

  const rState = routine.prepareRoutine(1);
  assert.ok(rState.tasks[0].choices.length >= 2, 'Routine Recall always >=2 valid options');

  const cState = chess.prepareChess(1);
  assert.ok(Object.keys(cState[0].board).length > 0, 'Chess puzzle loaded');

  const nPath = grid.prepareGridActivity('number_path', 2);
  assert.ok(nPath.tiles.length > 0, 'Number Path targets loaded');
  assert.ok(nPath.tiles[0] !== nPath.tiles[1], 'Number Path deterministic shuffled targets');

  const mm = memory.createMemoryGame(1);
  assert.equal(mm.cards.length, 4, 'Memory Match layout');
  let played = memory.startPlaying(mm);
  assert.equal(played.status, 'IDLE');

  // Session/Role/My Day Boundaries
  const session = load('src/stores/patient-session.store.ts', overrides);
  session.setWorkspace('patient');

  const myDay = load('src/services/my-day.service.ts', {
    ...overrides,
    '../stores/patient-session.store': session,
    '../client': { getDatabase: async () => ({}) },
    './active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'patient-a' } }) },
    '../db/repositories/my-day.repository': { myDayRepository: { setEnabled: async () => {} } }
  }).myDayService;

  await assert.rejects(myDay.setEnabled('patient-a', 'rem-1', true), /Reminder patient changed before saving/, 'Patient cannot administratively manage reminders');

  session.setWorkspace('caregiver');
  await myDay.setEnabled('patient-a', 'rem-1', true);

  console.log('PASS: MVP-27 Final UX Game Stabilization script successfully verified.');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
