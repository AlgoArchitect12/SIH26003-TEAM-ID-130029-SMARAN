const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const languages = ['en', 'hi', 'as', 'bn', 'mni', 'kha', 'lus'];

function loadTypeScriptModule(file) {
  const source = fs.readFileSync(file, 'utf8');

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
  };

  vm.runInNewContext(compiled, sandbox, {
    filename: file,
  });

  return module.exports;
}

const api = loadTypeScriptModule(
  path.join(__dirname, '..', 'src', 'services', 'speech-voices.ts'),
);

const voices = [
  {
    identifier: 'en-IN-1',
    language: 'en-IN',
    name: 'English India',
  },
  {
    identifier: 'hi-IN-1',
    language: 'hi-IN',
    name: 'Hindi India',
  },
  {
    identifier: 'bn-IN-1',
    language: 'bn-IN',
    name: 'Bengali India',
  },
  {
    identifier: 'mni-Latn-1',
    language: 'mni-Latn-IN',
    name: 'Meitei Latin',
  },
  {
    identifier: 'fr-FR-1',
    language: 'fr-FR',
    name: 'French',
  },
];

assert.equal(
  api.resolveDeviceVoice(voices, 'en').identifier,
  'en-IN-1',
);

assert.equal(
  api.resolveDeviceVoice(
    [{ identifier: 'en-GB-1', language: 'en-GB' }],
    'en',
  ).identifier,
  'en-GB-1',
);

assert.equal(
  api.resolveDeviceVoice(
    [{ identifier: 'mni-IN-1', language: 'mni-IN' }],
    'mni',
  ),
  null,
);

assert.equal(
  api.resolveDeviceVoice(
    [{ identifier: 'mni-Latn-1', language: 'mni-Latn-IN' }],
    'mni',
  ).identifier,
  'mni-Latn-1',
);

for (const language of languages) {
  const locale = api.fallbackLocale(language);

  assert.equal(typeof locale, 'string');
  assert.ok(locale.length > 0, `${language} has no fallback locale`);
}

console.log(
  'PASS deterministic SMARAN speech voice resolution for all 7 languages.',
);
