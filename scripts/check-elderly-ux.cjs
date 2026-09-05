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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', code)(
    (name) => overrides[name] ?? load(path.resolve(path.dirname(file), name + '.ts'), overrides, cache),
    module, module.exports, false
  );
  return module.exports;
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
  assert.equal(await speech.speakScreenText('No matching voice', 'kha'), 'unavailable');
  assert.equal(await speech.speakScreenText('   ', 'en'), 'failed');
  console.log('PASS: seven catalogs, interpolation contracts, speech cancellation and voice fallback');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
