const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const hook = store => Object.assign(selector => selector ? selector(store.getState()) : store.getState(), { getState: store.getState });

async function main() {
  fs.mkdirSync(path.join(__dirname, '../.expo'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(__dirname, '../.expo/profile-check-'));
  const filename = path.join(directory, 'synthetic.db');
  let sql = new DatabaseSync(filename);
  const fault = { read: '', write: '', sql: false, available: true, stop: false, afterCommit: false };
  let failNextRead = false, pauseRead = null;
  const db = {
    execAsync: async statement => sql.exec(statement),
    getFirstAsync: async (statement, ...args) => {
      if (failNextRead) { failNextRead = false; throw Error('Injected post-commit read failure'); }
      return sql.prepare(statement).get(...args) ?? null;
    },
    getAllAsync: async (statement, ...args) => {
      const result = sql.prepare(statement).all(...args);
      if (pauseRead) { const paused = pauseRead; pauseRead = null; await paused.promise; }
      return result;
    },
    runAsync: async (statement, ...args) => {
      if (fault.sql && statement.includes('INSERT INTO patient_settings')) throw Error('Injected settings write failure');
      return sql.prepare(statement).run(...args);
    },
    withExclusiveTransactionAsync: async work => {
      sql.exec('BEGIN IMMEDIATE');
      try { await work(db); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
      if (fault.afterCommit) { fault.afterCommit = false; failNextRead = true; }
    },
  };
  const values = new Map();
  let stops = 0, voiceLookup = null;
  const spoken = [];
  const overrides = {
    '../client': { getDatabase: async () => db },
    'expo-secure-store': {
      isAvailableAsync: async () => fault.available,
      getItemAsync: async key => { if (key === fault.read) throw Error('Injected secure read failure'); return values.get(key) ?? null; },
      setItemAsync: async (key, value) => { if (key === fault.write) throw Error('Injected secure write failure'); values.set(key, value); },
      deleteItemAsync: async key => { if (key === fault.write) throw Error('Injected secure delete failure'); values.delete(key); },
    },
    'expo-speech': {
      maxSpeechInputLength: 10000,
      stop: async () => { stops++; if (fault.stop) throw Error('Injected speech stop failure'); },
      speak: text => spoken.push(text),
      getAvailableVoicesAsync: async () => voiceLookup ? voiceLookup.promise : [{ identifier: 'test', language: 'en-IN' }],
    },
    '@/src/utils/validation': load('src/utils/validation.ts'),
  };
  const cache = new Map();
  const module = file => load(file, overrides, cache);
  const patient = module('src/db/repositories/patient.repository.ts').patientRepository;
  overrides['@db/repositories/patient.repository'] = { patientRepository: patient };
  const secure = module('src/services/secure-storage.service.ts');
  const keys = secure.SecureStorageKeys;
  const details = module('src/services/profile-details.service.ts');
  const session = module('src/stores/patient-session.store.ts');
  const onboarding = module('src/stores/onboarding.store.ts').useOnboardingStore;
  const cognitiveStore = module('src/stores/cognitive-session.store.ts').useCognitiveSessionStore;
  const switching = module('src/services/profile-switching.service.ts');
  const resolver = module('src/services/active-patient.service.ts');
  const speech = module('src/services/speech.service.ts');
  const reminders = module('src/db/repositories/my-day.repository.ts').myDayRepository;
  const memories = module('src/db/repositories/memories.repository.ts').memoriesRepository;
  const cognitive = module('src/db/repositories/cognitive.repository.ts').cognitiveRepository;
  const analytics = module('src/services/analytics.service.ts');
  const caregiver = module('src/services/caregiver.service.ts');
  const { createInitialAdaptiveModel } = module('src/ai/adaptive-engine.ts');
  const { t } = module('src/i18n/index.ts');
  const count = () => sql.prepare('SELECT count(*) AS n FROM patient_profiles').get().n;
  const snapshot = () => JSON.stringify(sql.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, sql.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  const draft = { preferredName: 'Synthetic B', dateOfBirth: '29/02/1960', emergencyName: '', emergencyPhone: '' };
  const preferences = { language: 'hi', region: 'manipur', textSize: 'extra-large', highContrast: true, reducedMotion: true, voiceGuidance: false };
  let a, b;
  try {
    await module('src/db/migrations/index.ts').runMigrations(db);
    assert.equal((await resolver.resolveActivePatient()).status, 'fresh');
    await assert.rejects(switching.beginAddPerson(), /first-time/);
    values.set(keys.onboardingCompleted, 'true');
    await assert.rejects(switching.listLocalPatients());
    await assert.rejects(resolver.resolveActivePatient());
    values.clear();
    a = (await patient.upsertProfileWithSettings({ preferredName: 'Synthetic A' }, { language: 'en', region: 'assam' })).profile.id;
    await details.saveDateOfBirth(a, '1948-03-02');
    assert.equal((await resolver.resolveActivePatient()).profile.id, a, 'sole-profile recovery');
    await switching.selectActivePatient(a);
    const before = snapshot();
    await assert.rejects(patient.upsertProfileWithSettings({ preferredName: 'Accidental duplicate' }), /already exists/);
    assert.equal(snapshot(), before);
    for (const read of [keys.activeProfileId, keys.onboardingCompleted, keys.pendingPersonId]) {
      fault.read = read;
      await assert.rejects(switching.beginAddPerson());
      assert.equal(count(), 1); assert.equal(values.get(keys.activeProfileId), a);
    }
    fault.read = ''; fault.write = keys.pendingPersonId;
    await assert.rejects(switching.beginAddPerson());
    assert.equal(values.has(keys.pendingPersonId), false);
    fault.write = '';
    const newProfileId = patient.newProfileId;
    patient.newProfileId = async () => a;
    await assert.rejects(switching.beginAddPerson(), /reserve/);
    values.set('smaran.dob.orphan-fixture', '1950-01-01');
    patient.newProfileId = async () => 'orphan-fixture';
    await assert.rejects(switching.beginAddPerson(), /reserve/);
    assert.equal(values.has(keys.pendingPersonId), false); assert.equal(snapshot(), before);
    patient.newProfileId = newProfileId;
    const [reservation, same] = await Promise.all([switching.beginAddPerson(), switching.beginAddPerson()]);
    assert.equal(reservation.id, same.id); b = reservation.id;
    const dobKey = `smaran.dob.${b}`;
    fault.write = dobKey;
    await assert.rejects(switching.saveAdditionalPerson(b, draft, preferences));
    assert.equal(snapshot(), before); assert.equal(values.has(dobKey), false);
    fault.write = ''; fault.sql = true;
    await assert.rejects(switching.saveAdditionalPerson(b, draft, preferences));
    assert.equal(snapshot(), before); assert.equal(values.get(dobKey), '1960-02-29');
    assert.deepEqual((await switching.listLocalPatients()).profiles.map(p => p.id), [a]);
    assert.equal(values.get(keys.activeProfileId), a);
    fault.sql = false;
    // Lose the form and service instance after the SQLite rollback. No staged DOB is loaded into a new draft.
    const reopened = load('src/services/profile-switching.service.ts', overrides);
    assert.deepEqual(await reopened.beginAddPerson(), { id: b, profile: null });
    await assert.rejects(reopened.saveAdditionalPerson(b, { ...draft, dateOfBirth: '' }, preferences));
    assert.equal(snapshot(), before);
    fault.afterCommit = true;
    const retryDraft = { ...draft, preferredName: 'Synthetic B retry', dateOfBirth: '10/11/1972' };
    await assert.rejects(switching.saveAdditionalPerson(b, retryDraft, preferences));
    assert.equal(count(), 2); assert.equal(await details.getDateOfBirth(b), '1972-11-10');
    assert.equal((await switching.beginAddPerson()).profile.preferredName, retryDraft.preferredName);
    await switching.saveAdditionalPerson(b, { ...draft, preferredName: 'Must not overwrite' }, preferences);
    assert.equal((await patient.getProfileById(b)).preferredName, retryDraft.preferredName);
    assert.equal(await details.getDateOfBirth(a), '1948-03-02');
    assert.equal(values.get(keys.activeProfileId), a);
    values.delete(keys.activeProfileId);
    await assert.rejects(resolver.resolveActivePatient(), resolver.PatientSelectionRequiredError);
    assert.equal((await switching.listLocalPatients()).activeId, null);
    for (const active of ['dangling', '', ' invalid ']) {
      values.set(keys.activeProfileId, active);
      await assert.rejects(resolver.resolveActivePatient(), resolver.PatientSelectionRequiredError);
      assert.equal(values.get(keys.activeProfileId), active);
    }
    values.set(keys.activeProfileId, a);
    values.set(keys.onboardingCompleted, 'corrupt');
    await assert.rejects(switching.listLocalPatients()); await assert.rejects(resolver.resolveActivePatient());
    values.set(keys.onboardingCompleted, 'true');
    const both = snapshot();
    for (const key of [keys.activeProfileId, keys.onboardingCompleted, keys.pendingPersonId, dobKey]) {
      fault.read = key;
      await assert.rejects(switching.selectActivePatient(b));
      assert.equal(values.get(keys.activeProfileId), a); assert.equal(snapshot(), both);
      assert.equal(session.usePatientSessionStore.getState().switching, false);
    }
    fault.read = '';
    for (const key of [keys.pendingPersonId, keys.onboardingCompleted, keys.activeProfileId]) {
      fault.write = key;
      await assert.rejects(switching.selectActivePatient(b));
      assert.equal(values.get(keys.activeProfileId), a); assert.equal(snapshot(), both);
    }
    fault.write = ''; fault.available = false;
    await assert.rejects(resolver.resolveActivePatient(), secure.SecureStorageUnavailableError);
    await assert.rejects(switching.selectActivePatient(b), secure.SecureStorageUnavailableError);
    fault.available = true; fault.stop = true;
    await assert.rejects(switching.selectActivePatient(b), /reading/);
    assert.equal(values.get(keys.activeProfileId), a);
    assert.equal(session.usePatientSessionStore.getState().switching, false);
    fault.stop = false;
    values.set(dobKey, 'bad'); await assert.rejects(switching.selectActivePatient(b)); values.set(dobKey, '1972-11-10');
    const getSettings = patient.getSettings;
    patient.getSettings = async id => id === b ? null : getSettings(id);
    await assert.rejects(switching.selectActivePatient(b)); patient.getSettings = getSettings;
    assert.equal(values.get(keys.activeProfileId), a);
    // Populate every patient-owned subsystem using real repositories.
    const fixtures = {};
    for (const id of [a, b]) {
      const memory = await memories.save(id, { name: `Memory ${id}`, relationship: '', description: '' }, null);
      const reminder = await reminders.save(id, { title: `Reminder ${id}`, note: '', type: 'custom', timeOfDay: '23:59', repeatRule: 'daily', scheduledDate: null });
      const model = { ...createInitialAdaptiveModel(id, 'memory_match'), sampleCount: id === a ? 3 : 8 };
      const completed = await cognitive.saveCompletedSession({ patientId: id, gameType: 'memory_match', totalPairs: 2, matches: 2,
        repeatedMistakes: 0, difficulty: 1, startedAt: new Date(Date.now() - 10000).toISOString(), completedAt: new Date().toISOString(),
        attempts: 3, hintsUsed: 0, averageResponseMs: 1000, accuracy: 2 / 3, feedbackLabel: null, recommendedDifficulty: 2 }, model);
      fixtures[id] = { memory, reminder, model, completed };
    }
    const populated = snapshot();
    voiceLookup = deferred();
    const oldSpeech = speech.speakScreenText('Synthetic A private text', 'en'); await tick();
    const oldRequest = session.capturePatientRequest();
    cognitiveStore.setState({ pending: { patientId: a }, saved: { session: { patientId: a } } });
    onboarding.getState().setProfileDraft({ preferredName: 'Old draft', dateOfBirth: '01/01/1950' });
    const firstSwitch = switching.selectActivePatient(b);
    await assert.rejects(switching.selectActivePatient(a), /already in progress/);
    const duringSwitch = session.capturePatientRequest();
    await firstSwitch;
    voiceLookup.resolve([{ identifier: 'test', language: 'en-IN' }]); await oldSpeech; voiceLookup = null;
    assert.deepEqual(spoken, []); assert.ok(stops > 0);
    assert.equal(oldRequest(), false); assert.equal(duringSwitch(), false);
    assert.equal(cognitiveStore.getState().pending, null); assert.equal(cognitiveStore.getState().saved, null);
    assert.equal(onboarding.getState().profile.preferredName, '');
    for (const id of [b, a, b, a]) {
      await switching.selectActivePatient(id);
      const resolved = await resolver.resolveActivePatient();
      assert.equal(resolved.profile.id, id);
      assert.equal(onboarding.getState().language, id === a ? 'en' : 'hi');
      assert.equal(onboarding.getState().region, id === a ? 'assam' : 'manipur');
      assert.equal(onboarding.getState().accessibility.voiceGuidance, id === a);
      assert.equal(onboarding.getState().accessibility.highContrast, id === b);
      assert.equal(onboarding.getState().accessibility.reducedMotion, id === b);
      assert.equal(onboarding.getState().accessibility.textSize, id === a ? 'large' : 'extra-large');
      assert.equal((await reminders.list(id))[0].id, fixtures[id].reminder.id);
      assert.equal((await memories.list(id))[0].id, fixtures[id].memory.id);
      assert.equal((await cognitive.getRecentSessions(id))[0].id, fixtures[id].completed.id);
      assert.equal((await cognitive.getAdaptiveModel(id, 'memory_match')).sampleCount, fixtures[id].model.sampleCount);
      const care = await caregiver.loadCaregiverDashboard(id);
      assert.equal(care.patient.id, id); assert.equal(care.memories.recent[0].id, fixtures[id].memory.id);
      const stats = await analytics.loadActiveAnalytics(7);
      assert.equal(stats.patient.id, id); assert.equal(stats.history.sessions[0].id, fixtures[id].completed.id);
      assert.equal(await details.getDateOfBirth(id), id === a ? '1948-03-02' : '1972-11-10');
      assert.equal(snapshot(), populated, 'Switching never mutates patient data');
    }
    const held = deferred(); pauseRead = held;
    const staleAnalytics = analytics.loadActiveAnalytics(7); await tick();
    await switching.selectActivePatient(b); await switching.selectActivePatient(a); held.resolve();
    await assert.rejects(staleAnalytics, analytics.AnalyticsPatientChanged, 'A-B-A still invalidates earlier analytics');
    sql.close(); sql = new DatabaseSync(filename); sql.exec('PRAGMA foreign_keys=ON');
    assert.equal(snapshot(), populated, 'Both profiles survive database close/reopen');
    assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(), []);

    const routes = [];
    const router = { replace: value => routes.push(value), push: value => routes.push(value), dismissTo: value => routes.push(value) };
    const navigation = { getState: () => ({ routes: [{ name: 'profiles' }] }), dispatch: action => routes.push(action) };
    const common = {
      'expo-router': { useRouter: () => router, useNavigation: () => navigation, useLocalSearchParams: () => ({}) },
      '@react-navigation/native': { CommonActions: require('@react-navigation/routers').CommonActions, useIsFocused: () => true },
      '@/src/stores/patient-session.store': session,
      '@/src/stores/onboarding.store': { useOnboardingStore: hook(onboarding) },
      '@/src/stores/cognitive-session.store': { useCognitiveSessionStore: hook(cognitiveStore) },
      '@services/profile-switching.service': switching,
      '@services/active-patient.service': resolver,
      '@services/secure-storage.service': secure,
      '@db/schema.types': module('src/db/schema.types.ts'),
      '@/src/utils/date-of-birth': module('src/utils/date-of-birth.ts'),
      '@/src/utils/validation': overrides['@/src/utils/validation'],
      '@db/repositories/patient.repository': { patientRepository: patient },
    };
    const find = (render, label) => nodes(render()).find(node => node.type === 'SmaranButton' && node.props.label === label);
    for (const route of ['profiles', 'add-person']) {
      const direct = screen(`app/${route}.tsx`, { ...common,
        'expo-router': { ...common['expo-router'], useNavigation: () => ({
          ...navigation, getState: () => ({ routes: [{ name: 'patient' }, { name: route }] }),
        }) },
      });
      direct();
      assert.equal(routes.at(-1).type, 'RESET');
      assert.deepEqual(routes.at(-1).payload.routes, [{ name: route, params: { view: undefined } }]);
    }
    // Execute the real launch and chooser: neither missing nor dangling selection gets an inferred patient.
    for (const id of [null, 'dangling']) {
      if (id === null) values.delete(keys.activeProfileId); else values.set(keys.activeProfileId, id);
      const launch = screen('app/index.tsx', common); launch(); await tick();
      assert.equal(routes.at(-1), '/profiles');
      const chooser = screen('app/profiles.tsx', common); chooser(); await tick();
      assert.ok(find(chooser, t('en', 'continue')).props.disabled);
      const choice = nodes(chooser()).find(node => node.type === 'SelectionCard' && node.props.title === 'Synthetic A');
      choice.props.onPress(); find(chooser, t('en', 'continuePerson', { name: 'Synthetic A' })).props.onPress(); await tick();
      assert.equal(routes.at(-1).type, 'RESET'); assert.deepEqual(routes.at(-1).payload.routes, [{ name: 'patient' }]);
    }
    const savedSettings = await patient.getSettings(a), late = deferred();
    const settingsScreen = screen('app/patient/settings.tsx', { ...common,
      'expo-router': { useLocalSearchParams: () => ({ section: 'language' }) },
      '@components/my-day/shared': { useMyDayPatient: () => ({ patientId: a, language: 'en', failed: false, retry() {} }) },
      '@db/repositories/patient.repository': { patientRepository: { updateSettings: async () => late.promise } },
    });
    nodes(settingsScreen()).find(node => node.type === 'SelectionCard').props.onPress();
    await switching.selectActivePatient(b); late.resolve(savedSettings); await tick();
    assert.equal(onboarding.getState().language, 'hi', 'A late settings completion cannot overwrite B');

    await switching.selectActivePatient(a);
    const lateResult = deferred();
    const recommendation = { recommendedDifficulty: 2, direction: 'hold' };
    cognitiveStore.setState({ pending: { patientId: a, telemetry: fixtures[a].completed, initialRecommendation: recommendation }, saved: null });
    const resultScreen = screen('app/patient/games/result.tsx', { ...common,
      '@/hooks/use-theme-color': { useThemeColors: () => ({}) }, '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
      '@/src/games/presentation': module('src/games/presentation.ts'),
      '@services/cognitive.service': { saveCognitiveResult: async () => lateResult.promise },
    });
    resultScreen(); await tick(); find(resultScreen, t('en', 'skip')).props.onPress();
    await switching.selectActivePatient(b);
    lateResult.resolve({ session: fixtures[a].completed, feedback: null, recommendation }); await tick();
    assert.equal(cognitiveStore.getState().saved, null, 'A late cognitive save cannot refill B session state');
    assert.equal(cognitiveStore.getState().pending, null);

    // Actual Add Person route: own blank draft, explicit choices, save once, return without switching.
    const add = screen('app/add-person.tsx', common); add(); await tick();
    assert.ok(find(add, t('en', 'continue')).props.disabled);
    nodes(add()).find(node => node.type === 'SelectionCard' && node.props.title === 'English').props.onPress();
    find(add, t('en', 'continue')).props.onPress();
    const fields = nodes(add()).filter(node => node.type === 'Field'); assert.ok(fields.every(node => node.props.value === ''));
    fields[0].props.onChangeText('Synthetic C');
    nodes(add()).find(node => node.type === 'DateOfBirthField').props.onChange('12/06/1965');
    find(add, t('en', 'continue')).props.onPress();
    nodes(add()).find(node => node.type === 'SelectionCard').props.onPress();
    find(add, t('en', 'continue')).props.onPress();
    fault.sql = true;
    find(add, t('en', 'saveFinish')).props.onPress(); await tick();
    assert.equal(count(), 2); assert.ok(nodes(add()).some(node => node.props?.accessibilityRole === 'alert'));
    assert.equal(values.get(keys.activeProfileId), b);
    fault.sql = false;
    find(add, t('en', 'saveFinish')).props.onPress(); find(add, t('en', 'saveFinish')).props.onPress(); await tick();
    assert.equal(count(), 3); assert.equal(values.get(keys.activeProfileId), b);
    assert.ok(find(add, t('en', 'continuePerson', { name: 'Synthetic C' })));
    find(add, t('en', 'personList')).props.onPress(); await tick();
    assert.equal(values.get(keys.activeProfileId), b); assert.equal(values.has(keys.pendingPersonId), false);
    await switching.selectActivePatient(a);
    const currentPerson = screen('components/patient/current-person.tsx', common, { name: 'Synthetic A', language: 'en', caregiver: true });
    find(currentPerson, t('en', 'switchPerson')).props.onPress();
    assert.deepEqual(routes.at(-1).payload.routes, [{ name: 'profiles', params: { view: 'caregiver' } }]);
    assert.equal(onboarding.getState().language, null);
    console.log('PASS profiles: actual SQLite and services; fresh/sole/multiple/dangling/failed recovery; duplicate guard; ID collision/orphan protection; reservation/DOB/SQL/post-commit/flag failures; A-B-A data/settings/model/analytics isolation; stale settings/cognitive/analytics/speech; database reopen; actual launch/chooser/Add Person/menu/direct-entry reset flows.');
    checkDobAndFields(common);
  } finally {
    sql.close(); fs.unlinkSync(filename); fs.rmdirSync(directory);
  }
}

function checkDobAndFields(common) {
  const { chooseBirthPart, parseDateOfBirth, ageFromDateOfBirth } = common['@/src/utils/date-of-birth'];
  const today = new Date(2026, 8, 10, 12);
  assert.equal(chooseBirthPart('31/01/1960', 1, 4, today), '/04/1960');
  assert.equal(chooseBirthPart('29/02/2000', 2, 1900, today), '/02/1900');
  assert.equal(chooseBirthPart('29/02/2000', 2, 1960, today), '29/02/1960');
  assert.equal(chooseBirthPart('11/09/1960', 2, 2026, today), '/09/2026');
  assert.equal(chooseBirthPart('01/12/1960', 2, 2026, today), '//2026');
  assert.equal(parseDateOfBirth('29/02/1900'), null);
  assert.equal(parseDateOfBirth('29/02/2000'), '2000-02-29');
  assert.equal(ageFromDateOfBirth('1960-09-11', today), 65);
  const native = { View: 'View', Modal: 'Modal', FlatList: 'FlatList', TextInput: 'TextInput', StyleSheet: { create: s => s } };
  const props = { language: 'en', value: '', onChange: value => { props.value = value; } };
  const dob = screen('components/onboarding/date-of-birth-field.tsx', { ...common, 'react-native': native }, props);
  assert.equal(nodes(dob()).filter(node => node.type === 'TextInput').length, 0);
  nodes(dob()).find(node => node.type === 'SmaranButton' && node.props.accessibilityLabel.startsWith('Year:')).props.onPress();
  const decadeList = nodes(dob()).find(node => node.type === 'FlatList');
  assert.ok(decadeList.props.data.includes(1940));
  decadeList.props.renderItem({ item: 1940 }).props.onPress();
  const yearList = nodes(dob()).find(node => node.type === 'FlatList');
  assert.deepEqual(yearList.props.data, Array.from({ length: 10 }, (_, n) => 1940 + n));
  yearList.props.renderItem({ item: 1948 }).props.onPress(); assert.equal(props.value, '//1948');
  const fieldProps = { label: 'Emergency contact', value: '' };
  const field = screen('components/ui/smaran-field.tsx', { ...common, 'react-native': native,
    '@/hooks/use-theme-color': { useThemeColors: () => ({}) }, '@/hooks/use-text-size': { useTextSize: () => 'large' },
    '@constants/typography': { getScaledTypography: () => ({}) },
  }, fieldProps);
  const input = nodes(field()).find(node => node.type === 'TextInput');
  assert.equal(input.props.autoComplete, 'off'); assert.equal(input.props.textContentType, 'none'); assert.equal(input.props.importantForAutofill, 'no');
  assert.equal(input.props.autoCorrect, false);
  Object.assign(fieldProps, { autoComplete: 'email', textContentType: 'emailAddress', importantForAutofill: 'yes', autoCorrect: true });
  const explicit = nodes(field()).find(node => node.type === 'TextInput');
  assert.equal(explicit.props.autoComplete, 'email'); assert.equal(explicit.props.textContentType, 'emailAddress');
  assert.equal(explicit.props.importantForAutofill, 'yes'); assert.equal(explicit.props.autoCorrect, true);
  for (const catalog of Object.values(load('src/i18n/profile-strings.ts').profileStrings)) assert.equal(catalog.dobMonths.split('|').length, 12);
  console.log('PASS DOB/forms: actual year-group picker/blank selection; leap/century/future/month-length/age boundaries; seven month catalogs; shared Field privacy-safe defaults and explicit caller overrides. Native touch/layout/TalkBack remain device checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
