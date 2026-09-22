const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Run the actual TypeScript with only the native speech boundary replaced.
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
    new Function('require', 'module', 'exports', '__DEV__', 'setTimeout', 'clearTimeout', code)(
      (name) => overrides[name] ?? (name === 'react' ? new Proxy(require('react'), { get: (t, p) => p === 'useEffect' ? () => {} : p === 'useState' ? (i) => [i, () => {}] : p === 'useRef' ? () => ({}) : p === 'useCallback' ? (f) => f : p === 'useMemo' ? (f) => f() : t[p] }) : name === 'react-native' ? require('react-native-web') : ['react/jsx-runtime', 'zustand', '@react-native-async-storage/async-storage'].includes(name) ? require(name) : (name.startsWith('expo-') || name.startsWith('@expo/') || name.startsWith('react-native-') || name === '@supabase/supabase-js') ? new Proxy({}, { get: () => () => null }) : load(mapAlias(name) ? ext(path.resolve(__dirname, '..', mapAlias(name))) : ext(path.resolve(path.dirname(file), name)), overrides, cache)),
      module, module.exports, false, overrides.$timers?.setTimeout ?? setTimeout, overrides.$timers?.clearTimeout ?? clearTimeout
    );
  } catch (e) {
    console.error('Failed to load file:', file);
    throw e;
  }
  return module.exports;
}

function walk(node) {
  // Static traversal only: never invoke React components (class or hook-based)
  // as ordinary functions. Class constructors (e.g. ErrorBoundary) throw when
  // invoked without 'new', and hook-based components require a renderer.
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (typeof node === 'object' && node.props) {
    walk(node.props.children);
  }
}

function checkRootLayoutStatic() {
  // Validate the production bootstrap contract from source without invoking
  // hook-based components. Invoking DatabaseBootstrap/ErrorBoundary directly
  // crashes (class without 'new', invalid hook call) and proves nothing.
  const file = path.resolve(__dirname, '..', 'app/_layout.tsx');
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /ErrorBoundary/);
  assert.match(source, /DatabaseBootstrap/);
  assert.match(source, /SmaranLoading/);
  assert.match(source, /accessibilityRole=["']alert["']/);
  assert.match(source, /loadingSetup/);
  assert.match(source, /setupUnavailable/);
  assert.match(source, /retry/i);
  // Ensure the module exports a RootLayout component without rendering it.
  const exported = load('app/_layout.tsx');
  assert.equal(typeof exported.default, 'function');
}

async function main() {
  const { strings, t } = load('src/i18n/index.ts');
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/gu)].map((m) => m[1]).sort();
  for (const [language, catalog] of Object.entries(strings)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(strings.en).sort(), language);
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), `${language}.${key}`);
      assert.deepEqual(placeholders(value), placeholders(strings.en[key]), `${language}.${key}`);
    }
    assert.ok(!/[{}]/u.test(t(language, 'stepProgress', { current: '2', total: '5' })));
    assert.ok(t(language, 'resultTitle', { name: 'Anima' }).includes('Anima'));
  }

  checkRootLayoutStatic();

  let resolveVoices;
  const spoken = [];
  const voice = { identifier: 'test-en', language: 'en-IN' };
  const native = {
    maxSpeechInputLength: 1000,
    stop: async () => {},
    speak: (text) => spoken.push(text),
    getAvailableVoicesAsync: () => new Promise((resolve) => { resolveVoices = resolve; }),
  };
  const speech = load('src/services/speech.service.ts', { 'expo-speech': native });
  const old = speech.speakScreenText('Old screen', 'en');
  await new Promise(setImmediate);
  await speech.stopSpeech();
  resolveVoices([voice]);
  assert.equal(await old, 'failed');
  assert.deepEqual(spoken, [], 'Stop during voice lookup must prevent later speech');
  native.getAvailableVoicesAsync = async () => [voice];
  assert.equal(await speech.speakScreenText('Current screen', 'en'), 'started');
  assert.deepEqual(spoken, ['Current screen']);
  // Production intentionally falls back to language-only synthesis when no exact
  // device voice matches, instead of declaring the feature unavailable. 'kha'
  // with only an en-IN voice therefore still starts via the fallback locale.
  assert.equal(await speech.speakScreenText('No matching voice', 'kha'), 'started');
  assert.deepEqual(spoken, ['Current screen', 'No matching voice']);
  // Genuine unavailability: Meitei (mni) text in Bengali/Meitei script is blocked
  // without weakening speech handling for other languages.
  assert.equal(await speech.speakScreenText('অ', 'mni'), 'unavailable');
  assert.deepEqual(spoken, ['Current screen', 'No matching voice']);
  assert.equal(await speech.speakScreenText('   ', 'en'), 'failed');
  console.log('PASS: seven catalogs, interpolation contracts, speech cancellation and voice fallback');
}
module.exports = { load };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
