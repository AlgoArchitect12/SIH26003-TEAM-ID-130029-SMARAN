const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./check-elderly-ux.cjs');

const games = ['memory_match', 'pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall'];
const stamp = '2026-09-10T09:00:00.000Z';

// Real SQLite behind the Expo async boundary; the production runner owns BEGIN/COMMIT.
function createDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = {
    fault: null,
    execAsync: async (sql, ...args) => {
      const statements = db.fault && sql.includes('CREATE TABLE cognitive_sessions_v7') ? sql.split(';') : [sql];
      for (const statement of statements.filter(value => value.trim())) {
        sqlite.exec(statement);
        if (db.fault && statement.includes(db.fault)) throw Error('Injected migration failure');
      }
    },
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => {
      const result = sqlite.prepare(sql).run(...args);
      if (db.fault === 'register' && sql.includes('INSERT INTO schema_migrations')) throw Error('Injected registration failure');
      return result;
    },
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db };
}

function rowFor(game, id, patient = 'one', level = 2) {
  return {
    id, patient_id: patient, game_type: game, difficulty: level, started_at: stamp,
    completed_at: '2026-09-10T09:02:03.456Z', total_pairs: null, attempts: 5, matches: null,
    hints_used: 2, repeated_mistakes: null, avg_response_ms: 1234.56789,
    accuracy: .6, feedback_label: 'comfortable', recommended_difficulty: level,
    is_demo_seed: 0, created_at: '2026-09-10T09:03:04.567Z',
    challenges_completed: null, steps_completed: null, correct_selections: 3, repeated_errors: 1,
    ...(game === 'memory_match' ? { total_pairs: 3, matches: 3, repeated_mistakes: 1, correct_selections: null, repeated_errors: null }
      : ['routine_recall', 'sequence_memory'].includes(game) ? { steps_completed: 3 } : { challenges_completed: 3 }),
  };
}

function insertRow(sqlite, table, row) {
  const keys = Object.keys(row);
  return sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
}

async function main() {
  const { sqlite, db } = createDatabase();
  const runner = load('src/db/migrations/index.ts').runMigrations;
  const rows = table => sqlite.prepare(`SELECT rowid AS preserved_rowid, * FROM ${table} ORDER BY rowid`).all();
  const schema = () => sqlite.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY name').all();
  try {
    sqlite.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)');
    const history = [
      ['001_core_bootstrap', 'coreBootstrapMigration'], ['002_cognitive_adaptation', 'cognitiveAdaptationMigration'],
      ['003_multilingual_expansion', 'multilingualExpansionMigration'], ['004_my_day', 'myDayMigration'],
      ['005_my_memories', 'myMemoriesMigration'], ['006_cognitive_expansion', 'cognitiveExpansionMigration'],
    ];
    for (const [file, name] of history) {
      const migration = load(`src/db/migrations/${file}.ts`)[name];
      await db.withExclusiveTransactionAsync(async tx => {
        await migration.up(tx);
        await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)', migration.version, migration.name, stamp);
      });
    }
    for (const patient of ['one', 'two']) {
      insertRow(sqlite, 'patient_profiles', { id: patient, preferred_name: patient, created_at: stamp, updated_at: stamp });
      for (const [index, game] of games.slice(0, 3).entries()) {
        for (let level = 1; level <= 5; level++) {
          insertRow(sqlite, 'cognitive_sessions', { ...rowFor(game, `${patient}-${game}-${level}`, patient, level),
            rowid: (patient === 'one' ? 100 : 200) + index * 10 + level,
            hints_used: level, feedback_label: [null, 'easy', 'comfortable', 'challenging', null][level - 1],
            is_demo_seed: level === 5 ? 1 : 0 });
        }
        insertRow(sqlite, 'adaptive_model_state', {
          patient_id: patient, game_type: game, bias: -1.234 + index, weight_accuracy: .876 + index,
          weight_pace: -.12, weight_memory: 1.789, weight_hints: .555, weight_stability: -.333,
          sample_count: 7 + index, updated_at: '2026-09-09T07:08:09.123Z',
        });
      }
    }
    // Preserve all named indexes, not just the two currently shipped ones.
    sqlite.exec('CREATE INDEX qa_extra_session ON cognitive_sessions(accuracy DESC) WHERE is_demo_seed = 0');
    sqlite.exec('CREATE INDEX qa_extra_model ON adaptive_model_state(updated_at DESC)');
    const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all().map(row => row.name);
    for (const table of tables) {
      assert.ok(sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all().every(fk =>
        !['cognitive_sessions', 'adaptive_model_state'].includes(fk.table)), 'no inbound FK before rebuild');
    }
    const before = Object.fromEntries(tables.map(table => [table, rows(table)]));
    const oldSchema = schema();
    const indexes = () => schema().filter(row => row.type === 'index' && tables.includes(row.tbl_name));
    const oldIndexes = indexes();
    const foreignKeys = () => ['cognitive_sessions', 'adaptive_model_state'].map(table => sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all());
    const oldForeignKeys = foreignKeys();
    for (const game of games.slice(3)) assert.throws(() => insertRow(sqlite, 'cognitive_sessions', rowFor(game, 'pre-007')), /CHECK/);
    for (const fault of ['DROP TABLE cognitive_sessions', 'ALTER TABLE cognitive_sessions_v7', 'DROP TABLE adaptive_model_state',
      'ALTER TABLE adaptive_model_state_v7', 'CREATE INDEX', 'register']) {
      db.fault = fault;
      await assert.rejects(runner(db), /Injected/);
      assert.deepEqual(schema(), oldSchema, 'full schema rollback at ' + fault);
      for (const table of tables) assert.deepEqual(rows(table), before[table], 'full data rollback at ' + fault);
    }
    db.fault = null;
    // Expo can use a separate connection with FK enforcement OFF. The migration
    // must still detect an existing orphan and roll back instead of blessing it.
    sqlite.exec('PRAGMA foreign_keys = OFF');
    insertRow(sqlite, 'cognitive_sessions', rowFor('pattern_recognition', 'orphan', 'missing'));
    await assert.rejects(runner(db), /foreign key validation/);
    assert.deepEqual(schema(), oldSchema);
    sqlite.exec("DELETE FROM cognitive_sessions WHERE id = 'orphan'");
    sqlite.exec('PRAGMA foreign_keys = ON');

    await runner(db);
    for (const table of tables.filter(name => name !== 'schema_migrations')) assert.deepEqual(rows(table), before[table], 'EVERY old field and rowid: ' + table);
    assert.deepEqual(indexes(), oldIndexes, 'exact index SQL, order, partial clauses and primary-key autoindexes');
    assert.deepEqual(foreignKeys(), oldForeignKeys);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(sqlite.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(rows('schema_migrations').length, 13);
    const latest = rows('schema_migrations').slice(-1)[0];
    assert.strictEqual(latest.version, 13);
    assert.strictEqual(latest.name, 'report_delivery');
    const after = schema();
    await runner(db);
    assert.deepEqual(schema(), after);
    assert.deepEqual(rows('cognitive_sessions'), before.cognitive_sessions);
    assert.deepEqual(rows('adaptive_model_state'), before.adaptive_model_state);

    for (const game of games) {
      insertRow(sqlite, 'cognitive_sessions', rowFor(game, 'new-' + game));
      sqlite.prepare('INSERT OR REPLACE INTO adaptive_model_state VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run('one', game, -1, 1, .5, .5, .5, .5, 0, stamp);
      assert.throws(() => insertRow(sqlite, 'cognitive_sessions', rowFor(game, 'bad-fk', 'missing')), /FOREIGN KEY/);
      const base = rowFor(game, 'bad');
      const commonInvalid = [{ game_type: 'unknown' }, { attempts: 0 }, { hints_used: -1 }, { avg_response_ms: -1 },
        { avg_response_ms: null }, { accuracy: 1.1 }, { difficulty: 0 }, { recommended_difficulty: 6 }, { feedback_label: 'diagnosis' }];
      const metricInvalid = game === 'memory_match' ? [{ matches: 2 }, { repeated_mistakes: 3 }, { correct_selections: 3 }, { total_pairs: null }]
        : [{ total_pairs: 3 }, { matches: 3 }, { repeated_mistakes: 0 }, { attempts: 1.5 }, { hints_used: .5 },
          { correct_selections: null }, { correct_selections: 0 }, { correct_selections: 6 }, { repeated_errors: null },
          { repeated_errors: 3 }, { accuracy: .9 }, { difficulty: 1.5 }, { recommended_difficulty: 5 },
          ...(base.steps_completed === null ? [{ challenges_completed: null }, { challenges_completed: 2 }, { steps_completed: 3 }]
            : [{ steps_completed: null }, { steps_completed: 1 }, { steps_completed: 7 }, { challenges_completed: 3 }])];
      for (const change of [...commonInvalid, ...metricInvalid]) {
        assert.throws(() => insertRow(sqlite, 'cognitive_sessions', { ...base, ...change }), /CHECK|NOT NULL/, `${game} rejects ${JSON.stringify(change)}`);
      }
    }
    assert.throws(() => sqlite.exec("INSERT INTO adaptive_model_state VALUES('one','unknown',0,1,1,1,1,1,0,'x')"), /CHECK/);
    assert.throws(() => sqlite.exec("INSERT INTO adaptive_model_state VALUES('one','memory_match',0,1,1,1,1,1,0,'x')"), /UNIQUE/);
    assert.throws(() => sqlite.exec("INSERT INTO adaptive_model_state VALUES('missing','memory_match',0,1,1,1,1,1,0,'x')"), /FOREIGN KEY/);
    insertRow(sqlite, 'cognitive_sessions', { ...rowFor('sequence_memory', 'six-steps'), steps_completed: 6, correct_selections: 6, attempts: 8, accuracy: .75 });
    const two = [rows('cognitive_sessions').filter(row => row.patient_id === 'two'), rows('adaptive_model_state').filter(row => row.patient_id === 'two')];
    sqlite.exec("DELETE FROM patient_profiles WHERE id = 'one'");
    assert.deepEqual(rows('cognitive_sessions'), two[0], 'cascade affects only deleted patient sessions');
    assert.deepEqual(rows('adaptive_model_state'), two[1], 'cascade affects only deleted patient models');
    console.log('PASS: populated 001–006 → 007: exact 30 sessions, six models, all fields/IDs/rowids, indexes, FK semantics, six rollback points, idempotence, six game IDs, invalid metrics/types');
  } finally { sqlite.close(); }
  for (const foreignKeys of [0, 1]) {
    const fresh = createDatabase();
    try {
      fresh.sqlite.exec(`PRAGMA foreign_keys = ${foreignKeys}`);
      await runner(fresh.db); await runner(fresh.db);
      assert.equal(fresh.sqlite.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 13);
      assert.equal(fresh.sqlite.prepare('SELECT COUNT(*) AS n FROM cognitive_sessions').get().n, 0);
      assert.equal(fresh.sqlite.prepare('SELECT COUNT(*) AS n FROM adaptive_model_state').get().n, 0);
      assert.deepEqual(fresh.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(fresh.sqlite.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.equal(fresh.sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, foreignKeys);
    } finally { fresh.sqlite.close(); }
  }
  console.log('PASS: actual fresh 001–007 registry with FK ON/OFF, repeat runner, no seed data');
}

module.exports = { createDatabase, rowFor, insertRow, games, stamp };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
