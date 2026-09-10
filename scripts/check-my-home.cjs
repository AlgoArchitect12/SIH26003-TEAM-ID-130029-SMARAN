const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./check-elderly-ux.cjs');

const root = path.resolve(__dirname, '..');
const credits = require('../src/my-home/image-credits.json');
const source = fs.readFileSync(path.join(root, 'src/my-home/content.ts'), 'utf8');
const documentation = fs.readFileSync(path.join(root, 'docs/NER_CONTENT_SOURCES.md'), 'utf8').replace(/\s+/gu, ' ');
const assetPaths = [...source.matchAll(/require\('([^']+\.jpg)'\)/gu)].map(match => match[1]);
const overrides = { './image-credits.json': credits };
for (const relative of assetPaths) {
  const filename = path.resolve(root, 'src/my-home', relative);
  assert.ok(filename.startsWith(path.join(root, 'assets/my-home') + path.sep));
  assert.ok(fs.existsSync(filename), relative);
  const bytes = fs.readFileSync(filename);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
  overrides[relative] = filename;
}
const { regionalItems, RegionalCategories, getRegionalPack, getRegionalItem, getItemsByCategory } = load('src/my-home/content.ts', overrides);
const { Regions, Languages } = load('src/db/schema.types.ts');
const { strings, t, getRegionName } = load('src/i18n/index.ts');

async function main() {
  assert.equal(regionalItems.length, 32);
  assert.equal(new Set(regionalItems.map(item => item.id)).size, regionalItems.length, 'unique IDs');
  assert.equal(Object.keys(credits).length, 32);
  assert.equal(fs.readdirSync(path.join(root, 'assets/my-home')).length, 32, 'no rejected/unreferenced assets');
  for (const item of regionalItems) {
    assert.ok(Regions.includes(item.state));
    assert.ok(item.id.startsWith(item.state + '-'));
    assert.ok(RegionalCategories.includes(item.category));
    for (const field of ['title', 'shortDescription', 'detail', 'gentlePrompt', 'imageDescription']) {
      assert.equal(typeof item[field], 'string');
      assert.ok(item[field].trim().length >= 5, `${item.id}.${field}`);
      assert.ok(!/https?:\/\/|\b(?:quiz|score|correct answer)\b/iu.test(item[field]), `${item.id}.${field}`);
    }
    assert.ok(item.gentlePrompt.includes('?'), 'optional reflective question');
    assert.ok(item.source.organization.trim());
    assert.equal(new URL(item.source.url).protocol, 'https:');
    assert.equal(getRegionalItem(item.id), item);
    const credit = credits[item.imageCredit];
    assert.ok(credit);
    assert.equal(path.basename(item.imageAsset), credit.filename);
    assert.equal(fs.statSync(item.imageAsset).size, credit.bytes);
    assert.ok(credit.width <= 800 && credit.height <= 800 && credit.width > 0 && credit.height > 0);
    assert.ok(credit.bytes < 200000, 'mobile asset budget');
    assert.ok(['CC0', 'CC BY 2.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0'].includes(credit.license));
    assert.equal(new URL(credit.originalPage).hostname, 'commons.wikimedia.org');
    assert.equal(new URL(credit.licenseUrl).hostname, 'creativecommons.org');
    assert.ok(credit.author.trim() && credit.source.trim() && credit.changes.trim() && credit.verified);
    assert.equal(credit.attributionRequired, credit.license !== 'CC0');
    for (const value of [item.id, item.source.organization, item.source.url, item.detail, item.gentlePrompt,
      credit.filename, credit.originalPage, credit.author, credit.license, credit.licenseUrl, credit.changes]) {
      assert.ok(documentation.includes(value.replace(/\s+/gu, ' ')), `source document covers ${item.id}: ${value}`);
    }
  }
  for (const state of Regions) {
    const pack = getRegionalPack(state);
    assert.equal(pack.length, 4, state);
    assert.ok(pack.every(item => item.state === state), state);
    for (const category of RegionalCategories) {
      assert.deepEqual(getItemsByCategory(state, category), pack.filter(item => item.category === category));
    }
    for (const language of Languages) {
      assert.ok(getRegionName(language, state).trim());
      assert.ok(!/[{}]/u.test(t(language, 'homeRegionContext', { region: getRegionName(language, state) })));
      for (const key of Object.keys(strings.en).filter(key => key.startsWith('regional'))) assert.ok(strings[language][key].trim());
    }
  }
  for (const invalid of [undefined, null, '', 'Assam', 'unknown', 'arunachal-pradesh', '__proto__', 0, {}, ['assam']]) {
    assert.deepEqual(getRegionalPack(invalid), [], 'no default region');
    assert.deepEqual(getItemsByCategory(invalid, 'nature'), []);
    assert.equal(getRegionalItem(invalid), undefined);
  }

  // Actual saved settings -> existing patient resolver -> exact regional pack, in real in-memory SQLite.
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...args),
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  try {
    sqlite.exec('PRAGMA foreign_keys = ON');
    await load('src/db/migrations/index.ts').runMigrations(db);
    const patient = load('src/db/repositories/patient.repository.ts', { '../client': { getDatabase: async () => db } }).patientRepository;
    const flags = { active: 'my-home-qa', complete: 'true' };
    const resolver = load('src/services/active-patient.service.ts', {
      '@db/repositories/patient.repository': { patientRepository: patient },
      '@/src/utils/validation': load('src/utils/validation.ts'),
      './secure-storage.service': { SecureStorageKeys: { activeProfileId: 'active', onboardingCompleted: 'complete' }, getSecureValue: async key => flags[key] },
    });
    await patient.upsertProfileWithSettings({ id: flags.active, preferredName: 'QA' }, { region: 'arunachal', language: 'bn' });
    for (const region of Regions) {
      // Deliberately use Bengali for every region: state selection must never come from language.
      await patient.updateSettings(flags.active, { region, language: 'bn' });
      const saved = await resolver.resolveActivePatient();
      assert.equal(saved.status, 'ready');
      assert.equal(saved.settings.region, region);
      assert.equal(saved.settings.language, 'bn');
      assert.ok(getRegionalPack(saved.settings.region).every(item => item.state === region));
    }
    await assert.rejects(patient.updateSettings(flags.active, { region: 'invalid' }));
    await db.runAsync('DELETE FROM patient_settings WHERE patient_id = ?', flags.active);
    await assert.rejects(resolver.resolveActivePatient(), /Saved patient setup/);
    flags.active = null;
    await assert.rejects(resolver.resolveActivePatient(), /Saved patient setup/);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
  } finally { sqlite.close(); }

  const runtimeFiles = ['app/patient/my-home.tsx', 'app/patient/my-home-memory.tsx', 'components/my-home/shared.tsx'];
  for (const filename of runtimeFiles) {
    const code = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.ok(!/https?:\/\/|\bfetch\s*\(|axios|Bhashini|\bany\b/u.test(code), filename);
    assert.ok(!/numberOfLines|ellipsizeMode/u.test(code), 'do not clip cultural text');
  }
  const speech = fs.readFileSync(path.join(root, 'components/accessibility/read-screen-button.tsx'), 'utf8');
  assert.match(speech, /speechLanguage = language/u, 'existing speech callers retain their language');
  assert.match(speech, /speakScreenText\(text, speechLanguage/u);
  console.log('PASS: 32 sourced items, 32 licensed local images, 8 stored-state mappings, 7 UI catalogs, categories, invalid inputs and offline routes');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
