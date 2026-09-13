const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { load } = require('./check-elderly-ux.cjs');
// Compare every historical field; MVP-12 separately verifies the new activity fields.
const historicalColumns = {"cognitive_sessions":"id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,hints_used,repeated_mistakes,avg_response_ms,accuracy,feedback_label,recommended_difficulty,is_demo_seed,created_at","adaptive_model_state":"patient_id,bias,weight_accuracy,weight_pace,weight_memory,weight_hints,weight_stability,sample_count,updated_at"};

// Actual migrations/repositories/services, real SQLite and files; only the Expo native boundary is replaced.
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-memories-'));
  const document = path.join(root, 'documents'), cache = path.join(root, 'cache');
  fs.mkdirSync(document); fs.mkdirSync(cache);
  let sqlite, failDelete = false, failCopy = false;
  const operations = [];
  const open = () => {
    sqlite = new DatabaseSync(path.join(root, 'test.sqlite'));
    sqlite.exec('PRAGMA foreign_keys = ON');
    assert.equal(sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  };
  open();
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    getFirstAsync: async (sql, ...args) => { const row = sqlite.prepare(sql).get(...args); return row ? { ...row } : null; },
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args).map(row => ({ ...row })),
    runAsync: async (sql, ...args) => {
      const result = sqlite.prepare(sql).run(...args);
      if (/^DELETE FROM personal_memories/u.test(sql)) operations.push('db-delete');
      return result;
    },
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); operations.push('commit'); }
      catch (error) { sqlite.exec('ROLLBACK'); operations.push('rollback'); throw error; }
    },
  };
  const restart = () => { sqlite.close(); open(); };
  class File {
    constructor(...parts) {
      this.path = path.join(...parts.map(part => typeof part === 'string' ? part.startsWith('file:') ? fileURLToPath(part) : part : part.path));
    }
    get uri() { return pathToFileURL(this.path).href; }
    get exists() { return fs.existsSync(this.path); }
    get size() { return this.exists ? fs.statSync(this.path).size : 0; }
    copy(target) {
      operations.push('copy');
      if (failCopy) { fs.writeFileSync(target.path, 'partial'); throw new Error('copy failed'); }
      fs.copyFileSync(this.path, target.path, fs.constants.COPYFILE_EXCL);
    }
    delete() {
      operations.push('file-delete');
      if (failDelete) throw new Error('cleanup failed');
      fs.unlinkSync(this.path);
    }
  }
  class Directory extends File {
    create() { fs.mkdirSync(this.path, { recursive: true }); }
  }
  const platform = { OS: 'android' };
  let selection = { canceled: true }, pickError, pickerOptions;
  const overrides = {
    '../client': { getDatabase: async () => db },
    'react-native': { Platform: platform },
    'expo-file-system': { File, Directory, Paths: { document: new Directory(document), cache: new Directory(cache) } },
    'expo-image-picker': { launchImageLibraryAsync: async options => { pickerOptions = options; if (pickError) throw pickError; return selection; } },
  };
  const modules = new Map();
  const repo = load('src/db/repositories/memories.repository.ts', overrides, modules).memoriesRepository;
  const media = load('src/services/memory-media.service.ts', overrides, modules).memoryMedia;
  const service = load('src/services/memories.service.ts', overrides, modules).memoriesService;
  const { validateMemory, validateMemoryPhotoPath } = load('src/memories/types.ts', overrides, modules);
  const patient = 'patient-one', other = 'patient-two';
  const input = { name: 'User supplied name', relationship: 'User supplied relationship', description: 'User supplied text.\nSecond paragraph.' };
  const source = path.join(cache, 'picker.jpeg');
  fs.writeFileSync(source, Buffer.from('89504e470d0a1a0a', 'hex'));
  const photo = { uri: pathToFileURL(source).href, extension: 'jpg' };
  const replacement = { kind: 'replace', photo };
  const exists = relative => fs.existsSync(path.join(document, relative));
  const files = () => fs.readdirSync(document, { recursive: true }).filter(name => /\.(jpg|png)$/u.test(name)).sort();
  try {
    const migrations = [
      ['001_core_bootstrap', 'coreBootstrapMigration'], ['002_cognitive_adaptation', 'cognitiveAdaptationMigration'],
      ['003_multilingual_expansion', 'multilingualExpansionMigration'], ['004_my_day', 'myDayMigration'],
    ];
    await db.execAsync('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)');
    for (const [file, key] of migrations) {
      const migration = load('src/db/migrations/' + file + '.ts')[key];
      await migration.up(db);
      await db.runAsync('INSERT INTO schema_migrations VALUES (?,?,?)', migration.version, migration.name, 'before');
    }
    for (const id of [patient, other]) await db.runAsync('INSERT INTO patient_profiles (id,preferred_name,created_at,updated_at) VALUES (?,?,?,?)', id, id, 'before', 'before');
    await db.runAsync('INSERT INTO patient_settings (id,patient_id,language,updated_at) VALUES (?,?,?,?)', 'settings', patient, 'as', 'before');
    await db.runAsync(`INSERT INTO cognitive_sessions (id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,avg_response_ms,accuracy,recommended_difficulty,created_at)
      VALUES (?,?,'memory_match',1,'before','before',2,2,2,1000,1,1,'before')`, 'session', patient);
    await db.runAsync("INSERT INTO adaptive_model_state VALUES (?,0,1,2,3,4,5,6,'before')", patient);
    const day = load('src/db/repositories/my-day.repository.ts', overrides).myDayRepository;
    const { localDay } = load('src/my-day/types.ts');
    const reminder = await day.save(patient, { type: 'custom', title: 'Preserved reminder', note: '', timeOfDay: '08:00', repeatRule: 'daily', scheduledDate: null });
    await day.complete(patient, reminder.id, localDay());
    const snapshot = () => Promise.all(['patient_profiles', 'patient_settings', 'cognitive_sessions', 'adaptive_model_state', 'reminders', 'reminder_events'].map(table => db.getAllAsync('SELECT ' + (historicalColumns[table] ?? '*') + ' FROM ' + table)));
    const before = await snapshot();
    const { runMigrations } = load('src/db/migrations/index.ts');
    await runMigrations(db); await runMigrations(db);
    assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, 9);
    assert.deepEqual(await snapshot(), before);
    console.log('PASS: real migration 001-007 upgrade, idempotent runner, existing patient/cognitive/My Day data preserved');

    assert.deepEqual(await repo.list(patient), []);
    assert.deepEqual(validateMemory({ ...input, name: '  e\u0301  ' }), { ...input, name: '\u00e9' });
    for (const bad of [{ name: ' ' }, { name: 'n'.repeat(101) }, { relationship: 'r'.repeat(101) }, { description: 'd'.repeat(501) }, { name: '\u0000' }]) {
      await assert.rejects(repo.save(patient, { ...input, ...bad }, null));
    }
    await assert.rejects(repo.save('missing-patient', input, null), /FOREIGN KEY/u);
    const rawInsert = (id, name, relationship, description, photoPath = null) => db.runAsync('INSERT INTO personal_memories VALUES (?,?,?,?,?,?,?,?)', id, patient, name, relationship, description, photoPath, 'now', 'now');
    await assert.rejects(rawInsert('invalid', ' ', '', ''), /CHECK/u);
    await assert.rejects(rawInsert('invalid', 'n'.repeat(101), '', ''), /CHECK/u);
    await assert.rejects(rawInsert('invalid', 'name', 'r'.repeat(101), ''), /CHECK/u);
    await assert.rejects(rawInsert('invalid', 'name', '', 'd'.repeat(501)), /CHECK/u);
    await assert.rejects(rawInsert('invalid', 'name', '', '', '../outside.jpg'), /CHECK/u);
    const text = await repo.save(patient, input, null);
    assert.match(text.id, /^[a-f0-9]{32}$/u);
    assert.deepEqual(await repo.get(patient, text.id), text);
    restart(); assert.deepEqual(await repo.get(patient, text.id), text);
    assert.deepEqual(await repo.list(other), []); assert.equal(await repo.get(other, text.id), null);
    await assert.rejects(repo.save(other, input, null, text.id), error => error.code === 'missing');
    await assert.rejects(repo.remove(other, text.id), error => error.code === 'missing');
    const changed = { name: "Name's update", relationship: 'Different relationship', description: 'Different description' };
    const edited = await repo.save(patient, changed, null, text.id);
    assert.deepEqual(await repo.get(patient, text.id), edited);
    assert.equal(edited.createdAt, text.createdAt);
    restart(); assert.equal((await repo.get(patient, text.id)).description, changed.description);
    await repo.remove(patient, text.id); restart(); assert.equal(await repo.get(patient, text.id), null);
    console.log('PASS: constraints, FK, CRUD binding order, patient isolation, database reopen');

    assert.deepEqual(await media.pick(), { status: 'canceled' });
    selection = { canceled: false, assets: [{ uri: photo.uri, type: 'image' }] };
    assert.deepEqual(await media.pick(), { status: 'selected', photo });
    assert.deepEqual(pickerOptions, { mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false, quality: 0.8, exif: false, base64: false });
    pickError = { code: 'ERR_MISSING_PERMISSION' }; assert.equal((await media.pick()).status, 'denied');
    pickError = new Error('failed'); assert.equal((await media.pick()).status, 'failed'); pickError = undefined;
    selection = { canceled: false, assets: [{ uri: photo.uri, type: 'video' }] }; assert.equal((await media.pick()).status, 'failed');
    platform.OS = 'web'; assert.equal((await media.pick()).status, 'unavailable'); platform.OS = 'android';
    const generated = await repo.newId();
    const managed = media.importPhoto(patient, photo, generated);
    assert.equal(managed, `memories/${patient}/${generated}.jpg`);
    assert.equal(media.resolve(patient, managed), pathToFileURL(path.join(document, managed)).href);
    assert.deepEqual(fs.readFileSync(path.join(document, managed)), fs.readFileSync(source));
    assert.throws(() => media.importPhoto(patient, photo, generated));
    const unsafe = ['/outside.jpg', 'file:///outside.jpg', '../outside.jpg', `memories/${patient}/../outside.jpg`,
      `memories/${patient}/%2e%2e/outside.jpg`, `memories/${other}/${generated}.jpg`, `memories\\${patient}\\${generated}.jpg`,
      `memories/${patient}/${generated}.jpg/child`, `memories/${patient}/${generated}.jpg?x=1`];
    operations.length = 0;
    for (const value of unsafe) {
      assert.throws(() => validateMemoryPhotoPath(patient, value));
      assert.equal(media.resolve(patient, value), null);
      assert.throws(() => media.remove(patient, value));
    }
    assert.deepEqual(operations, []); assert.ok(exists(managed));
    for (const uri of ['https://example.invalid/photo.jpg', pathToFileURL(path.join(document, managed)).href, photo.uri.replace('picker.jpeg', '../outside.jpg'), photo.uri.replace('picker.jpeg', '%2e%2e/outside.jpg')]) {
      assert.throws(() => media.importPhoto(patient, { ...photo, uri }, 'a'.repeat(32)));
    }
    assert.throws(() => media.importPhoto('../patient', photo, 'b'.repeat(32)));
    assert.throws(() => media.importPhoto(patient, photo, input.name));
    const big = path.join(cache, 'big.jpg'); fs.writeFileSync(big, ''); fs.truncateSync(big, 20 * 1024 * 1024 + 1);
    assert.throws(() => media.importPhoto(patient, { ...photo, uri: pathToFileURL(big).href }, 'c'.repeat(32)));
    media.remove(patient, managed); assert.equal(media.resolve(patient, managed), null); media.remove(patient, managed);
    failCopy = true;
    assert.throws(() => media.importPhoto(patient, photo, generated), error => error.code === 'photo');
    assert.ok(!exists(managed)); failCopy = false;
    console.log('PASS: picker contract, real file copy/resolve/delete, generated paths, traversal rejection, missing files and partial-copy cleanup');

    await db.execAsync(`CREATE TRIGGER qa_fail_insert BEFORE INSERT ON personal_memories WHEN NEW.name = 'Fail DB' BEGIN SELECT RAISE(ABORT,'injected DB failure'); END;
      CREATE TRIGGER qa_fail_update BEFORE UPDATE ON personal_memories WHEN NEW.name = 'Fail DB' BEGIN SELECT RAISE(ABORT,'injected DB failure'); END;`);
    let baseline = files(); operations.length = 0;
    await assert.rejects(service.save(patient, { ...input, name: 'Fail DB' }, replacement), /injected DB/u);
    assert.deepEqual(files(), baseline); assert.deepEqual(await repo.list(patient), []);
    assert.deepEqual(operations, ['copy', 'rollback', 'file-delete']);
    operations.length = 0;
    const first = (await service.save(patient, input, replacement)).memory;
    assert.deepEqual(operations, ['copy', 'commit']); assert.ok(exists(first.photoPath));
    restart(); assert.equal(media.resolve(patient, (await repo.get(patient, first.id)).photoPath), media.resolve(patient, first.photoPath));
    baseline = files(); operations.length = 0;
    await assert.rejects(service.save(patient, { ...input, name: 'Fail DB' }, replacement, first.id));
    assert.deepEqual(await repo.get(patient, first.id), first); assert.deepEqual(files(), baseline);
    assert.deepEqual(operations, ['copy', 'rollback', 'file-delete']);
    operations.length = 0;
    await assert.rejects(service.save(other, input, replacement, first.id), error => error.code === 'missing');
    await assert.rejects(service.remove(other, first.id), error => error.code === 'missing');
    assert.deepEqual(operations, []); assert.ok(exists(first.photoPath));
    const second = (await service.save(patient, changed, replacement, first.id)).memory;
    assert.deepEqual(operations, ['copy', 'commit', 'file-delete']);
    assert.ok(exists(second.photoPath)); assert.ok(!exists(first.photoPath));
    restart(); assert.deepEqual(await repo.get(patient, first.id), second);
    operations.length = 0;
    await assert.rejects(service.save(patient, { ...input, name: 'Fail DB' }, { kind: 'remove' }, first.id));
    assert.deepEqual(operations, ['rollback']); assert.ok(exists(second.photoPath));
    operations.length = 0; failDelete = true;
    const noPhoto = await service.save(patient, changed, { kind: 'remove' }, first.id);
    assert.equal(noPhoto.cleanupFailed, true); assert.equal(noPhoto.memory.photoPath, null);
    assert.deepEqual(operations, ['commit', 'file-delete']); assert.ok(exists(second.photoPath));
    failDelete = false; media.remove(patient, second.photoPath);
    const third = (await service.save(patient, input, replacement, first.id)).memory;
    await db.execAsync("CREATE TRIGGER qa_fail_delete BEFORE DELETE ON personal_memories BEGIN SELECT RAISE(ABORT,'injected delete failure'); END;");
    operations.length = 0;
    await assert.rejects(service.remove(patient, third.id), /injected delete/u);
    assert.deepEqual(operations, []); assert.ok(exists(third.photoPath));
    await db.execAsync('DROP TRIGGER qa_fail_delete');
    operations.length = 0; failDelete = true;
    assert.equal((await service.remove(patient, third.id)).cleanupFailed, true);
    assert.deepEqual(operations, ['db-delete', 'file-delete']);
    restart(); assert.equal(await repo.get(patient, third.id), null); assert.ok(exists(third.photoPath));
    failDelete = false; media.remove(patient, third.photoPath);
    const fourth = (await service.save(patient, input, replacement)).memory;
    operations.length = 0;
    assert.equal((await service.remove(patient, fourth.id)).cleanupFailed, false);
    assert.deepEqual(operations, ['db-delete', 'file-delete']); assert.ok(!exists(fourth.photoPath));
    failDelete = true;
    await assert.rejects(service.save(patient, { ...input, name: 'Fail DB' }, replacement), error => error.code === 'cleanup');
    assert.deepEqual(await repo.list(patient), []); assert.equal(files().length, 1);
    failDelete = false;
    for (const relative of files()) media.remove(patient, relative.replaceAll(path.sep, '/'));
    const concurrent = (await service.save(patient, input, replacement)).memory;
    const updates = await Promise.all([service.save(patient, input, replacement, concurrent.id), service.save(patient, changed, replacement, concurrent.id)]);
    assert.deepEqual(await repo.get(patient, concurrent.id), updates[1].memory);
    assert.ok(!exists(updates[0].memory.photoPath)); assert.ok(exists(updates[1].memory.photoPath));
    await service.save(patient, changed, { kind: 'remove' }, concurrent.id); assert.deepEqual(files(), []);
    await service.remove(patient, concurrent.id);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
    assert.deepEqual(await snapshot(), before);
    console.log('PASS: create/replace rollback, commit-before-cleanup, remove-photo/remove-memory failures, serialized replacement, no unrelated data changes');
    // Fresh-install path uses the same production migration runner too.
    sqlite.close(); sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
    await runMigrations(db); await runMigrations(db);
    assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length, 9);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
    console.log('PASS: fresh migration chain. Expo Android ImagePicker/FileSystem: NOT NATIVE VERIFIED.');
  } finally {
    sqlite?.close();
    const resolved = path.resolve(root), temp = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), temp); assert.ok(path.basename(resolved).startsWith('smaran-memories-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
