const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const { load } = require('./check-elderly-ux.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/u, '');
const json = file => JSON.parse(read(file));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const files = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? files(directory + '/' + entry.name) : [directory + '/' + entry.name]);

async function main() {
  const config = json('app.json').expo, pkg = json('package.json'), lock = json('package-lock.json');
  assert.equal(config.name, 'SMARAN AI');
  assert.equal(config.slug, 'smaran-ai');
  assert.equal(config.android.package, 'com.smaran.ai');
  assert.equal(config.version, '1.0.0');
  assert.equal(config.android.versionCode, 1);
  assert.equal(config.orientation, 'portrait');
  assert.equal(config.newArchEnabled, true);
  assert.equal(pkg.main, 'expo-router/entry');
  assert.equal(pkg.dependencies.expo, '~54.0.36');
  assert.equal(pkg.dependencies.react, '19.1.0');
  assert.equal(pkg.dependencies['react-native'], '0.81.5');
  const migrations = files('src/db/migrations');
  assert.deepEqual(migrations.map(file => path.basename(file)).sort(), [
    '001_core_bootstrap.ts', '002_cognitive_adaptation.ts', '003_multilingual_expansion.ts',
    '004_my_day.ts', '005_my_memories.ts', '006_cognitive_expansion.ts', '007_cognitive_ai_expansion.ts', '008_auth_sync.ts', '009_extra_cognitive_games.ts', '010_care_circle_reports.ts', 'index.ts',
  ], 'Only authorized migrations 001–010');
  require('./check-mvp22-boundaries.cjs').checkMvp22Boundaries();
  for (const file of migrations.filter(file => /\/00[1-6]_/.test(file))) {
    assert.equal(read(file).replace(/\r\n/gu, '\n').trim(), git('show', '6b1c0f5:' + file), file + ' must preserve stable base');
  }
  const sdk = json('node_modules/expo/bundledNativeModules.json');
  const semver = require('semver'); // Already installed with Expo; no test dependency added.
  for (const name of ['expo', 'expo-router', 'expo-sqlite', 'expo-secure-store', 'expo-notifications',
    'expo-file-system', 'expo-image-picker', 'expo-speech', 'expo-haptics', 'expo-splash-screen']) {
    assert.ok(pkg.dependencies[name], name);
    const installed = json('node_modules/' + name + '/package.json').version;
    assert.equal(installed, lock.packages['node_modules/' + name].version, name + ' lock mismatch');
    assert.ok(semver.satisfies(installed, sdk[name] ?? pkg.dependencies[name]), name + ' SDK 54 mismatch');
  }
  assert.ok(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(name =>
    name !== '@supabase/supabase-js' && /supabase|firebase|apollo|graphql|axios|sentry|analytics|openai|expo-updates|expo-dev-client|async-storage/iu.test(name)));
  const eas = json('eas.json');
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  for (const profile of Object.values(eas.build)) {
    assert.ok(!profile.developmentClient && !profile.channel && !profile.env && !profile.autoIncrement);
  }
  const plugins = new Map(config.plugins.map(plugin => Array.isArray(plugin) ? plugin : [plugin, {}]));
  for (const name of ['expo-router', 'expo-sqlite', 'expo-secure-store', 'expo-notifications', 'expo-image-picker', 'expo-splash-screen']) assert.ok(plugins.has(name));
  assert.equal(plugins.get('expo-image-picker').cameraPermission, false);
  assert.equal(plugins.get('expo-image-picker').microphonePermission, false);
  const foreignKeyFlag = '-DSQLITE_DEFAULT_FOREIGN_KEYS=1';
  assert.equal(plugins.get('expo-sqlite').android.customBuildFlags, foreignKeyFlag);

  // In-memory plugin introspection: no prebuild, native folders, network or account linking.
  const introspected = JSON.parse(execFileSync(process.execPath,
    [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_DOTENV: '1' }, maxBuffer: 8 * 1024 * 1024 }));
  assert.equal(introspected.sdkVersion, '54.0.0');
  const native = introspected._internal.modResults.android;
  assert.ok(native.gradleProperties.some(item => item.key === 'expo.sqlite.customBuildFlags' && item.value === foreignKeyFlag));
  const permissions = native.manifest.manifest['uses-permission'].map(item => item.$);
  for (const name of ['CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'USE_BIOMETRIC', 'USE_FINGERPRINT', 'SYSTEM_ALERT_WINDOW']) {
    assert.ok(permissions.some(item => item['android:name'] === 'android.permission.' + name && item['tools:node'] === 'remove'), name);
  }
  assert.ok(!permissions.some(item => /SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM|READ_MEDIA_|CONTACTS|LOCATION/u.test(item['android:name']) && item['tools:node'] !== 'remove'));
  const metadata = native.manifest.manifest.application[0]['meta-data'];
  assert.ok(metadata.some(item => item.$['android:name'] === 'expo.modules.updates.ENABLED' && item.$['android:value'] === 'false'));
  for (const directory of ['android', 'ios']) assert.ok(!fs.existsSync(path.join(root, directory)), 'Managed workflow: ' + directory);
  for (const file of [config.icon, ...Object.values(config.android.adaptiveIcon).filter(value => value.startsWith('./')), plugins.get('expo-splash-screen').image]) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', file);
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, file);
  }

  const sources = ['src', 'app', 'components', 'hooks', 'constants'].flatMap(files).filter(file => /\.(ts|tsx|json)$/u.test(file));
  const creditFiles = new Set(['src/my-home/content.ts', 'src/my-home/image-credits.json', 'components/ui/icon-symbol.tsx', 'hooks/use-theme-color.ts']);
  for (const file of sources) {
    const text = read(file);
    if (file.startsWith('src/cloud/')) {
      assert.ok(require('./check-mvp22-boundaries.cjs').authorized.has(file), 'Only reviewed cloud modules may use the gateway');
      assert.doesNotMatch(text, /service_role|SERVICE_ROLE|postgres(?:ql)?:\/\/|DB_PASSWORD|DATABASE_URL|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE|console\.(log|debug)\s*\(/);
    } else assert.ok(!/\bfetch\s*\(|\baxios\b|\bsupabase\b|\bfirebase\b|\bgraphql\b|new\s+(WebSocket|XMLHttpRequest)|\bprocess\.env|console\.(log|debug)\s*\(/iu.test(text), 'Runtime network, secret or debug path: ' + file);
    if (/https?:\/\//u.test(text)) assert.ok(creditFiles.has(file), 'Review new URL: ' + file);
    if (/bhashini|remote translation/iu.test(text)) assert.equal(file, 'src/services/language/bhashini.service.ts');
    // Reject raw release logs; walk ancestors so nested __DEV__ handlers are recognized.
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && /^console\.(warn|error)$/u.test(node.expression.getText(ast))) {
        let parent = node.parent, guarded = false;
        while (parent) {
          if (ts.isIfStatement(parent) && parent.expression.getText(ast) === '__DEV__') guarded = true;
          parent = parent.parent;
        }
        assert.ok(guarded, 'Release log could expose personal data: ' + file);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.match(read('src/services/language/bhashini.service.ts'), /available: false/u);
  const home = read('src/my-home/content.ts');
  const assets = [...home.matchAll(/require\('([^']+\.jpg)'\)/gu)].map(match => path.resolve(root, 'src/my-home', match[1]));
  assert.equal(new Set(assets).size, 32);
  assert.equal(files('assets/my-home').length, 32);
  for (const asset of assets) assert.ok(fs.statSync(asset).size > 0);
  for (const file of files('src/games')) assert.ok(!/https?:\/\//u.test(read(file)), file);
  assert.equal(files('src/db/migrations').filter(file => /\/\d{3}_/u.test(file)).length, 10);
  for (const route of ['index', '_layout', 'patient/home', 'patient/games/index', 'patient/games/memory-match', 'patient/games/pattern-recognition',
    'patient/games/routine-recall', 'patient/games/result', 'patient/games/why-level', 'patient/my-day', 'patient/my-day-reminder',
    'patient/my-memories', 'patient/my-memory', 'patient/my-memory-editor', 'patient/my-home', 'patient/my-home-memory', 'caregiver/home']) assert.ok(fs.existsSync(path.join(root, 'app', route + '.tsx')), route);
  const media = read('src/services/memory-media.service.ts');
  for (const pattern of [/Paths\.document/u, /validateMemoryPhotoPath/u, /intermediates: true, idempotent: true/u, /source\.copy\(target\)/u, /file\.exists/u]) assert.match(media, pattern);
  assert.ok(!/requestMediaLibraryPermissionsAsync/u.test(media));
  const notificationSource = read('src/services/my-day.service.ts');
  assert.match(notificationSource, /name: 'Smaran reminders'/u);
  assert.ok(notificationSource.indexOf('setNotificationChannelAsync') < notificationSource.indexOf('requestPermissionsAsync'));
  assert.ok(!/getExpoPushToken|getDevicePushToken/u.test(notificationSource));

  await checkConnectionSafety();
  await checkPermissionBoundary();
  await checkActivePatient();
  for (const file of ['docs/MVP13_NATIVE_HARDENING.md', 'docs/MVP13_NATIVE_ANDROID_TEST_PLAN.md', 'docs/MVP13_NATIVE_ANDROID_RESULTS.md']) assert.ok(read(file).includes('NOT RUN'), file);
  const physical = read('docs/MVP13_NATIVE_ANDROID_RESULTS.md').split('## PHYSICAL DEVICE VERIFIED')[1];
  assert.ok(physical, 'Separate physical results from static/build evidence');
  for (const row of physical.split('\n').filter(line => /^\|/u.test(line) && /\| (PASS|FAIL) \|/u.test(line))) {
    assert.match(row, /Evidence: .+/u, 'Physical claims need observed evidence, device and artifact recorded by tester');
  }
  const trackedAndNew = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n');
  assert.ok(!trackedAndNew.some(file => /\.(apk|aab|jks|keystore|sqlite|db)$|(^|\/)(credentials\.json|mvp13-introspect\.json|qa-.*|temp-.*)$/iu.test(file)), 'Temporary QA files or release secrets in source');
  assert.equal(git('check-ignore', 'release-artifacts/smaran.apk'), 'release-artifacts/smaran.apk');
  if (process.argv.includes('--export')) {
    const exported = json('dist/metadata.json').fileMetadata.android;
    assert.ok(fs.statSync(path.join(root, 'dist', exported.bundle)).size > 0);
    const exportedAssets = exported.assets.map(asset => fs.readFileSync(path.join(root, 'dist', asset.path)));
    for (const asset of assets) assert.ok(exportedAssets.some(bytes => bytes.equals(fs.readFileSync(asset))), 'Missing Android export asset: ' + path.basename(asset));
    console.log('PASS: Android export contains bundled JavaScript and all 32 My Home photos (not APK verification)');
  }
  console.log('PASS: native configuration, SDK/package/migration preservation, offline scan, managed assets, host boundary regressions and evidence structure');
  console.log('NOT RUN: compiled APK, Android SQLite, physical notifications/photos/restart/airplane mode/TalkBack');
}

async function checkConnectionSafety() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-native-'));
  const file = path.join(directory, 'fixture.sqlite');
  let foreignKeys = true;
  const open = enabled => new DatabaseSync(file, { enableForeignKeyConstraints: enabled });
  const sql = open(true);
  function adapter(connection) {
    return {
      execAsync: async statement => connection.exec(statement),
      getFirstAsync: async (statement, ...args) => connection.prepare(statement).get(...args) ?? null,
      getAllAsync: async (statement, ...args) => connection.prepare(statement).all(...args),
      runAsync: async (statement, ...args) => connection.prepare(statement).run(...args),
      withExclusiveTransactionAsync: async work => {
        // Model Expo's separate handle. The flag above is checked through the actual config plugin;
        // Node's option models its semantics, not the unbuilt Android binary.
        const transaction = open(foreignKeys);
        transaction.exec('BEGIN');
        try { await work(adapter(transaction)); transaction.exec('COMMIT'); }
        catch (error) { transaction.exec('ROLLBACK'); throw error; }
        finally { transaction.close(); }
      },
    };
  }
  try {
    const db = adapter(sql), runner = load('src/db/migrations/index.ts').runMigrations;
    await runner(db); await runner(db);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM schema_migrations').get().n, 10);
    for (const table of ['patient_profiles', 'cognitive_sessions', 'adaptive_model_state', 'personal_memories', 'reminders']) assert.equal(sql.prepare('SELECT count(*) AS n FROM ' + table).get().n, 0);
    const overrides = { '../client': { getDatabase: async () => db } };
    const memories = load('src/db/repositories/memories.repository.ts', overrides).memoriesRepository;
    const reminders = load('src/db/repositories/my-day.repository.ts', overrides).myDayRepository;
    const input = { name: 'Synthetic fixture', relationship: '', description: '' };
    foreignKeys = false;
    await memories.save('missing-patient', input, null);
    assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length, 1, 'Reproduce pre-hardening orphan on separate FK-off handle');
    sql.exec('DELETE FROM personal_memories'); // Only this temporary synthetic fixture.
    foreignKeys = true;
    await assert.rejects(memories.save('missing-patient', input, null), /FOREIGN KEY/u);
    await assert.rejects(reminders.save('missing-patient', { type: 'custom', title: 'Fixture', note: '', timeOfDay: '12:00', repeatRule: 'daily', scheduledDate: null }), /FOREIGN KEY/u);
    sql.exec("INSERT INTO patient_profiles(id,preferred_name,created_at,updated_at) VALUES('fixture-patient','Fixture','now','now')");
    const memory = await memories.save('fixture-patient', input, null);
    const reopened = open(true);
    try { assert.equal(reopened.prepare('SELECT id FROM personal_memories').get().id, memory.id); }
    finally { reopened.close(); }
    assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    sql.close();
    fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
}

async function checkPermissionBoundary() {
  const calls = [];
  let status = 'denied';
  const notifications = {
    AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: {},
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => { calls.push('channel'); },
    getPermissionsAsync: async () => { calls.push('read'); return { status, granted: status === 'granted' }; },
    requestPermissionsAsync: async () => { calls.push('request'); return { status, granted: status === 'granted' }; },
    getAllScheduledNotificationsAsync: async () => [],
    getPresentedNotificationsAsync: async () => [],
  };
  const service = load('src/services/my-day.service.ts', {
    './active-patient.service': { resolveActivePatient: async () => { throw Error('Permission checks must not resolve a patient'); } },
    'expo-notifications': notifications, 'react-native': { Platform: { OS: 'android' } },
    '../db/repositories/my-day.repository': { myDayRepository: { list: async () => [], currentCompletions: async () => [] } },
    '../db/repositories/patient.repository': { patientRepository: { getSettings: async () => null } },
  });
  assert.deepEqual(await service.myDayService.sync('fixture'), { permission: 'denied', failed: false });
  assert.deepEqual(calls, ['channel', 'read']);
  calls.length = 0; status = 'granted';
  assert.equal(await service.reminderPermission(true), 'granted');
  assert.deepEqual(calls, ['channel', 'request']);
  notifications.setNotificationChannelAsync = async () => { throw Error('Unavailable OS service'); };
  assert.deepEqual(await service.myDayService.sync('fixture'), { permission: 'unavailable', failed: true });
}

async function checkActivePatient() {
  const flags = new Map();
  const secure = load('src/services/secure-storage.service.ts', { 'expo-secure-store': {
    isAvailableAsync: async () => true, getItemAsync: async key => flags.get(key) ?? null,
    setItemAsync: async (key, value) => flags.set(key, value), deleteItemAsync: async key => flags.delete(key),
  } });
  const { resolveActivePatient } = load('src/services/active-patient.service.ts', {
    './secure-storage.service': secure,
    '@db/repositories/patient.repository': { patientRepository: { listProfiles: async () => [], getProfile: async () => null, getProfileById: async () => null, getSettings: async () => null } },
    '@/src/utils/validation': load('src/utils/validation.ts'),
  });
  assert.equal((await resolveActivePatient()).status, 'fresh');
  flags.set(secure.SecureStorageKeys.onboardingCompleted, 'true');
  await assert.rejects(resolveActivePatient(), /Saved patient setup/);
  flags.set(secure.SecureStorageKeys.activeProfileId, 'missing-patient');
  await assert.rejects(resolveActivePatient(), /Saved patient setup/);
  assert.equal(flags.get(secure.SecureStorageKeys.activeProfileId), 'missing-patient');
  assert.equal(flags.get(secure.SecureStorageKeys.onboardingCompleted), 'true');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
