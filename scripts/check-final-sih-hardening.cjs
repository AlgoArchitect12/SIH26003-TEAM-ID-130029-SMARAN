const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const tick = () => new Promise(setImmediate);
const { t, strings } = load('src/i18n/index.ts');
const { withTimeout } = load('src/utils/with-timeout.ts');

async function loading() {
  assert.equal(await withTimeout(Promise.resolve(3), 20), 3);
  await assert.rejects(withTimeout(Promise.reject(Error('read failed')), 20), /read failed/);
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /too long/);
  const state = { revision: 0, switching: false };
  const session = { usePatientSessionStore: fn => fn(state), capturePatientRequest: () => {
    const revision = state.revision, switching = state.switching;
    return () => !switching && !state.switching && revision === state.revision;
  } };
  const settings = { language: 'en', region: 'assam', textSize: 'standard' };
  const patient = { status: 'ready', profile: { id: 'one', preferredName: 'Fixture' }, settings };
  const store = { language: 'en', setLanguage() {}, setRegion() {}, setAccessibilityPreferences() {} };
  const useOnboardingStore = Object.assign(fn => fn(store), { getState: () => store });
  const router = { replace() {} };
  for (const file of ['components/my-home/shared.tsx', 'components/my-day/shared.tsx']) {
    let release, failed = false;
    const render = screen(file, {
      '@/src/stores/patient-session.store': session,
      '@/src/stores/onboarding.store': { useOnboardingStore },
      '@services/active-patient.service': { PatientSelectionRequiredError: class extends Error {},
        resolveActivePatient: () => failed ? Promise.reject(Error('read failed')) : new Promise(resolve => { release = resolve; }) },
      'expo-router': { useRouter: () => router }, 'expo-linking': {}, 'expo-image': {},
      '@/hooks/use-theme-color': {}, '@/src/my-home/content': { isRegionalState: value => value === 'assam' },
      '@/src/my-day/presets': { category: {} },
    });
    render(); state.revision++; release(patient); await tick(); render();
    release(patient); await tick();
    assert.ok(render().status === 'ready' || render().patientId === 'one', 'workspace invalidation must restart loading');
    state.revision++; state.switching = true; render();
    state.switching = false; render(); release(patient); await tick();
    assert.ok(render().status === 'ready' || render().patientId === 'one', 'switch completion must restart loading');
    failed = true; render().retry(); render(); await tick();
    assert.ok(render().status === 'failed' || render().failed, 'read errors must be visible');
    failed = false; render().retry(); render(); release(patient); await tick();
    assert.ok(render().status === 'ready' || render().patientId === 'one');
    render.unmount();
  }
  let patientId = 'one', failed = false;
  const memories = screen('app/patient/my-memories.tsx', {
    '@components/my-day/shared': { useMyDayPatient: () => ({ patientId, language: 'en', retry() {} }) },
    '@components/memories/memory-photo': { MemoryPhoto: 'MemoryPhoto', memoryStyles: {} },
    '@db/repositories/memories.repository': { memoriesRepository: { list: async () => {
      if (failed) throw Error('read failed');
      return patientId === 'one' ? [{ id: 'm1', patientId, name: 'Fixture memory' }] : [];
    } } },
  });
  memories(); await tick(); assert.ok(nodes(memories()).some(n => n.props?.children === 'Fixture memory'));
  patientId = 'two'; memories(); await tick();
  assert.ok(!nodes(memories()).some(n => n.props?.children === 'Fixture memory'));
  assert.ok(nodes(memories()).some(n => n.props?.children === t('en', 'memoryEmpty')));
  failed = true; patientId = 'three'; memories(); await tick();
  assert.ok(nodes(memories()).some(n => n.props?.children === t('en', 'memoryFailed')));
  failed = false;
  nodes(memories()).find(n => n.props?.label === t('en', 'retry')).props.onPress(); memories(); await tick();
  assert.ok(nodes(memories()).some(n => n.props?.children === t('en', 'memoryEmpty')));
  memories.unmount();
}

function routineAndReports() {
  const { prepareRoutine, routineStepText } = load('src/games/routine-recall.ts');
  const engine = load('src/games/selection-engine.ts');
  for (const language of Object.keys(strings)) for (const level of [1, 2, 3, 4, 5]) {
    const { tasks } = prepareRoutine(level, language);
    let state = engine.createSelection(tasks, 0);
    for (const task of tasks) {
      for (const choice of task.choices) assert.ok(routineStepText(choice, language).trim(), `${language}/${level}/${choice}`);
      state = engine.chooseSelection(state, tasks, task.choices.find(c => c !== task.answer), state.lastDecisionAtMs + 1000);
      assert.equal(state.feedback, 'retry');
      state = engine.chooseSelection(state, tasks, task.answer, state.lastDecisionAtMs + 1000);
      state = engine.continueSelection(state, state.lastDecisionAtMs + 1000);
    }
    const result = engine.finalizeSelection(state, 'routine_recall');
    assert.equal(result.accuracy, .5); assert.equal(result.correctSelections, tasks.length);
  }
  const { CognitiveActivityTypes } = load('src/db/schema.types.ts');
  const { reportSections } = load('src/caregiver/report-presentation.ts');
  const { activityTitleKeys } = load('src/games/presentation.ts');
  const facts = { patientName: 'Fixture', days: 7, timezone: 'UTC',
    games: CognitiveActivityTypes.map((gameType, i) => ({ gameType, sessions: 1, attempts: i + 2, correct: i + 1, hints: i, repeatedErrors: 0 })),
    routine: { completed: 0, hydration: 0, activity: 0, appointment: 0, unknownCategory: 0, scheduledToday: 0, completedToday: 0 },
    memories: { stored: 0, added: 0 } };
  const report = { snapshot: JSON.stringify(facts), period_start: '2026-09-01T00:00:00Z', period_end: '2026-09-08T00:00:00Z', generated_at: '2026-09-08T00:00:00Z' };
  const lines = reportSections(report, 'en')[1].lines;
  for (const game of facts.games) {
    const index = lines.indexOf(t('en', activityTitleKeys[game.gameType]));
    assert.equal(lines[index + 1], t('en', game.gameType === 'memory_match' ? 'analyticsMemoryAttempts' : 'analyticsSelectionAttempts'));
    assert.ok(lines[index + 3].includes(String(game.attempts)), 'activity totals retain their own source');
  }
}

async function results() {
  for (const gameType of ['sequence_memory', 'chess_puzzle', 'word_match']) {
    let saves = 0, fail = false;
    const routes = [], settings = { language: 'en', textSize: 'standard' };
    const session = { patientId: 'one', gameType, difficulty: 1, recommendedDifficulty: 2, attempts: 4, correctSelections: 3, stepsCompleted: 3, accuracy: .75, hintsUsed: 1 };
    const recommendation = { recommendedDifficulty: 2, direction: 'challenge' };
    const value = { pending: { patientId: 'one', telemetry: session, initialRecommendation: recommendation }, saved: null,
      setSaved: saved => { value.saved = saved; value.pending = null; }, clear: () => {} };
    const useCognitiveSessionStore = Object.assign(fn => fn(value), { getState: () => value });
    const store = { language: 'en', setLanguage() {}, setAccessibilityPreferences() {} };
    const render = screen('app/patient/games/result.tsx', {
      'expo-router': { useRouter: () => router },
      'react-native': { View: 'View', StyleSheet: { create: s => s }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      '@/src/stores/patient-session.store': { capturePatientRequest: () => () => true },
      '@/src/stores/cognitive-session.store': { useCognitiveSessionStore },
      '@/src/stores/onboarding.store': { useOnboardingStore: fn => fn(store) },
      '@/hooks/use-theme-color': { useThemeColors: () => ({}) }, '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
      '@/src/games/presentation': load('src/games/presentation.ts'),
      '@services/active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'one', preferredName: 'Fixture' }, settings }) },
      '@services/cognitive.service': { saveCognitiveResult: async () => { saves++; if (fail) throw Error('save failed'); return { session, recommendation }; } },
    });
    const router = { dismissTo: route => routes.push(route), replace: route => routes.push(route) };
    render(); await tick();
    fail = true;
    nodes(render()).find(n => n.props?.label === t('en', 'activitiesBack')).props.onPress(); await tick();
    assert.equal(routes.length, 0, 'failed save must keep the result available');
    fail = false;
    nodes(render()).find(n => n.props?.label === t('en', 'skip')).props.onPress(); await tick(); render(); await tick(); render();
    assert.equal(saves, 2); assert.equal(value.saved.session.gameType, gameType);
    render.advance(); await tick(); render.advance();
    assert.equal(routes.length, 0, 'saved results must not auto-navigate');
    const tree = nodes(render());
    assert.ok(tree.some(n => n.props?.children === t('en', 'activityAccuracy', { accuracy: '75%' })));
    tree.find(n => n.props?.label === t('en', 'continue')).props.onPress();
    assert.equal(routes[0].pathname, '/patient/games/' + gameType.replaceAll('_', '-'));
    render.unmount();
  }
}

async function delivery() {
  let handler;
  const source = fs.readFileSync('supabase/functions/report-delivery/index.ts', 'utf8').replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/, '');
  new Function('Deno', source)({ serve: fn => { handler = fn; } });
  const response = handler(new Request('https://example.invalid', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false, error: 'not_configured' });
  const saved = [], rows = [];
  const data = { current: () => true, patient: { id: 'one' }, settings: { language: 'en' }, reports: [], recipients: [],
    members: [{ id: 'member', display_name: 'Fixture recipient', phone: '+15551234567', status: 'local' }] };
  const render = screen('app/caregiver/reports.tsx', {
    '@/src/caregiver/care-circle': { CareScopes: ['reports'], effectiveScopes: () => ['reports'] },
    '@/src/caregiver/report-presentation': {}, '@/src/services/reports.service': {},
    '@/src/services/report-pdf.service': { cleanupReportPdfs() {}, ReportEmailUnavailable: class extends Error {}, ReportPdfUnavailable: class extends Error {} },
    '@/src/db/repositories/care-circle.repository': { careCircleRepository: {
      saveRecipient: async (...args) => { saved.push(args); rows[0] = { id: 'recipient', care_member_id: 'member', normalized_destination: args[2], frequency: args[3], consent_status: args[4] ? 'enabled' : 'revoked' }; },
      recipients: async () => [...rows],
    } },
  }, { data });
  const button = label => nodes(render()).find(n => n.props?.label === label);
  button('Fixture recipient · +15551234567').props.onPress();
  button(t('en', 'reportConsent')).props.onPress();
  button(t('en', 'circleSave')).props.onPress(); await tick();
  assert.equal(saved[0][6], undefined, 'first save creates a recipient');
  assert.ok(nodes(render()).some(n => n.props?.label?.includes('(weekly, enabled)')));
  button(t('en', 'reportConsent')).props.onPress();
  button(t('en', 'circleSave')).props.onPress(); await tick();
  assert.equal(saved[1][6], 'recipient', 'editing reuses the saved recipient instead of inserting a duplicate');
  assert.equal(saved[1][4], false, 'consent can be revoked');
  render.unmount();
}

async function resultNavigation() {
  for (const scenario of ['newer', 'unmount', 'back']) {
    let finish, guard, failed = true, saves = 0;
    const routes = [], settings = { language: 'en', textSize: 'standard' };
    const session = { patientId: 'one', gameType: 'pattern_recognition', startedAtMs: 1, completedAtMs: 2, challengesCompleted: 5,
      attempts: 6, correctSelections: 5, accuracy: 5 / 6, hintsUsed: 1 };
    const recommendation = { recommendedDifficulty: 2, direction: 'challenge' };
    const pending = { patientId: 'one', telemetry: session, initialRecommendation: recommendation };
    const value = { pending, saved: null, clear() {}, setSaved: saved => { value.saved = saved; value.pending = null; } };
    const useCognitiveSessionStore = Object.assign(fn => fn(value), { getState: () => value });
    const store = { language: 'en', setLanguage() {}, setAccessibilityPreferences() {} };
    const router = { dismissTo: route => routes.push(route), replace: route => routes.push(route) };
    const render = screen('app/patient/games/result.tsx', {
      'expo-router': { useRouter: () => router },
      '@react-navigation/native': { useIsFocused: () => true, useNavigation: () => ({ dispatch: action => routes.push(action) }),
        usePreventRemove: (enabled, callback) => { guard = { enabled, callback }; } },
      'react-native': { View: 'View', StyleSheet: { create: s => s }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      '@/src/stores/patient-session.store': { capturePatientRequest: () => () => true },
      '@/src/stores/cognitive-session.store': { useCognitiveSessionStore },
      '@/src/stores/onboarding.store': { useOnboardingStore: fn => fn(store) },
      '@/hooks/use-theme-color': { useThemeColors: () => ({}) }, '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
      '@/src/games/presentation': load('src/games/presentation.ts'),
      '@services/active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: 'one', preferredName: 'Fixture' }, settings }) },
      '@services/cognitive.service': { saveCognitiveResult: () => { saves++; return new Promise((resolve, reject) => {
        finish = () => failed ? reject(Error('save failed')) : resolve({ session, recommendation });
      }); } },
    });
    render(); await tick(); render();
    if (scenario === 'back') {
      assert.equal(guard?.enabled, true, 'OS Back/gesture removal must guard an unsaved result');
      const action = { type: 'GO_BACK' };
      guard.callback({ data: { action } });
      guard.callback({ data: { action } });
      assert.equal(saves, 1, 'repeated Back cannot start duplicate saves');
      finish(); await tick(); render();
      assert.equal(routes.length, 0, 'save failure must prevent OS Back');
      assert.equal(value.pending, pending);
      failed = false; guard.callback({ data: { action } }); finish(); await tick(); render();
      assert.equal(value.saved.session.gameType, 'pattern_recognition');
      assert.deepEqual(routes, [action], 'successful save resumes the original action once');
      assert.equal(guard.enabled, false);
    } else {
      failed = false;
      nodes(render()).find(n => n.props?.label === t('en', 'skip')).props.onPress();
      const newer = { ...pending, telemetry: { ...session, startedAtMs: 10, completedAtMs: 20 } };
      if (scenario === 'newer') value.pending = newer;
      else render.unmount();
      finish(); await tick();
      assert.equal(value.saved, null, 'late completion cannot publish after replacement or unmount');
      assert.equal(value.pending, scenario === 'newer' ? newer : pending);
      assert.equal(routes.length, 0);
    }
    render.unmount();
  }
}

async function main() {
  await loading(); routineAndReports(); await results(); await delivery(); await resultNavigation();
  console.log('PASS: bounded loads, stale workspace and switch recovery, Memories empty/error/retry, all localized routine choices/scoring, activity report mapping, persistent saved results and fail-closed delivery.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
