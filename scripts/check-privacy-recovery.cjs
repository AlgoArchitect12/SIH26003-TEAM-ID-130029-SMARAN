const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const { load } = require('./check-elderly-ux.cjs');

// Execute the actual screens with native/UI boundaries replaced, as in product-hardening checks.
function screen(file, overrides, props) {
  let cursor = 0;
  const slots = [], effects = [];
  const react = {
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef: initial => slots[cursor++] ??= { current: initial },
    useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((value, index) => value !== previous[index])) effects.push(fn);
      slots[i] = deps;
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', code)(name => {
    if (name in overrides) return overrides[name];
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: s => s } };
    if (name === '@i18n/index') return load('src/i18n/index.ts');
    if (name === '@constants/layout') return load('constants/layout.ts', { 'react-native': { Platform: { select: s => s.web } } });
    if (name.startsWith('@components/')) return new Proxy({}, { get: (_, key) => String(key) });
    if (name === '@services/onboarding-recovery.service') return { ensureInitialRoute: () => null };
    if (name === '@react-navigation/native') return { useIsFocused: () => true };
    if (name === 'expo-router') return { useRouter: () => ({ push: () => {}, dismissTo: () => {} }) };
    throw Error('Unexpected boundary: ' + name);
  }, module, module.exports, false);
  return () => {
    cursor = 0;
    const tree = Object.values(module.exports).find(value => typeof value === 'function')(props);
    effects.splice(0).forEach(fn => fn());
    return tree;
  };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  let children = node.props?.children;
  if (typeof node.type === 'function') {
    try { children = node.type(node.props); } catch (e) { console.error('NODES ERROR', node.type?.name, e); }
  }
  return [node, ...nodes(children)];
}
const tick = () => new Promise(setImmediate);

async function checkPatientRecovery() {
  // Each iteration models an interruption at a different actual onboarding write boundary.
  for (const interrupted of ['sqlite', 'dob', 'active', 'completed']) {
    const sql = new DatabaseSync(':memory:');
    let failure = true;
    const db = {
      execAsync: async statement => sql.exec(statement),
      getFirstAsync: async (statement, ...args) => sql.prepare(statement).get(...args) ?? null,
      getAllAsync: async (statement, ...args) => sql.prepare(statement).all(...args),
      runAsync: async (statement, ...args) => {
        if (failure && interrupted === 'sqlite' && statement.includes('INSERT INTO patient_settings')) throw Error('Injected SQLite write failure');
        return sql.prepare(statement).run(...args);
      },
      withExclusiveTransactionAsync: async work => {
        sql.exec('BEGIN');
        try { await work(db); sql.exec('COMMIT'); } catch (error) { sql.exec('ROLLBACK'); throw error; }
      },
    };
    try {
      await load('src/db/migrations/index.ts').runMigrations(db);
      const repository = load('src/db/repositories/patient.repository.ts', { '../client': { getDatabase: async () => db } }).patientRepository;
      const values = new Map();
      let readFailure = false;
      const secure = load('src/services/secure-storage.service.ts', { 'expo-secure-store': {
        isAvailableAsync: async () => true,
        getItemAsync: async key => { if (readFailure) throw Error('Injected secure read failure'); return values.get(key) ?? null; },
        setItemAsync: async (key, value) => {
          if (failure && key.includes(interrupted === 'active' ? 'active-profile' : interrupted === 'completed' ? 'onboarding-completed' : 'dob.')) throw Error('Injected secure write failure');
          values.set(key, value);
        },
        deleteItemAsync: async (key) => { if (key !== 'smaran.pending-onboarding') throw Error('Recovery must not delete flags'); values.delete(key); },
      } });
      const details = load('src/services/profile-details.service.ts', { './secure-storage.service': secure });
      const resolver = () => load('src/services/active-patient.service.ts', {
        './secure-storage.service': secure, '@db/repositories/patient.repository': { patientRepository: repository },
        '@/src/utils/validation': load('src/utils/validation.ts'),
      });
      assert.equal((await resolver().resolveActivePatient()).status, 'fresh');
      const store = load('src/stores/onboarding.store.ts', { zustand: require('zustand') }).useOnboardingStore;
      store.setState({ role: 'patient', language: 'as', region: 'assam',
        profile: { preferredName: 'Synthetic patient', emergencyName: '', emergencyPhone: '', dateOfBirth: '26/02/1954' } });
      const useStore = Object.assign(selector => selector ? selector(store.getState()) : store.getState(), { getState: store.getState });
      const routes = [];
      const router = { replace: route => routes.push(typeof route === 'string' ? route : (route.pathname || route)) };
      const common = {
        'expo-router': { useRouter: () => router },
        '@db/repositories/patient.repository': { patientRepository: repository },
        '@services/profile-details.service': details, '@services/secure-storage.service': secure,
        '@services/active-patient.service': resolver(), '@/src/utils/date-of-birth': load('src/utils/date-of-birth.ts'),
        '@/src/stores/onboarding.store': { useOnboardingStore: useStore },
        '@/src/caregiver/care-circle': { validateMember: () => null },
        '@services/care-circle.service': { saveOnboardingCareMember: async () => {} },
      };
      const render = screen('components/onboarding/finish-onboarding.tsx', common);
      const save = () => nodes(render()).find(n => n.type === 'SmaranButton').props.onPress();
      save(); save(); await tick();
      assert.ok(nodes(render()).some(n => n.props?.accessibilityRole === 'alert'));
      assert.deepEqual(routes, []);
      const count = () => sql.prepare('SELECT count(*) AS n FROM patient_profiles').get().n;
      assert.equal(count(), interrupted === 'sqlite' ? 0 : 1);
      const before = sql.prepare('SELECT * FROM patient_profiles').all();
      if (interrupted !== 'sqlite') {
        const recovered = await resolver().resolveActivePatient(); // Fresh service instance; no onboarding draft.
        assert.equal(recovered.profile.id, store.getState().savedProfileId);
        assert.equal(recovered.completionConfirmed, false);
        assert.deepEqual(sql.prepare('SELECT * FROM patient_profiles').all(), before);
        await assert.rejects(repository.upsertProfileWithSettings({ preferredName: 'Accidental second profile' }), /already exists/);
        assert.deepEqual(sql.prepare('SELECT * FROM patient_profiles').all(), before);
      }
      failure = false; save(); await tick();
      assert.equal(count(), 1);
      assert.equal(routes.at(-1), '/onboarding/complete');
      const recovered = await resolver().resolveActivePatient();
      assert.equal(recovered.completionConfirmed, true);
      assert.equal(await details.getDateOfBirth(recovered.profile.id), '1954-02-26');

      values.delete(secure.SecureStorageKeys.activeProfileId);
      values.delete(secure.SecureStorageKeys.onboardingCompleted);
      const launch = screen('app/index.tsx', common);
      launch(); await tick();
      assert.equal(routes.at(-1), '/patient/home');
      assert.equal(values.get(secure.SecureStorageKeys.activeProfileId), recovered.profile.id);
      assert.equal(count(), 1);
      readFailure = true;
      const routesBefore = [...routes], flagsBefore = [...values], draftBefore = store.getState().profile;
      const failedLaunch = screen('app/index.tsx', common);
      failedLaunch(); await tick();
      const failedTree = nodes(failedLaunch());
      assert.ok(failedTree.some(n => n.props?.accessibilityRole === 'alert'));
      assert.deepEqual(routes, routesBefore);
      assert.deepEqual([...values], flagsBefore);
      assert.deepEqual(store.getState().profile, draftBefore);
      readFailure = false;
      failedTree.find(n => n.type === 'SmaranButton').props.onPress();
      failedLaunch(); await tick();
      assert.equal(routes.at(-1), '/patient/home');
      if (interrupted === 'completed') await checkProfileScreen(repository, details, common, recovered.profile.id);
      values.set(secure.SecureStorageKeys.activeProfileId, 'missing-patient');
      await assert.rejects(resolver().resolveActivePatient(), /Saved patient setup/);
      assert.equal(values.get(secure.SecureStorageKeys.activeProfileId), 'missing-patient');
      values.delete(secure.SecureStorageKeys.activeProfileId);
      await repository.upsertProfileWithSettings({ id: 'second-patient', preferredName: 'Another synthetic patient' });
      await assert.rejects(resolver().resolveActivePatient(), /More than one local patient/);
      assert.equal(count(), 2);
      const profilesBefore = sql.prepare('SELECT * FROM patient_profiles').all();
      for (const id of [recovered.profile.id, 'second-patient']) {
        values.set(secure.SecureStorageKeys.activeProfileId, id);
        const selected = await resolver().resolveActivePatient();
        assert.equal(selected.profile.id, id, 'An explicit active ID resolves even with multiple profiles');
        assert.equal(selected.settings.patientId, id);
      }
      values.set(secure.SecureStorageKeys.activeProfileId, 'missing-patient');
      await assert.rejects(resolver().resolveActivePatient(), /Saved patient setup/);
      assert.equal(values.get(secure.SecureStorageKeys.activeProfileId), 'missing-patient');
      await assert.rejects(repository.upsertProfileWithSettings({ preferredName: 'Accidental third profile' }), /already exists/);
      assert.deepEqual(sql.prepare('SELECT * FROM patient_profiles').all(), profilesBefore);
      assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { sql.close(); }
  }
  console.log('PASS: actual onboarding failure/retry at SQLite, DOB and both flags; cold launch recovery and duplicate/ambiguous-patient protection');
}

async function checkProfileScreen(repository, details, common, patientId) {
  let focus, failDob = true;
  const profileDetails = { ...details, saveDateOfBirth: async (...args) => {
    if (failDob) throw Error('Injected DOB write failure');
    return details.saveDateOfBirth(...args);
  } };
  const render = screen('app/patient/profile.tsx', {
    ...common,
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    '@components/my-day/shared': { Field: 'Field', useMyDayPatient: () => ({ patientId, language: 'en', failed: false, retry() {} }) },
    '@services/profile-details.service': profileDetails,
    '@/src/utils/validation': load('src/utils/validation.ts'),
  });
  render(); focus(); await tick();
  nodes(render()).find(n => n.type === 'Field').props.onChangeText('Edited synthetic patient');
  nodes(render()).find(n => n.type === 'DateOfBirthField').props.onChange('27/02/1954');
  const save = () => nodes(render()).find(n => n.type === 'SmaranButton').props.onPress();
  save(); await tick();
  assert.equal((await repository.getProfileById(patientId)).preferredName, 'Edited synthetic patient');
  assert.equal(await details.getDateOfBirth(patientId), '1954-02-26');
  assert.equal(nodes(render()).find(n => n.type === 'DateOfBirthField').props.value, '27/02/1954');
  assert.ok(nodes(render()).some(n => n.props?.children === load('src/i18n/index.ts').t('en', 'profileSaveFailed')));
  failDob = false; save(); await tick();
  assert.equal(await details.getDateOfBirth(patientId), '1954-02-27');
  profileDetails.getDateOfBirth = async () => { throw Error('Injected DOB read failure'); };
  focus();
  assert.ok(!nodes(render()).some(n => n.type === 'Field'), 'Pending reload must hide old editable values');
  await tick();
  assert.equal(render().props.failed, true);
  assert.equal(await details.getDateOfBirth(patientId), '1954-02-27');
  console.log('PASS: actual Profile partial-save wording, draft retention, retry and read-failure form protection');
}

function checkPrivacyCopyAndLogs() {
  const { strings, t } = load('src/i18n/index.ts');
  for (const language of Object.keys(strings)) for (const section of ['about', 'help']) {
    const render = screen('app/patient/support.tsx', {
      'expo-router': { useLocalSearchParams: () => ({ section }) },
      '@components/my-day/shared': { useMyDayPatient: () => ({ language, patientId: 'fixture' }) },
    });
    const tree = nodes(render()), speech = tree.find(n => n.type === 'ReadScreenButton').props.text;
    for (const key of ['privacyTitle', 'privacyLocal', 'privacyLoss', 'privacySharing']) {
      assert.ok(tree.some(n => n.props?.children === t(language, key)));
      assert.ok(speech.includes(t(language, key)));
    }
  }
  const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  for (const file of ['app', 'src', 'components', 'hooks', 'constants'].flatMap(files).filter(file => /\.tsx?$/.test(file))) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && /^console\./.test(node.expression.getText(ast))) {
        assert.ok(node.arguments.every(ts.isStringLiteral), 'Log must not contain runtime values: ' + file);
        let parent = node.parent;
        while (parent && !(ts.isIfStatement(parent) && parent.expression.getText(ast) === '__DEV__')) parent = parent.parent;
        assert.ok(parent, 'Log must be development-only: ' + file);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  console.log('PASS: actual seven-language Help/About visible and spoken privacy text; static-only development diagnostics');
}

async function checkBackup() {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_DOTENV: '1' }, maxBuffer: 8 * 1024 * 1024,
  }));
  const application = config._internal.modResults.android.manifest.manifest.application[0].$;
  assert.equal(application['android:allowBackup'], 'false');
  assert.equal(application['android:fullBackupContent'], 'false');
  assert.equal(application['android:dataExtractionRules'], '@xml/smaran_data_extraction_rules');
  // Introspection does not execute file mods. Run the real resource writer twice in a disposable directory.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-privacy-'));
  try {
    const plugin = require('../plugins/with-private-backup.cjs');
    const run = () => plugin({ name: 'Fixture', slug: 'fixture' }).mods.android.dangerous({ modRequest: { platformProjectRoot: directory } });
    await run();
    const file = path.join(directory, 'app/src/main/res/xml/smaran_data_extraction_rules.xml');
    const first = fs.readFileSync(file, 'utf8');
    await run(); assert.equal(fs.readFileSync(file, 'utf8'), first);
    const xml = await require('xml2js').parseStringPromise(first); // Already installed with Expo.
    for (const mode of ['cloud-backup', 'device-transfer']) {
      const rules = xml['data-extraction-rules'][mode][0];
      assert.equal(rules.include, undefined);
      assert.deepEqual(rules.exclude.map(rule => rule.$).sort((a,b) => a.domain.localeCompare(b.domain)),
        ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']
          .sort().map(domain => ({ domain, path: '.' })));
    }
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('smaran-privacy-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log('PASS: Expo-generated manifest, actual deterministic XML writer, all storage-domain exclusions for cloud and device transfer (not physical-device proof)');
}

async function main() {
  const values = new Map();
  let available = true, failRead = false, failWrite = false;
  const secure = load('src/services/secure-storage.service.ts', { 'expo-secure-store': {
    isAvailableAsync: async () => available,
    getItemAsync: async key => { if (failRead) throw Error('Injected read failure'); return values.get(key) ?? null; },
    setItemAsync: async (key, value) => { if (failWrite) throw Error('Injected write failure'); values.set(key, value); },
    deleteItemAsync: async key => values.delete(key),
  } });
  const key = secure.SecureStorageKeys.activeProfileId;
  assert.equal(await secure.getSecureValue(key), null);
  await secure.setSecureValue(key, 'fixture-patient');
  available = false;
  await assert.rejects(secure.getSecureValue(key), { name: 'SecureStorageUnavailableError' });
  await assert.rejects(secure.deleteSecureValue(key), { name: 'SecureStorageUnavailableError' });
  assert.equal(values.get(key), 'fixture-patient');
  available = true; failRead = true;
  await assert.rejects(secure.getSecureValue(key), /Injected read failure/);
  failRead = false;
  const details = load('src/services/profile-details.service.ts', { './secure-storage.service': secure });
  await details.saveDateOfBirth('fixture-patient', '1954-02-26');
  failWrite = true;
  await assert.rejects(details.saveDateOfBirth('fixture-patient', '1960-01-01'));
  assert.equal(await details.getDateOfBirth('fixture-patient'), '1954-02-26');
  failWrite = false;
  for (const invalid of ['', 'invalid', '1954-02-31']) {
    values.set('smaran.dob.fixture-patient', invalid);
    await assert.rejects(details.getDateOfBirth('fixture-patient'));
    assert.equal(values.get('smaran.dob.fixture-patient'), invalid);
  }
  const appearance = load('src/stores/appearance.store.ts', {
    zustand: require('zustand'), '../services/secure-storage.service': secure,
  });
  await appearance.saveAppearance('dark');
  failRead = true;
  await assert.rejects(appearance.loadAppearance());
  assert.equal(appearance.useAppearanceStore.getState().mode, 'dark');
  failRead = false;
  values.set(secure.SecureStorageKeys.appearance, 'invalid');
  await assert.rejects(appearance.loadAppearance());
  assert.equal(appearance.useAppearanceStore.getState().mode, 'dark');
  console.log('PASS: missing versus failed secure reads, failed DOB writes, corrupt values and appearance recovery');
  await checkPatientRecovery();
  checkPrivacyCopyAndLogs();
  await checkBackup();
}

module.exports = { screen, nodes };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
