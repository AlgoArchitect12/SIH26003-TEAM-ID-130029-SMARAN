const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { createDatabase, insertRow, stamp } = require('./check-cognitive-migration.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const { t, strings } = load('src/i18n/index.ts');
const types = load('src/my-day/types.ts');
const presets = load('src/my-day/presets.ts');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function checkSpeech() {
  let voices = [], pending = null, stops = 0, fail = false;
  const utterances = [];
  const native = {
    maxSpeechInputLength: 10000,
    getAvailableVoicesAsync: async () => { if (fail) throw Error('Voice lookup failed'); return pending ? pending.promise : voices; },
    stop: async () => { stops++; },
    speak: (text, options) => { utterances.push({ text, options }); },
  };
  const speech = load('src/services/speech.service.ts', { 'expo-speech': native });
  const locales = { en: 'en_IN', hi: 'hi', as: 'as-IN', bn: 'bn-BD', mni: 'mni_Latn_IN', kha: 'kha-IN', lus: 'lus-IN' };
  const unavailable = await speech.getVoiceCapabilities();
  assert.equal(unavailable.length, 7);
  assert.ok(unavailable.every(row => row.uiTranslation && row.tts === 'unavailable' && row.stt === 'not-implemented' && row.voice === null));
  for (const [language, locale] of Object.entries(locales)) {
    voices = [{ identifier: language, language: locale }];
    const matrix = await speech.getVoiceCapabilities();
    assert.deepEqual(matrix.filter(row => row.tts === 'available').map(row => row.language), [language]);
    let starts = 0, done = 0, errors = 0;
    assert.equal(await speech.speakScreenText(t(language, 'dayWater'), language, {
      onStart: () => starts++, onDone: () => done++, onError: () => errors++,
    }), 'started');
    const { options } = utterances.at(-1);
    assert.equal(starts, 0, 'Dispatch is not an audible-start event');
    options.onStart(); assert.equal(starts, 1);
    assert.equal(options.voice, language); assert.equal(options.language, locale);
    options.onDone(); assert.equal(done, 1);
    options.onError(); assert.equal(errors, 1);
    await speech.stopSpeech();
    options.onStart(); options.onDone(); options.onError(); options.onStopped();
    assert.deepEqual([starts, done, errors], [1, 1, 1], 'Old callbacks cannot mutate the next reading');
  }
  voices = ['mni-IN', 'mni-Beng-IN', 'mni-Mtei-IN'].map(language => ({ identifier: language, language }));
  assert.equal(await speech.speakScreenText('Ising', 'mni'), 'unavailable', 'Romanized catalog needs a suitable Latin-script voice');
  voices = [{ identifier: 'english', language: 'en-IN' }];
  assert.equal(await speech.speakScreenText('Khasi text', 'kha'), 'unavailable', 'Never substitute an unrelated language');
  pending = deferred();
  const before = utterances.length;
  const stale = speech.speakScreenText('Private previous screen', 'en'); await tick();
  await speech.stopSpeech(); pending.resolve(voices);
  assert.equal(await stale, 'failed'); assert.equal(utterances.length, before);
  pending = null;
  const first = speech.speakScreenText('First', 'en'), second = speech.speakScreenText('Second', 'en');
  assert.deepEqual(await Promise.all([first, second]), ['failed', 'started']);
  assert.equal(utterances.at(-1).text, 'Second'); assert.ok(stops > 10);
  fail = true;
  assert.ok((await speech.getVoiceCapabilities()).every(row => row.tts === 'unknown'));
  assert.equal(await speech.speakScreenText('Failed voice', 'en'), 'failed');
  fail = false;

  for (const reducedMotion of [false, true]) {
    const patientSession = load('src/stores/patient-session.store.ts');
    const focus = [], lifecycle = [];
    const props = { language: 'en', text: 'Read this screen' };
    const render = screen('components/accessibility/read-screen-button.tsx', {
      'expo-router': { useFocusEffect: effect => focus.push(effect) },
      'react-native': { View: 'View', StyleSheet: { create: value => value }, AppState: {
        addEventListener: (_, fn) => { lifecycle.push(fn); return { remove() {} }; },
      } },
      '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
      '@/hooks/use-theme-color': { useThemeColors: () => ({}) },
      '@/src/stores/onboarding.store': { useOnboardingStore: select => select({ accessibility: { voiceGuidance: true, reducedMotion } }) },
      '@/src/stores/patient-session.store': patientSession,
      '@services/speech.service': speech,
    }, props);
    render(); const blur = focus[0]();
    const action = () => nodes(render()).find(node => node.type === 'SmaranButton');
    action().props.onPress(); await tick();
    assert.equal(action().props.label, t('en', 'stopReading'));
    assert.equal(action().props.loading, true);
    utterances.at(-1).options.onStart();
    assert.equal(action().props.loading, false);
    action().props.onPress(); await tick();
    assert.equal(action().props.label, t('en', 'readScreen'));
    action().props.onPress(); await tick();
    const playing = utterances.at(-1).options;
    lifecycle[0]('background'); playing.onStart();
    assert.equal(action().props.label, t('en', 'readScreen'));
    pending = deferred(); action().props.onPress(); await tick();
    const count = utterances.length; blur(); pending.resolve(voices); await tick(); pending = null;
    assert.equal(utterances.length, count, 'Navigation cancels an outstanding voice lookup');
    voices = []; action().props.onPress(); await tick();
    assert.ok(nodes(render()).some(node => node.props?.children === t('en', 'speechUnavailable')));
    assert.equal(action().props.disabled, undefined, 'Touch retry stays available');
    voices = [{ identifier: 'english', language: 'en-IN' }];
    const oldAction = action(), spokenBeforeSwitch = utterances.length;
    patientSession.usePatientSessionStore.setState({ revision: 2 });
    oldAction.props.onPress(); await tick();
    assert.equal(utterances.length, spokenBeforeSwitch, 'A stale read button cannot start speech after A-B-A');
  }
  console.log('PASS speech: seven simulated language/voice matrices, script suitability, unknown/unavailable fallback, start/stop, latest request, stale events, blur/background, reduced motion');
}

function checkContracts() {
  assert.deepEqual(presets.reminderPresets.map(item => item.id), ['medicine', 'water', 'meal', 'activity', 'appointment']);
  assert.equal(presets.reminderPresets[1].type, 'hydration');
  assert.equal(presets.reminderPresets[2].type, 'custom');
  assert.equal(t('en', 'dayDrankWater'), 'Drank water');
  assert.match(t('en', 'dayWaterTapOnly'), /records your tap.*does not verify water intake/);
  for (const [language, catalog] of Object.entries(strings)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(strings.en).sort());
    for (const [key, text] of Object.entries(catalog)) {
      assert.ok(text.trim(), language + '.' + key);
      assert.deepEqual((text.match(/\{\w+\}/g) ?? []).sort(), (strings.en[key].match(/\{\w+\}/g) ?? []).sort());
    }
    assert.ok(t(language, 'dayMarkedAt', { time: '10:32' }).includes('10:32'));
    assert.doesNotMatch(t(language, 'dayNotificationTitle') + t(language, 'dayNotificationBody'), /\{.*\}/);
  }
  assert.match(source('components/my-day/my-day-content.tsx'), /voiceInputUnavailable/);
  assert.match(source('app/patient/settings.tsx'), /VoiceCapabilities/);
  assert.match(source('src/services/profile-switching.service.ts'), /await stopSpeech\(true\)/);
  assert.match(source('src/services/caregiver.service.ts'), /Event rows do not snapshot/);
  const layout = load('constants/layout.ts', { 'react-native': { Platform: { select: value => value.web } } }).Layout;
  assert.ok(layout.buttonHeight >= 56 && layout.largeButtonHeight >= 56 && layout.cardMinHeight >= 56);
  for (const file of ['src/services/speech.service.ts', 'src/services/my-day.service.ts', 'src/my-day/presets.ts',
    'app/patient/my-day.tsx', 'app/patient/my-day-reminder.tsx', 'components/accessibility/read-screen-button.tsx',
    'components/accessibility/voice-capabilities.tsx']) {
    assert.doesNotMatch(source(file), /Bhashini|fetch\(|https?:|getUserMedia|SpeechRecognition|wakeWord|continuous\s*:\s*true|hydration goal achieved|dehydration risk|litres per day/i, file);
  }
  assert.match(t('en', 'daySafety'), /healthcare professional.*only reminds/);
  const protectedPaths = ['package.json', 'package-lock.json', 'app.json', 'eas.json', 'plugins/with-private-backup.cjs', 'src/db/client.web.ts', 'src/db/migrations'];
  const { authorized, checkMvp22Boundaries } = require('./check-mvp22-boundaries.cjs');
  checkMvp22Boundaries();
  const unapproved = output => output.trim().split(/\r?\n/).filter(file => file && !authorized.has(file));
  assert.deepEqual(unapproved(execFileSync('git', ['diff', '--name-only', '5381c76', '--', ...protectedPaths], { encoding: 'utf8' })), []);
  assert.deepEqual(unapproved(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...protectedPaths], { encoding: 'utf8' })), []);
  assert.ok(JSON.parse(source('app.json')).expo.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  console.log('PASS contracts: five presets, factual water semantics, seven catalog/placeholder parity, privacy-safe copy, touch fallback, large controls, medical boundary, protected paths/no microphone or cloud additions');
}

async function main() {
  const { sqlite, db } = createDatabase();
  try {
    await load('src/db/migrations/index.ts').runMigrations(db);
    for (const id of ['patient-a', 'patient-b']) insertRow(sqlite, 'patient_profiles', {
      id, preferred_name: id, created_at: stamp, updated_at: stamp,
    });
    const cache = new Map();
    let activePatient = 'patient-a';
    const overrides = {
      '../client': { getDatabase: async () => db },
      'expo-notifications': {}, 'react-native': { Platform: { OS: 'web' } },
      './active-patient.service': { resolveActivePatient: async () => ({ status: 'ready', profile: { id: activePatient } }) },
    };
    const module = file => load(file, overrides, cache);
    const repo = module('src/db/repositories/my-day.repository.ts').myDayRepository;
    const service = module('src/services/my-day.service.ts').myDayService;
    const sessionModule = module('src/stores/patient-session.store.ts');
    const session = sessionModule.usePatientSessionStore;
    const water = await repo.save('patient-a', { type: 'hydration', title: 'Water', note: '',
      timeOfDay: '10:00', repeatRule: 'daily', scheduledDate: null });
    session.setState({ patientId: 'patient-a' });
    const stale = service.complete('patient-a', water.id);
    session.setState({ patientId: 'patient-b', revision: 1 });
    session.setState({ patientId: 'patient-a', revision: 2 });
    await assert.rejects(stale, /patient changed/i, 'A-B-A must reject queued completion');
    assert.deepEqual(await repo.history('patient-a'), []);
    const input = { type: 'hydration', title: 'Water', note: '', timeOfDay: '10:00', repeatRule: 'daily', scheduledDate: null };
    for (const work of [() => service.save(activePatient, input), () => service.save(activePatient, { ...input, title: 'Changed' }, water.id),
      () => service.setEnabled(activePatient, water.id, false), () => service.remove(activePatient, water.id)]) {
      const pending = work(); session.setState(state => ({ revision: state.revision + 2 }));
      await assert.rejects(pending, /patient changed/i);
      assert.equal((await repo.get(activePatient, water.id)).title, 'Water');
      assert.equal((await repo.list(activePatient)).length, 1);
    }
    activePatient = 'patient-b';
    await assert.rejects(service.complete('patient-a', water.id), /patient changed/i);
    await assert.rejects(service.complete('patient-b', water.id));
    assert.deepEqual(await repo.history('patient-b'), []);
    activePatient = 'patient-a';

    // Inject A-B-A at real SQLite async boundaries, including after the insert: rollback must preserve data.
    const original = { getFirstAsync: db.getFirstAsync, runAsync: db.runAsync, withExclusiveTransactionAsync: db.withExclusiveTransactionAsync };
    for (const boundary of ['transaction', 'read', 'write']) {
      let injected = false;
      const switchNow = () => { if (!injected) { injected = true; session.setState(state => ({ revision: state.revision + 2 })); } };
      if (boundary === 'transaction') db.withExclusiveTransactionAsync = async work => { switchNow(); return original.withExclusiveTransactionAsync(work); };
      if (boundary === 'read') db.getFirstAsync = async (...args) => { const result = await original.getFirstAsync(...args); switchNow(); return result; };
      if (boundary === 'write') db.runAsync = async (...args) => { const result = await original.runAsync(...args); switchNow(); return result; };
      await assert.rejects(service.complete(activePatient, water.id), /patient changed/i);
      Object.assign(db, original);
      assert.deepEqual(await repo.history(activePatient), []);
    }
    for (const work of [() => service.save(activePatient, input), () => service.save(activePatient, { ...input, title: 'Changed' }, water.id),
      () => service.setEnabled(activePatient, water.id, false), () => service.remove(activePatient, water.id)]) {
      db.runAsync = async (...args) => { const result = await original.runAsync(...args); session.setState(state => ({ revision: state.revision + 2 })); return result; };
      await assert.rejects(work(), /patient changed/i); db.runAsync = original.runAsync;
      const preserved = await repo.get(activePatient, water.id);
      assert.equal(preserved.title, 'Water'); assert.equal(preserved.isEnabled, true); assert.equal(preserved.deletedAt, null);
      assert.equal((await repo.list(activePatient)).length, 1);
    }
    const routes = [], focus = [];
    const common = {
      'expo-router': { useRouter: () => ({ push: route => routes.push(route), dismissTo: route => routes.push(route) }),
        useLocalSearchParams: () => ({}), useFocusEffect: effect => focus.push(effect) },
      'react-native': { View: 'View', AppState: { addEventListener: () => ({ remove() {} }) } },
      '@components/my-day/shared': { useMyDayPatient: () => ({ patientId: activePatient, language: 'en' }), category: presets.category, dayStyles: {}, Field: 'Field' },
      '@stores/patient-session.store': { usePatient: () => ({ patientId: activePatient, language: 'en' }) },
      '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
      '@/hooks/use-theme-color': { useThemeColors: () => ({}) },
      '@/src/stores/patient-session.store': { ...sessionModule, usePatient: () => ({ patientId: activePatient, language: 'en' }), usePatientSessionStore: Object.assign((selector) => selector ? selector({ workspace: 'caregiver' }) : { workspace: 'caregiver' }, { getState: () => ({ workspace: 'caregiver', workspaceRevision: 0, revision: 0, switching: false }) }), captureReminderManagement: () => () => true },
      '@/src/my-day/types': types, '@/src/my-day/presets': presets,
      '@db/repositories/my-day.repository': { myDayRepository: repo },
      '@services/my-day.service': { myDayService: service },
    };
    sessionModule.setWorkspace('caregiver');
    for (const preset of presets.reminderPresets) {
      const editor = screen('app/caregiver/reminder.tsx', common);
      const choice = nodes(editor()).find(node => node.type === 'SelectionCard' && node.props.title === t('en', preset.key));
      if (!choice) console.dir(nodes(editor()), { depth: null });
      assert.ok(choice && choice.props.icon);
      choice.props.onPress();
      const press = label => nodes(editor()).find(node => node.type === 'SmaranButton' && node.props.label === label).props.onPress();
      press(t('en', 'continue'));
      assert.equal(nodes(editor()).find(node => node.type === 'Field').props.value, t('en', preset.key));
      press(t('en', 'continue'));
      if (preset.repeat === 'once') {
        const future = types.localDay(new Date(Date.now() + 86400000)).split('-');
        for (const [key, value] of [['dayDateYear', future[0]], ['dayDateMonth', future[1]], ['dayDateDay', future[2]]])
          nodes(editor()).find(node => node.type === 'Field' && node.props.label === t('en', key)).props.onChangeText(value);
      }
      press(t('en', 'daySave')); await tick();
      assert.equal(routes.at(-1), '/caregiver/reminders');
      const saved = (await repo.list(activePatient)).filter(row => row.title === t('en', preset.key)).at(-1);
      assert.equal(saved.type, preset.type); assert.equal(saved.timeOfDay, preset.time); assert.equal(saved.repeatRule, preset.repeat);
    }
    const day = screen('components/my-day/my-day-content.tsx', common);
    nodes(day()); const blur = focus[focus.length - 1](); await tick();
    try {
      const action = nodes(day()).find(node => node.type === 'SmaranButton' && node.props.label === 'Drank water');
      assert.ok(action); action.props.onPress(); action.props.onPress(); await tick();
      const history = await repo.history(activePatient);
      assert.equal(history.length, 1); assert.equal(history[0].status, 'completed');
      assert.ok(Number.isFinite(Date.parse(history[0].completedAt)));
      const read = nodes(day()).find(node => node.type === 'ReadScreenButton').props.text;
      assert.match(read, /Marked completed at/);
      const events = JSON.stringify(history);
      await service.complete(activePatient, history[0].reminderId); assert.equal(JSON.stringify(await repo.history(activePatient)), events);
      const queuedAction = nodes(day()).find(node => node.type === 'SmaranButton' && node.props.label === 'Drank water');
      session.setState(state => ({ revision: state.revision + 2 }));
      queuedAction.props.onPress(); await tick();
      assert.equal(JSON.stringify(await repo.history(activePatient)), events, 'Pre-switch rendered action cannot write after returning to A');
      assert.deepEqual(await repo.history('patient-b'), []);
      await repo.remove(activePatient, history[0].reminderId);
      assert.equal(JSON.stringify(await repo.history(activePatient)), events, 'Removal preserves factual history');
    } finally { blur(); }
    const pendingNotifications = new Map();
    let notificationLanguage = 'en';
    const notifications = load('src/services/my-day.service.ts', { ...overrides,
      '../db/repositories/my-day.repository': { myDayRepository: repo },
      '../db/repositories/patient.repository': { patientRepository: { getSettings: async () => ({ language: notificationLanguage }) } },
      'react-native': { Platform: { OS: 'android' } },
      'expo-notifications': {
        AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
        setNotificationHandler() {}, setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
        getAllScheduledNotificationsAsync: async () => [...pendingNotifications.values()], getPresentedNotificationsAsync: async () => [],
        cancelScheduledNotificationAsync: async id => { pendingNotifications.delete(id); },
        scheduleNotificationAsync: async input => { pendingNotifications.set(input.identifier, input); return input.identifier; },
      },
    }).myDayService;
    for (const language of Object.keys(strings)) {
      notificationLanguage = language;
      assert.equal((await notifications.sync(activePatient)).failed, false);
      assert.ok(pendingNotifications.size > 0);
      for (const notification of pendingNotifications.values()) {
        assert.deepEqual(notification.content, { title: t(language, 'dayNotificationTitle'), body: t(language, 'dayNotificationBody'),
          sound: 'default', data: { reminderId: notification.identifier.slice('smaran-my-day-'.length) } });
      }
    }
    const oldReads = db.getAllAsync, delayed = deferred();
    db.getAllAsync = async (...args) => { const result = await oldReads(...args); await delayed.promise; return result; };
    const staleDay = screen('app/patient/my-day.tsx', common);
    staleDay(); const staleBlur = focus.at(-1)(); await tick();
    session.setState(state => ({ revision: state.revision + 2 }));
    delayed.resolve(); await tick(); db.getAllAsync = oldReads;
    assert.ok(!nodes(staleDay()).some(node => node.type === 'ReadScreenButton'), 'Stale reminders cannot populate a new patient view');
    staleBlur();
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS reminders: actual SQLite/editor flows for all five presets, one-tap water, duplicate guard, factual timestamps/history, patient ownership, A-B-A, stale screen/queue/transaction rejection and rollback, seven-language private notification payloads');
  } finally { sqlite.close(); }
  await checkSpeech();
  checkContracts();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
