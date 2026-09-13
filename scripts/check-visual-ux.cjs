const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { load } = require('./check-elderly-ux.cjs');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { cwd: root, encoding: 'utf8' });
const { Colors } = load('constants/colors.ts');
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const surfaces = ['background', 'surface', 'surfaceRaised', 'surfaceMuted', 'surfaceSelected'];
let pairs = 0;
for (const [name, c] of Object.entries(Colors)) {
  assert.deepEqual(Object.keys(c).sort(), Object.keys(Colors.light).sort(), name + ': semantic token parity');
  for (const value of Object.values(c)) assert.match(value, /^#[\da-f]{6}$/i);
  const check = (fg, bg, minimum) => {
    const ratio = contrast(c[fg], c[bg]);
    assert.ok(ratio >= minimum, `${name}: ${fg}/${bg} ${ratio.toFixed(2)} < ${minimum}`);
    pairs++;
    return ratio;
  };
  const textRatios = [];
  for (const bg of surfaces) {
    for (const fg of ['text', 'textSecondary', 'link', 'error']) textRatios.push(check(fg, bg, 4.5));
    for (const fg of ['border', 'focus', 'primary']) check(fg, bg, 3);
  }
  for (const bg of ['successSurface', 'warningSurface', 'disabled']) {
    for (const fg of ['text', 'textSecondary']) check(fg, bg, 4.5);
  }
  for (const action of ['Primary', 'Secondary', 'Accent']) check('onAction' + action, 'action' + action, 4.5);
  check('onDisabled', 'disabled', 4.5);
  check('success', 'successSurface', 3);
  check('warning', 'warningSurface', 3);
  for (const fg of ['primary', 'success']) check(fg, 'surfaceSelected', 3);
  console.log(`${name}: primary text/background ${contrast(c.text, c.background).toFixed(2)}:1; primary button ${contrast(c.onActionPrimary, c.actionPrimary).toFixed(2)}:1; minimum text/link/error on page surfaces ${Math.min(...textRatios).toFixed(2)}:1`);
}
for (const [normal, high] of [[Colors.light, Colors.highContrast], [Colors.dark, Colors.highContrastDark]]) {
  for (const role of ['background', 'surface', 'text', 'border', 'actionPrimary']) assert.notEqual(normal[role], high[role]);
  for (const bg of surfaces) {
    assert.ok(contrast(high.text, high[bg]) > contrast(normal.text, normal[bg]), 'High contrast text is stronger');
    assert.ok(contrast(high.border, high[bg]) > contrast(normal.border, normal[bg]), 'High contrast boundary is stronger');
    assert.ok(contrast(high.textSecondary, high[bg]) >= 7, 'High contrast secondary text');
  }
}
assert.notEqual(Colors.dark.surfaceRaised, Colors.dark.surfaceSelected);
assert.ok(luminance(Colors.dark.background) < luminance(Colors.dark.surface));
assert.ok(luminance(Colors.dark.surface) < luminance(Colors.dark.surfaceRaised));

// Exercise the actual appearance hook, including both System resolutions and legacy fallback.
let mode = 'system', system = 'light', legacy = false;
const theme = load('hooks/use-theme-color.ts', {
  '@/constants/theme': { Colors },
  '@/hooks/use-color-scheme': { useColorScheme: () => system },
  '@/src/stores/onboarding.store': { useOnboardingStore: selector => selector({ accessibility: { highContrast: legacy } }) },
  '@/src/stores/appearance.store': { useAppearanceStore: selector => selector({ mode }) },
});
for (const [setting, expected] of [['light', 'light'], ['dark', 'dark'], ['high-contrast-light', 'highContrast'], ['high-contrast-dark', 'highContrastDark']]) {
  mode = setting; assert.equal(theme.useThemeColors(), Colors[expected]);
}
mode = 'system';
for (system of ['light', 'dark']) assert.equal(theme.useThemeColors(), Colors[system]);
mode = null; legacy = true; assert.equal(theme.useThemeColors(), Colors.highContrast);

// Render component functions with only native/hook boundaries replaced; no test dependency.
const flat = value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
let focused = false, reduced = false, componentColors = Colors.dark;
const native = { StyleSheet: { create: v => v }, Platform: { select: v => v.web ?? v.default },
  Pressable: 'Pressable', View: 'View', Text: 'Text', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator' };
const layout = load('constants/layout.ts', { 'react-native': native });
const typography = load('constants/typography.ts');
const render = (file, name, props) => {
  const module = { exports: {} };
  const overrides = {
    react: { useState: () => [focused, value => { focused = value; }] },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': native,
    '@expo/vector-icons': { MaterialIcons: 'MaterialIcons' },
    '@constants/layout': layout, '@constants/typography': typography,
    '@/hooks/use-haptics': { useHaptics: () => () => {} },
    '@/hooks/use-reduced-motion': { useReducedMotion: () => reduced },
    '@/hooks/use-theme-color': { useThemeColors: () => componentColors,
      useThemeColor: (_, role) => componentColors[role],
      useAppearance: () => ({ highContrast: [Colors.highContrast, Colors.highContrastDark].includes(componentColors) }) },
    '@/hooks/use-text-size': { useTextSize: () => 'extraLarge' },
    '@components/themed-text': { ThemedText: 'ThemedText' },
  };
  const code = ts.transpileModule(source(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(name in overrides, 'Unexpected component dependency: ' + name);
    return overrides[name];
  }, module, module.exports);
  return module.exports[name](props);
};
const buttonFile = 'components/ui/smaran-button.tsx';
const buttonProps = { label: 'Continue', accessibilityLabel: 'Continue', onPress: () => {},
  accessibilityState: { selected: true, expanded: true, checked: true, busy: false, disabled: false }, loading: true, disabled: true };
let button = render(buttonFile, 'SmaranButton', buttonProps);
assert.deepEqual(button.props.accessibilityState, { selected: true, expanded: true, checked: true, busy: true, disabled: true });
assert.equal(button.props.disabled, true);
assert.equal(button.props['aria-busy'], true);
assert.equal(button.props['aria-disabled'], true);
let style = flat(button.props.style({ pressed: false }));
assert.ok(style.minHeight >= 56);
assert.equal(style.backgroundColor, Colors.dark.disabled);
assert.equal(style.borderStyle, 'dashed');
button.props.onFocus();
button = render(buttonFile, 'SmaranButton', { ...buttonProps, disabled: false });
assert.equal(flat(button.props.style({ pressed: false })).outlineColor, Colors.dark.focus);
button.props.onBlur();
reduced = true;
button = render(buttonFile, 'SmaranButton', { ...buttonProps, disabled: false });
assert.equal(flat(button.props.style({ pressed: true })).transform, undefined);
assert.ok(JSON.stringify(button).includes('hourglass-empty'), 'Reduced-motion loading uses static icon');
reduced = false;
button = render(buttonFile, 'SmaranButton', { ...buttonProps, disabled: false });
assert.ok(flat(button.props.style({ pressed: true })).transform);
const card = render('components/ui/smaran-card.tsx', 'SmaranCard', { accessibilityLabel: 'Choice', onPress: () => {}, disabled: true, selected: true });
style = flat(card.props.style({ pressed: false }));
assert.equal(style.opacity, undefined, 'Disabled cards must retain text opacity');
assert.equal(style.borderStyle, 'dashed');
assert.equal(card.props.accessibilityState.selected, true);
assert.equal(card.props.accessibilityState.disabled, true);
const selected = render('components/ui/smaran-card.tsx', 'SmaranCard', { accessibilityLabel: 'Choice', onPress: () => {}, selected: true });
assert.equal(flat(selected.props.style({ pressed: false })).backgroundColor, Colors.dark.surfaceSelected);
let focusCalls = 0;
const fieldProps = { label: 'Name', editable: false, multiline: true, onFocus: () => { focusCalls++; } };
const field = render('components/ui/smaran-field.tsx', 'Field', fieldProps).props.children[1];
assert.equal(field.props.accessibilityState.disabled, true);
assert.equal(flat(field.props.style).color, Colors.dark.onDisabled);
assert.equal(flat(field.props.style).textAlignVertical, 'top');
field.props.onFocus({}); assert.equal(focusCalls, 1);
const focusedField = render('components/ui/smaran-field.tsx', 'Field', { ...fieldProps, editable: true }).props.children[1];
assert.equal(flat(focusedField.props.style).outlineColor, Colors.dark.focus);

// Check actual component output in every palette, not just token values in isolation.
for (componentColors of Object.values(Colors)) {
  focused = false;
  for (const variant of ['primary', 'secondary', 'accent', 'outline']) {
    const action = render(buttonFile, 'SmaranButton', { ...buttonProps, loading: false, disabled: false, variant });
    assert.equal(action.props.accessibilityState.selected, true);
    assert.equal(action.props.accessibilityState.expanded, true);
    assert.equal(action.props.accessibilityState.checked, true);
    assert.ok(JSON.stringify(action).includes('check-circle'), 'Selected action has a non-color cue');
    const label = action.props.children.props.children.at(-1);
    const background = flat(action.props.style({ pressed: false })).backgroundColor;
    assert.ok(contrast(flat(label.props.style).color, background) >= 4.5);
    assert.equal(flat(label.props.style).flexShrink, 1, 'Long action labels can wrap');
  }
  const choice = render('components/ui/smaran-card.tsx', 'SmaranCard', {
    accessibilityLabel: 'Choice', onPress: () => {}, selected: true, checked: true, accessibilityRole: 'switch',
  });
  assert.equal(choice.props.accessibilityState.checked, true);
  assert.equal(choice.props.accessibilityState.selected, undefined);
  assert.ok(flat(choice.props.style({ pressed: false })).minHeight >= 56);
  assert.equal(flat(choice.props.style({ pressed: false })).backgroundColor, componentColors.surfaceSelected);
  const input = render('components/ui/smaran-field.tsx', 'Field', {
    label: 'Name', editable: false, accessibilityState: { busy: true, selected: true },
  }).props.children[1];
  assert.deepEqual(input.props.accessibilityState, { busy: true, selected: true, disabled: true });
  assert.ok(flat(input.props.style).minHeight >= 56);
  assert.equal(flat(input.props.style).borderRadius, layout.Radius.button);
  const alert = render('components/themed-text.tsx', 'ThemedText', { accessibilityRole: 'alert', children: 'Try again' });
  assert.equal(flat(alert.props.style).color, componentColors.error);
  assert.equal(alert.props.accessibilityRole, 'alert');
}

const critical = git('ls-files', 'app/patient', 'app/caregiver', 'components/ui', 'components/patient', 'components/games', 'components/layout', 'components/themed-text.tsx').trim().split(/\r?\n/);
for (const file of critical.filter(file => file.endsWith('.tsx'))) {
  assert.doesNotMatch(source(file), /numberOfLines\s*=|ellipsizeMode\s*=/, file + ': wrapping contract');
  assert.doesNotMatch(source(file), /['"]#[\da-f]{3,8}['"]|rgba?\(/i, file + ': use semantic colors');
}
const added = git('diff', '--unified=0', 'b7eb6bd', '--', 'app', 'components').split(/\r?\n/)
  .filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');
assert.doesNotMatch(added, /Rahul Sharma|demoPatient|fakeScore|samplePatient|dementia score|risk gauge|doctor rating/i);
// MVP-20 explicitly authorizes these cognitive files and migration 007's registry entry.
// Keep every other protected path guarded, including historical migrations 001–006.
const cognitiveAIPaths = new Set([
  'src/games/grid-activities.ts', 'src/i18n/extra-game-strings.ts', 'src/games/memory-match/engine.ts',
  // MVP-21 authorizes only these additional reminder/speech sources. Database/config guards remain below.
  'src/my-day/presets.ts', 'src/i18n/my-day-strings.ts',
  'src/db/repositories/my-day.repository.ts', 'src/services/my-day.service.ts', 'src/services/speech.service.ts',
  'components/games/memory-card.tsx',
  'src/db/migrations/index.ts', 'src/db/migrations/007_cognitive_ai_expansion.ts',
  'src/db/schema.types.ts', 'src/db/repositories/cognitive.repository.ts',
  'src/ai/feature-extractor.ts', 'src/ai/cognitive-coach.ts', 'src/services/cognitive.service.ts',
  'src/games/pattern-recognition.ts', 'src/games/selection-engine.ts', 'src/games/telemetry.ts',
  'src/games/presentation.ts', 'src/games/recall-activities.ts',
  'src/i18n/cognitive-strings.ts', 'src/i18n/cognitive-ai-strings.ts',
  'src/i18n/analytics-strings.ts', // Six-game integration: remove the obsolete pattern/routine-only attempt description.
]);
const analyticsCopyDiff = git('diff', '--unified=0', 'e6b0f2c', '--', 'src/i18n/analytics-strings.ts')
  .split(/\r?\n/).filter(line => /^[+-](?![+-])/.test(line));
assert.ok(analyticsCopyDiff.every(line => /^[+-]  analyticsSelectionAttempts: /.test(line)),
  'Only the six-game attempt description is authorized to change in the analytics catalog');
const { authorized, checkMvp22Boundaries } = require('./check-mvp22-boundaries.cjs');
assert.equal(fs.readFileSync(path.join(root, 'src/games/memory-match/engine.ts'), 'utf8').replace(/\r\n/g, '\n').trim(),
  git('show', '9a4f43c:src/games/memory-match/engine.ts').replace('function shuffle<T>', 'export function shuffle<T>').trim(),
  'Memory Match behavior is unchanged; only its existing shuffle is shared');
checkMvp22Boundaries();
const outsideCognitiveAI = output => output.trim().split(/\r?\n/).filter(file => file && !cognitiveAIPaths.has(file) && !authorized.has(file));
const baselinePaths = ['package.json', 'package-lock.json', 'app.json', 'eas.json', 'plugins/with-private-backup.cjs',
  'src/db/migrations', 'src/db/client.web.ts'];
assert.deepEqual(outsideCognitiveAI(git('diff', '--name-only', 'b7eb6bd', '--', ...baselinePaths)), [], 'Protected paths outside authorized 007 unchanged');
// A source guard cannot prove copy truthfulness; preserve A's data/services/catalogs through B's integration.
const protectedPaths = ['package.json', 'package-lock.json', 'app.json', 'eas.json', 'plugins/with-private-backup.cjs',
  'src', 'app/onboarding', 'components/onboarding', 'app/patient/profile.tsx', 'app/patient/menu.tsx',
  'hooks/use-reduced-motion.ts', 'components/games/memory-card.tsx', 'components/feedback/encouragement-banner.tsx'];
assert.deepEqual(outsideCognitiveAI(git('diff', '--name-only', 'f2d6f85', '--', ...protectedPaths)), [], 'MVP-19A architecture/data/motion outside authorized cognitive changes preserved');
assert.deepEqual(outsideCognitiveAI(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths)), [], 'No unapproved protected files');

// Inspect runtime files on disk, including ignored/untracked files, for QA dependencies.
const runtimeFiles = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
  const file = path.posix.join(directory, entry.name);
  return entry.isDirectory() ? runtimeFiles(file) : /\.(?:[cm]?[jt]sx?|json)$/.test(file) ? [file] : [];
});
for (const file of [...['app', 'components', 'constants', 'hooks', 'src', 'plugins'].flatMap(runtimeFiles),
  'package.json', 'app.json', 'eas.json', 'tsconfig.json',
  ...['metro.config.js', 'babel.config.js', 'app.config.js', 'app.config.ts'].filter(file => fs.existsSync(path.join(root, file)))]) {
  assert.doesNotMatch(source(file), /localhost|127\.0\.0\.1|\[::1\]|playwright|visual-ux-qa|fakeStorage|browserFixture/i,
    file + ': production must not depend on temporary QA');
}
for (const artifact of ['.expo/visual-ux-qa', '.playwright-mcp']) {
  assert.equal(fs.existsSync(path.join(root, artifact)), false, artifact + ': remove temporary QA artifacts');
}
assert.ok(fs.existsSync(path.join(root, 'docs/MVP19B_VISUAL_UX.md')), 'Visual UX handoff is present');
assert.doesNotMatch(source('app/caregiver/activity.tsx'), /disabled=\{days === value\}/, 'Selected period remains an enabled selection');
assert.match(source('app/caregiver/activity.tsx'), /if \(days === value\) return/, 'Reselecting current period preserves loaded records');
assert.equal(layout.PageLayout.content.maxWidth, layout.Layout.contentMaxWidth);
assert.ok(typography.getScaledTypography('body', 'extraLarge').lineHeight > typography.getScaledTypography('body', 'extraLarge').fontSize);
console.log(`PASS: ${pairs} contrast pairs, five appearance modes + System light/dark, all-palette component checks, native-boundary state/focus/motion checks, wrapping/color guards, protected architecture/content, production QA-dependency and cleanup guards`);
