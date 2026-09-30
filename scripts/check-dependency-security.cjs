const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// Validate the exact security delta before the older milestone guards compare history.
function readBeforeSecurityUpdate(file) {
  const before = JSON.parse(execFileSync('git', ['show', '23c0b52:' + file], { encoding: 'utf8' }));
  const expected = structuredClone(before);
  if (file === 'package.json') {
    expected.overrides = { '@expo/metro-config@54.0.17': { postcss: '8.5.23' } };
  } else {
    assert.equal(file, 'package-lock.json');
    const patches = {
      'brace-expansion@1.1.18': ['1.1.21', 'sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw=='],
      'brace-expansion@2.1.4': ['2.1.7', 'sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g=='],
      'brace-expansion@5.0.9': ['5.0.12', 'sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ=='],
      'postcss@8.4.49': ['8.5.23', 'sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg=='],
      'undici@6.28.0': ['6.28.1', 'sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DRA=='],
      '@react-navigation/core@7.21.13': ['7.22.1', 'sha512-6JAaYM4u6RPtVMUjN5ovX5DNBdBZtDqebk7kEwlncUP6fP4P94+qEYv1bRmtxSFs7UxiZwQQs+jzTsBaW2WeyA=='],
    };
    let changed = 0;
    for (const [location, entry] of Object.entries(expected.packages)) {
      const name = location.split('node_modules/').pop();
      const patch = patches[name + '@' + entry.version];
      if (!patch) continue;
      const [version, integrity] = patch;
      Object.assign(entry, { version, integrity, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${version}.tgz` });
      if (name === 'postcss') entry.dependencies.nanoid = '^3.3.16';
      if (name === '@react-navigation/core') delete entry.dependencies['query-string'];
      changed++;
    }
    assert.equal(changed, 8, 'five brace-expansion copies, PostCSS, undici and navigation core only');
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected, 'only reviewed security metadata changes: ' + file);
  return before;
}

async function main() {
  readBeforeSecurityUpdate('package.json');
  readBeforeSecurityUpdate('package-lock.json');
  const postcss = require('postcss');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-css-security-'));
  try {
    const mapFile = path.join(directory, 'synthetic.map');
    fs.writeFileSync(mapFile, JSON.stringify({ version: 3, sources: ['synthetic.css'], sourcesContent: ['synthetic-private-text'], names: [], mappings: 'AAAA' }));
    // No implicit read without a source file; no traversal outside its directory.
    for (const from of [undefined, path.join(directory, 'child', 'input.css')]) {
      const annotation = from ? '../synthetic.map' : mapFile.replaceAll('\\', '/');
      const root = postcss.parse(`a { color: red } /*# sourceMappingURL=${annotation} */`, { from });
      assert.equal(root.source.input.map, undefined, 'untrusted CSS must not import local map content');
    }
    const root = postcss.parse('a { color: red } /*# sourceMappingURL=synthetic.map */', { from: path.join(directory, 'input.css') });
    assert.ok(root.source.input.map, 'legitimate same-directory source maps still work');
    assert.equal(postcss.default([]).process('a { color: red }', { from: undefined, map: false }).css, 'a { color: red }');

    const assets = require(path.join(path.dirname(require.resolve('metro/package.json')), 'src/Assets.js'));
    const file = path.resolve('node_modules/expo-router/assets/unmatched.png');
    const data = await assets.getAssetData(file, 'unmatched.png', [], 'android', '/assets');
    assert.deepEqual([data.width, data.height], [436, 266], 'Metro file-path API, not just the Buffer API');
  } finally {
    fs.unlinkSync(path.join(directory, 'synthetic.map'));
    fs.rmdirSync(directory);
  }
  // Exercise the installed navigation parser in a bounded child: a decoder regression must not hang the suite.
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { getStateFromPath } from './node_modules/@react-navigation/core/lib/module/getStateFromPath.js';
    import { getPathFromState } from './node_modules/@react-navigation/core/lib/module/getPathFromState.js';
    const config = { screens: { Profile: 'patient/:id' } };
    const state = getStateFromPath('/patient/one?name=A%20B&tag=x&tag=y&flag', config);
    assert.deepEqual({ ...state.routes[0].params }, { id: 'one', name: 'A B', tag: ['x', 'y'], flag: null });
    assert.equal(getPathFromState(getStateFromPath('/patient/one?name=A%20B', config), config), '/patient/one?name=A%20B');
    const malformed = '%FF'.repeat(20000);
    assert.equal(getStateFromPath('/patient/one?q=' + malformed, config).routes[0].params.q, malformed);
  `], { timeout: 10000, windowsHide: true, stdio: 'pipe' });
  console.log('PASS exact security-only dependency delta, PostCSS disclosure rejection and normal processing, Metro file-path compatibility, navigation round-trip and malformed-query DoS regression.');
}

module.exports = { readBeforeSecurityUpdate };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
