const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { load } = require('./check-elderly-ux.cjs');
const stamp = '2026-09-12T00:00:00.000Z';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const history = [
  ['001_core_bootstrap','coreBootstrapMigration'], ['002_cognitive_adaptation','cognitiveAdaptationMigration'],
  ['003_multilingual_expansion','multilingualExpansionMigration'], ['004_my_day','myDayMigration'],
  ['005_my_memories','myMemoriesMigration'], ['006_cognitive_expansion','cognitiveExpansionMigration'],
  ['007_cognitive_ai_expansion','cognitiveAIExpansionMigration'],
];
function createDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = {
    fault: null,
    execAsync: async sql => { sqlite.exec(sql); if (db.fault && sql.includes(db.fault)) throw Error('Injected SQL failure'); },
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => { const result = sqlite.prepare(sql).run(...args); if (db.fault && sql.includes(db.fault)) throw Error('Injected SQL failure'); return result; },
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db };
}
async function pre8(db) {
  await db.execAsync('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,applied_at TEXT NOT NULL)');
  for (const [file,key] of history) {
    const migration = load('src/db/migrations/' + file + '.ts')[key];
    await db.withExclusiveTransactionAsync(async tx => { await migration.up(tx); await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)',migration.version,migration.name,stamp); });
  }
}
async function seed(db) {
  const overrides = { '../client': { getDatabase: async () => db } };
  const patient = load('src/db/repositories/patient.repository.ts', overrides).patientRepository;
  const reminders = load('src/db/repositories/my-day.repository.ts', overrides).myDayRepository;
  const memories = load('src/db/repositories/memories.repository.ts', overrides).memoriesRepository;
  const cognitive = load('src/db/repositories/cognitive.repository.ts', overrides).cognitiveRepository;
  const model = load('src/ai/adaptive-engine.ts').createInitialAdaptiveModel;
  const { localDay } = load('src/my-day/types.ts');
  for (const id of ['one','two']) {
    await patient.upsertProfileWithSettings({ id, preferredName: id, emergencyName: 'Synthetic contact' }, { language: 'hi', voiceGuidance: false });
    await memories.save(id,{ name: 'Synthetic memory', relationship: 'Family', description: 'Text survives' },`memories/${id}/${'a'.repeat(32)}.jpg`);
    const reminder = await reminders.save(id,{ type: 'hydration', title: 'Water', note: '', timeOfDay: '08:00', repeatRule: 'daily', scheduledDate: null });
    await reminders.complete(id,reminder.id,localDay());
    await cognitive.saveCompletedSession({ patientId:id, gameType:'memory_match', difficulty:2, startedAt:stamp, completedAt:stamp,
      totalPairs:2, attempts:3, matches:2, hintsUsed:1, repeatedMistakes:0, averageResponseMs:1234.5, accuracy:2/3,
      feedbackLabel:null, recommendedDifficulty:2 },{...model(id,'memory_match'),updatedAt:stamp});
  }
  return { patient, reminders, memories, cognitive };
}
async function main() {
  for (const [file] of history) {
    const name = `src/db/migrations/${file}.ts`;
    const baseline = execFileSync('git',['show',`58e7938:${name}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
    assert.equal(fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n'),baseline,name + ' byte content unchanged');
  }
  const {sqlite,db} = createDatabase();
  try {
    await pre8(db); await seed(db);
    sqlite.exec('CREATE INDEX qa_preserved ON personal_memories(name DESC) WHERE photo_path IS NOT NULL');
    const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(r=>r.name);
    const rows = table => sqlite.prepare(`SELECT rowid AS saved_rowid,* FROM ${table} ORDER BY rowid`).all();
    const schema = () => sqlite.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name').all();
    const before = Object.fromEntries(tables.map(table=>[table,rows(table)]));
    const oldSchema = schema();
    const fks = Object.fromEntries(tables.map(table=>[table,sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all()]));
    const run = load('src/db/migrations/index.ts').runMigrations;
    for (const fault of ['CREATE TABLE sync_outbox','CREATE TRIGGER sync_validate_reminders','CREATE TRIGGER sync_initial_snapshot','INSERT INTO schema_migrations']) {
      db.fault = fault;
      await assert.rejects(run(db),/Injected/);
      assert.deepEqual(schema(),oldSchema,'rollback entire schema');
      for (const table of tables) assert.deepEqual(rows(table),before[table],'rollback rows '+table);
    }
    db.fault = null;
    await run(db); await run(db);
    for (const table of tables) {
      if (table === 'schema_migrations') assert.deepEqual(rows(table).slice(0,7),before[table]);
      else assert.deepEqual(rows(table),before[table],'every row/field/rowid '+table);
      assert.deepEqual(sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all(),fks[table]);
    }
    for (const item of oldSchema) assert.deepEqual(schema().find(r=>r.name===item.name),item,'preserved schema '+item.name);
    assert.equal(rows('schema_migrations').length,8);
    assert.equal(rows('sync_outbox').length,0,'local-only migration does not enqueue');
    const repo = load('src/db/repositories/sync.repository.ts',{'../client':{getDatabase:async()=>db}}).syncRepository;
    await repo.link(A,()=>true);
    assert.equal(rows('sync_outbox').length,14,'seven structured records per patient');
    const snapshot = rows('sync_outbox');
    await repo.link(A,()=>true);
    assert.deepEqual(rows('sync_outbox'),snapshot,'bootstrap exactly once');
    const event = snapshot[0];
    const insert = change => {
      const e = {...event,mutation_id:'f'.repeat(32),...change};
      return sqlite.prepare('INSERT INTO sync_outbox(mutation_id,owner_id,patient_id,entity_type,entity_id,operation,payload,attempts,state) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(e.mutation_id,e.owner_id,e.patient_id,e.entity_type,e.entity_id,e.operation,e.payload,e.attempts,e.state);
    };
    for (const change of [{mutation_id:'bad'}, {owner_id:B}, {patient_id:'missing'}, {entity_type:'tokens'}, {entity_id:''},
      {operation:'sql'}, {payload:'invalid'}, {payload:'[]'}, {payload:'{}'}, {payload:JSON.stringify({...JSON.parse(event.payload),photo_path:'private'})},
      {attempts:-1}, {attempts:9}, {state:'done'}, {operation:'delete'}]) assert.throws(()=>insert(change));
    assert.throws(()=>sqlite.prepare('UPDATE sync_outbox SET owner_id=?').run(B),/immutable/);
    assert.equal(new Set(rows('sync_outbox').map(r=>r.mutation_id)).size,14);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  } finally { sqlite.close(); }
  for (const foreignKeys of [0,1]) {
    const {sqlite,db}=createDatabase();
    try { sqlite.exec(`PRAGMA foreign_keys=${foreignKeys}`); await load('src/db/migrations/index.ts').runMigrations(db);
      assert.equal(sqlite.prepare('SELECT count(*) n FROM schema_migrations').get().n,8);
      assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    } finally { sqlite.close(); }
  }
  console.log('PASS migration 008: populated seven-table preservation, all rows/rowids/indexes/FKs, four rollback points, 001–007 unchanged, fresh FK on/off, bootstrap idempotence, malformed-event rejection.');
}
module.exports = { createDatabase, pre8, seed, A, B, stamp };
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
