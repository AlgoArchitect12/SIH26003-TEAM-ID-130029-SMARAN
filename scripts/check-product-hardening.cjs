const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PNG } = require('pngjs'); // Already installed with Expo.
const { load } = require('./check-elderly-ux.cjs');
const i18n = load('src/i18n/index.ts');
const { t } = i18n;
const { Colors } = load('constants/colors.ts');

// Execute actual selection components with controlled hooks and storage promises.
// Checks state transitions and rendered props, not native touch or layout behavior.
function harness(file, overrides = {}, slots = []) {
  let cursor = 0;
  const react = {
    useCallback: fn => fn,
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = value; }];
    },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name];
    if (name === '@/src/stores/patient-session.store') return load('src/stores/patient-session.store.ts');
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: s => s } };
    if (name === '@i18n/index') return i18n;
    if (name.startsWith('@components/')) return new Proxy({}, { get: (_, key) => String(key) });
    if (name === '@/hooks/use-theme-color') return { useAppearance: () => ({ mode: 'light' }), useThemeColors: () => Colors.light };
    if (name === '@constants/layout') return load('constants/layout.ts', { 'react-native': { Platform: { select: s => s.web } } });
    if (name === '@expo/vector-icons') return { MaterialIcons: 'MaterialIcons' };
    throw new Error('Unmocked boundary: ' + name);
  }, module, module.exports);
  return props => { cursor = 0; return Object.values(module.exports).find(value => typeof value === 'function')(props); };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
async function main() {
  let resolve, reject, writes = 0;
  const render = harness('components/ui/appearance-choices.tsx', {
    '@/src/stores/appearance.store': {
      AppearanceModes: ['system', 'light', 'dark', 'high-contrast-light', 'high-contrast-dark'],
      saveAppearance: () => { writes++; return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    },
  });
  const choices = () => nodes(render({ language: 'en' })).filter(n => n.type === 'SelectionCard');
  assert.equal(choices().length, 5);
  choices()[2].props.onPress();
  assert.ok(choices().every(n => n.props.disabled), 'Pending choices must expose disabled state');
  choices()[1].props.onPress();
  assert.equal(writes, 1, 'Rapid taps must not start a second write');
  reject(new Error('Storage unavailable')); await new Promise(setImmediate);
  assert.ok(choices().every(n => !n.props.disabled), 'Failure must allow retry');
  const failure = nodes(render({ language: 'en' })).find(n => n.props?.accessibilityRole === 'alert');
  assert.equal(failure.props.children, t('en', 'settingsSaveFailed'));
  choices()[2].props.onPress(); resolve(); await new Promise(setImmediate);
  assert.equal(writes, 2);
  assert.ok(nodes(render({ language: 'en' })).some(n => n.props?.children === t('en', 'saved')));
  const selection = harness('components/onboarding/selection-card.tsx');
  for (const disabled of [true, false]) assert.equal(selection({ disabled, title: 'Choice', selectedLabel: 'Selected' }).props.disabled, disabled);

  const patient = { patientId: 'test-only', language: 'en', failed: false, retry() {} };
  for (const section of ['language', 'accessibility']) {
    const settings = harness('app/patient/settings.tsx', {
      'expo-router': { useLocalSearchParams: () => ({ section }) },
      '@components/my-day/shared': { useMyDayPatient: () => patient },
      '@db/schema.types': load('src/db/schema.types.ts'),
      '@db/repositories/patient.repository': { patientRepository: {} },
      '@/src/stores/onboarding.store': { useOnboardingStore: fn => fn({ accessibility: { textSize: 'standard', reducedMotion: false } }) },
    }, [{ current: true }, 'saving']);
    const pending = nodes(settings()).filter(n => n.type === 'SelectionCard');
    assert.ok(pending.length > 0 && pending.every(n => n.props.disabled), section + ' saving choices');
  }
  for (const manage of [false, true]) {
    const day = harness('app/patient/my-day.tsx', {
      'expo-router': { useRouter: () => ({}), useFocusEffect() {} },
      '@components/my-day/shared': { useMyDayPatient: () => patient, dayStyles: {}, category: {} },
      '@db/repositories/my-day.repository': { myDayRepository: {} },
      '@services/my-day.service': { myDayService: {} },
      '@/src/my-day/types': { localDay: () => '2026-09-09' },
    }, [[], [], [], manage, true]);
    const tree = nodes(day());
    const empty = t('en', manage ? 'dayEmpty' : 'careNoRoutine');
    assert.ok(tree.some(n => n.type === 'ThemedText' && n.props.children === empty));
    assert.ok(tree.find(n => n.type === 'ReadScreenButton').props.text.endsWith(empty), 'Spoken empty state must match visible scope');
  }

  const config = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const splash = config.plugins.find(p => p[0] === 'expo-splash-screen')[1];
  assert.equal(splash.backgroundColor, Colors.light.background);
  assert.equal(splash.dark.backgroundColor, Colors.dark.background);
  for (const name of ['icon', 'android-icon-background', 'android-icon-foreground', 'android-icon-monochrome', 'splash-icon', 'splash-icon-dark', 'favicon']) {
    const png = PNG.sync.read(fs.readFileSync(`assets/images/${name}.png`));
    assert.equal(png.width, png.height);
    const transparent = /foreground|monochrome|splash/.test(name);
    assert.equal(png.data[3], transparent ? 0 : 255, name + ' corner alpha');
    let painted = 0;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
      painted++;
      if (/foreground|monochrome/.test(name)) assert.ok(Math.hypot(x + .5 - png.width / 2, y + .5 - png.height / 2) <= png.width * 33 / 108, name + ' safe circle');
    }
    assert.ok(painted > png.width * png.height * .05, name + ' has artwork');
  }
  console.log('PASS: pending appearance/settings choices, duplicate-write guard, failure/retry/success, selection disabled props, spoken/visible empty states, brand alpha/safe-circle and launch palette');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
