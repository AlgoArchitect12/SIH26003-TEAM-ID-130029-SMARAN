const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./check-elderly-ux.cjs');

async function architectureChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-cognitive-'));
  let sqlite, inject = null;
  const queries = [];
  const open = () => {
    sqlite = new DatabaseSync(path.join(root, 'qa.sqlite'));
    sqlite.exec('PRAGMA foreign_keys = ON');
  };
  open();
  const db = {
    execAsync: async sql => {
      sqlite.exec(sql);
      if (inject === 'migration' && sql.includes('CREATE TABLE cognitive_sessions_expanded')) throw Error('Injected migration failure');
    },
    getFirstAsync: async (sql, ...args) => {
      queries.push({sql, args});
      if (inject === 'readback' && sql.includes('SELECT * FROM cognitive_sessions WHERE patient_id')) throw Error('Injected readback failure');
      const row = sqlite.prepare(sql).get(...args); return row ? { ...row } : null;
    },
    getAllAsync: async (sql, ...args) => {
      queries.push({sql, args});
      return sqlite.prepare(sql).all(...args).map(row => ({ ...row }));
    },
    runAsync: async (sql, ...args) => {
      if (inject === 'model' && sql.includes('INSERT INTO adaptive_model_state')) throw Error('Injected model failure');
      return sqlite.prepare(sql).run(...args);
    },
    withExclusiveTransactionAsync: async work => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await work(db); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  const runner = load('src/db/migrations/index.ts').runMigrations;
  const overrides = { '../client': { getDatabase: async () => db } };
  const cache = new Map();
  const repo = load('src/db/repositories/cognitive.repository.ts', overrides, cache).cognitiveRepository;
  const { createInitialAdaptiveModel, recommendDifficulty } = load('src/ai/adaptive-engine.ts');
  const { extractAdaptiveFeatures } = load('src/ai/feature-extractor.ts');
  const { updateModelFromOptionalFeedback } = load('src/ai/online-trainer.ts');
  const { CognitiveActivityTypes } = load('src/db/schema.types.ts');
  const now = '2026-09-07T09:00:00.000Z';
  const table = name => sqlite.prepare('SELECT * FROM ' + name + ' ORDER BY 1').all().map(row => ({...row}));
  try {
    // Apply the actual historical migrations to create a populated 001–005 upgrade fixture.
    sqlite.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)');
    const entries = [
      ['001_core_bootstrap','coreBootstrapMigration'], ['002_cognitive_adaptation','cognitiveAdaptationMigration'],
      ['003_multilingual_expansion','multilingualExpansionMigration'], ['004_my_day','myDayMigration'], ['005_my_memories','myMemoriesMigration'],
    ];
    for (const [file, name] of entries) {
      const migration = load('src/db/migrations/' + file + '.ts')[name];
      await db.withExclusiveTransactionAsync(async tx => {
        await migration.up(tx); await tx.runAsync('INSERT INTO schema_migrations VALUES(?,?,?)', migration.version, migration.name, now);
      });
    }
    for (const id of ['one','two']) await db.runAsync('INSERT INTO patient_profiles(id,preferred_name,created_at,updated_at) VALUES(?,?,?,?)', id,id,now,now);
    for (let index = 0; index < 8; index++) {
      const owner = index % 2 ? 'one' : 'two', pairs = 2 + index % 4, attempts = pairs + 3;
      await db.runAsync(`INSERT INTO cognitive_sessions(id,patient_id,game_type,difficulty,started_at,completed_at,total_pairs,attempts,matches,hints_used,repeated_mistakes,avg_response_ms,accuracy,feedback_label,recommended_difficulty,is_demo_seed,created_at)
        VALUES(?,?,'memory_match',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      'old-' + index, owner, 1 + index % 5, now, now, pairs, attempts, pairs, index, 2, 1234.567 + index, pairs / attempts, [null,'easy','comfortable','challenging'][index % 4], 1 + index % 5, index % 2, now);
    }
    await db.runAsync('INSERT INTO adaptive_model_state VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)', 'one', -1.7, 1.2, .6, .8, .9, .4, 8, now);
    await db.runAsync('INSERT INTO adaptive_model_state VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)', 'two', -1.2, .8, .1, 1.1, .5, -.2, 21, now);
    const oldSessions = table('cognitive_sessions'), oldModels = table('adaptive_model_state');
    const oldSchema = sqlite.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all();
    for (const name of tableNames()) {
      const inbound = sqlite.prepare('PRAGMA foreign_key_list(' + name + ')').all();
      assert.ok(inbound.every(fk => !['cognitive_sessions','adaptive_model_state'].includes(fk.table)), 'no inbound cognitive FK');
    }
    inject = 'migration';
    await assert.rejects(runner(db), /Injected migration failure/);
    assert.deepEqual(table('cognitive_sessions'), oldSessions);
    assert.deepEqual(table('adaptive_model_state'), oldModels);
    assert.deepEqual(sqlite.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all(), oldSchema);
    assert.equal(table('schema_migrations').length, 5);
    inject = null;
    // Expo's exclusive transaction uses a separate connection; validate FK integrity even if that connection defaults OFF.
    sqlite.exec('PRAGMA foreign_keys = OFF');
    await db.runAsync("INSERT INTO adaptive_model_state VALUES ('orphan',0,1,1,1,1,1,0,'test')");
    await assert.rejects(runner(db), /foreign key validation/);
    assert.equal(table('schema_migrations').length,5);
    assert.deepEqual(sqlite.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all(), oldSchema);
    await db.runAsync("DELETE FROM adaptive_model_state WHERE patient_id = 'orphan'");
    sqlite.exec('PRAGMA foreign_keys = ON');
    await runner(db);
    const stripAdded = row => Object.fromEntries(Object.keys(oldSessions[0]).map(key => [key,row[key]]));
    assert.deepEqual(table('cognitive_sessions').map(stripAdded), oldSessions, 'EVERY historical session field preserved');
    assert.deepEqual(table('adaptive_model_state'), oldModels.map(row => ({ ...row, game_type: 'memory_match' })), 'EVERY historical model field preserved');
    const migrated = [table('cognitive_sessions'),table('adaptive_model_state'),table('schema_migrations')];
    await runner(db);
    assert.deepEqual([table('cognitive_sessions'),table('adaptive_model_state'),table('schema_migrations')], migrated);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
    assert.equal((await db.getFirstAsync('PRAGMA integrity_check')).integrity_check, 'ok');
    assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
    const indexes = (await db.getAllAsync("PRAGMA index_list('cognitive_sessions')")).map(row => row.name);
    assert.ok(indexes.includes('idx_cognitive_sessions_patient_completed'));
    assert.ok(indexes.includes('idx_cognitive_sessions_patient_game_completed'));
    assert.deepEqual((await db.getAllAsync("PRAGMA index_info('idx_cognitive_sessions_patient_game_completed')")).map(row=>row.name), ['patient_id','game_type','completed_at']);
    assert.deepEqual((await db.getAllAsync("PRAGMA table_info('adaptive_model_state')")).filter(row=>row.pk).map(row=>[row.name,row.pk]), [['patient_id',1],['game_type',2]]);
    await assert.rejects(db.runAsync("INSERT INTO adaptive_model_state VALUES ('one','unknown',0,1,1,1,1,1,0,'test')"), /CHECK/);
    await assert.rejects(db.runAsync("INSERT INTO adaptive_model_state VALUES ('one','memory_match',0,1,1,1,1,1,0,'test')"), /UNIQUE/);

    const input = gameType => ({
      patientId: 'one', gameType, difficulty: 1, recommendedDifficulty: 2, startedAt: now, completedAt: now,
      attempts: 5, accuracy: .6, hintsUsed: 1, averageResponseMs: 1000, feedbackLabel: null,
      ...(gameType === 'memory_match' ? { totalPairs: 3, matches: 3, repeatedMistakes: 1 } :
        ['pattern_recognition','familiar_object','picture_recall'].includes(gameType) ? { challengesCompleted: 3, correctSelections: 3, repeatedErrors: 1 } :
        gameType === 'remember_lights' || gameType === 'number_path' ? { stepsCompleted: gameType === 'remember_lights' ? 4 : 5,
          correctSelections: gameType === 'remember_lights' ? 4 : 5, repeatedErrors: 1, attempts: 7, accuracy: (gameType === 'remember_lights' ? 4 : 5) / 7 } :
        { stepsCompleted: 3, correctSelections: 3, repeatedErrors: 1 }),
    });
    const modelsBefore = table('adaptive_model_state');
    for (const game of CognitiveActivityTypes) {
      if (game !== 'memory_match') assert.equal(await repo.getAdaptiveModel('one', game), null, 'no fake learned model');
      const previous = table('adaptive_model_state').filter(row => row.patient_id !== 'one' || row.game_type !== game);
      const model = createInitialAdaptiveModel('one', game);
      const trained = updateModelFromOptionalFeedback(model, {accuracy:.8,relativePace:.5,workingMemory:.7,independence:.8,stability:.5}, 'easy', now);
      const saved = await repo.saveCompletedSession(input(game), trained);
      assert.equal(saved.gameType, game);
      assert.deepEqual(table('adaptive_model_state').filter(row => row.patient_id !== 'one' || row.game_type !== game), previous);
      assert.equal((await repo.getAdaptiveModel('one', game)).sampleCount, 1);
      assert.equal((await repo.getSessionById('one', saved.id)).id, saved.id);
      assert.equal(await repo.getSessionById('two', saved.id), null);
      assert.ok((await repo.getRecentSessions('one', 50, game)).every(row => row.gameType === game && !row.isDemoSeed && row.patientId === 'one'));
      if (game !== 'memory_match') assert.ok(!('totalPairs' in saved) && !('matches' in saved) && !('repeatedMistakes' in saved));
      const telemetry = load('src/games/telemetry.ts').sessionTelemetry(saved);
      const extraction = extractAdaptiveFeatures({patientId:'one',currentDifficulty:1,recentSessions:[],telemetry});
      const unrelated = [
        { ...saved, patientId:'two', averageResponseMs:1 },
        { ...saved, isDemoSeed:true, averageResponseMs:1 },
        ...CognitiveActivityTypes.filter(type => type !== game).map(type => ({...saved,gameType:type,averageResponseMs:1})),
      ];
      assert.deepEqual(extractAdaptiveFeatures({patientId:'one',currentDifficulty:1,recentSessions:unrelated,telemetry}), extraction);
      assert.equal(updateModelFromOptionalFeedback(trained, extraction.features, null, 'later'), trained, 'skip does not train');
      for (const level of [1,2,3,4,5]) for (const feature of [0,.25,.5,.75,1]) {
        const value = recommendDifficulty(level,{accuracy:feature,relativePace:feature,workingMemory:feature,independence:feature,stability:feature},model).recommendedDifficulty;
        assert.ok(value >= 1 && value <= 5 && Math.abs(value-level) <= 1);
      }
    }
    assert.deepEqual(table('adaptive_model_state').filter(row => row.patient_id === 'two'), modelsBefore.filter(row => row.patient_id === 'two'));
    await assert.rejects(repo.saveCompletedSession(input('pattern_recognition'), createInitialAdaptiveModel('one','routine_recall')));
    await assert.rejects(repo.saveCompletedSession(input('pattern_recognition'), createInitialAdaptiveModel('two','pattern_recognition')));
    for (const field of [{gameType:'invalid'}, {correctSelections:2}, {repeatedErrors:4}, {accuracy:.8}, {challengesCompleted:0}, {attempts:4.5}, {hintsUsed:-1}, {recommendedDifficulty:5}, {startedAt:'bad'}]) {
      await assert.rejects(repo.saveCompletedSession({...input('pattern_recognition'),...field}));
    }
    for (const fault of ['model', 'readback']) {
      const before = [table('cognitive_sessions'), table('adaptive_model_state')];
      inject = fault;
      await assert.rejects(repo.saveCompletedSession(input('pattern_recognition'),createInitialAdaptiveModel('one','pattern_recognition')), /Injected/);
      inject = null;
      assert.deepEqual([table('cognitive_sessions'),table('adaptive_model_state')],before, 'save rollback is atomic');
    }
    sqlite.exec('PRAGMA foreign_keys = OFF');
    await assert.rejects(repo.saveCompletedSession({...input('routine_recall'),patientId:'absent'}), /patient does not exist/);
    sqlite.exec('PRAGMA foreign_keys = ON');
    // Exercise the SQL constraints directly, beyond repository guards.
    const valid = table('cognitive_sessions').find(row => row.game_type === 'pattern_recognition');
    const raw = changes => {
      const row = {...valid, id: 'invalid-row', ...changes}, keys = Object.keys(row);
      return db.runAsync('INSERT INTO cognitive_sessions(' + keys.join(',') + ') VALUES(' + keys.map(()=>'?').join(',') + ')', ...keys.map(key => row[key]));
    };
    for (const changes of [{game_type:'unknown'}, {total_pairs:3}, {matches:3}, {repeated_mistakes:0},
      {challenges_completed:null}, {correct_selections:null}, {repeated_errors:null}, {challenges_completed:1.5},
      {steps_completed:3}, {difficulty:1.5}, {recommended_difficulty:4}, {attempts:2}, {accuracy:1}, {repeated_errors:8},
      {game_type:'routine_recall',challenges_completed:null,steps_completed:1,correct_selections:1,accuracy:.2}]) await assert.rejects(raw(changes), /CHECK/);
    await assert.rejects(raw({patient_id:'absent'}), /FOREIGN KEY/);
    const beforeReopen = [table('cognitive_sessions'),table('adaptive_model_state')];
    sqlite.close(); open(); await runner(db);
    assert.deepEqual([table('cognitive_sessions'),table('adaptive_model_state')], beforeReopen, 'file reopen persistence');
    const { loadCaregiverDashboard } = load('src/services/caregiver.service.ts',overrides,cache);
    const dashboard = await loadCaregiverDashboard('one', new Date('2026-09-07T12:00:00'));
    assert.equal(dashboard.cognitive.today, 8, 'all eight genuine games; old one-patient rows are demo');
    assert.equal(dashboard.cognitive.recent.length, 3, 'dashboard keeps its latest-three limit');
    assert.ok(dashboard.cognitive.recent.every(row => CognitiveActivityTypes.includes(row.gameType)));
    assert.deepEqual(new Set((await repo.getRecentSessions('one', 50)).map(row=>row.gameType)), new Set(CognitiveActivityTypes));
    assert.equal((await loadCaregiverDashboard('two',new Date('2026-09-07T12:00:00'))).cognitive.today,4);
    queries.length = 0;
    for (const game of CognitiveActivityTypes) {
      await repo.getAdaptiveModel('one',game); await repo.getRecentSessions('one',5,game);
    }
    for (const query of queries) {
      assert.ok(query.args.includes('one')); assert.match(query.sql,/patient_id = \?/);
      if (query.sql.includes('adaptive_model_state')) assert.match(query.sql,/game_type = \?/);
    }
    await assert.rejects(repo.getAdaptiveModel('one','invalid'));
    assert.equal(await repo.getSessionById('one', "x' OR 1=1 --"), null);
    console.log('PASS: 001–005 populated upgrade, exact rows/models, rollback after rebuild, runner idempotence, FK/index integrity, types/constraints, atomic saves, patient/activity isolation, factual caregiver counts and reopen persistence');

    function tableNames() { return sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name); }
    // Separate fresh database runs the real registry 001→007.
    sqlite.close(); sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys = ON');
    await runner(db); await runner(db);
    assert.equal(table('schema_migrations').length, 9);
    assert.equal(table('cognitive_sessions').length, 0); assert.equal(table('adaptive_model_state').length, 0);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
    console.log('PASS: fresh 001–007 chain, idempotence, no seeded activities/models');
  } finally {
    sqlite.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function gameChecks() {
  const { preparePatterns, PatternShapes } = load('src/games/pattern-recognition.ts');
  const { prepareRoutine, Routines } = load('src/games/routine-recall.ts');
  const engine = load('src/games/selection-engine.ts');
  const { extractAdaptiveFeatures } = load('src/ai/feature-extractor.ts');
  const { createInitialAdaptiveModel, recommendDifficulty } = load('src/ai/adaptive-engine.ts');
  const { chooseExplanationTemplate } = load('src/ai/explanation.ts');
  const { activitySummary, activityFacts, activityTitleKeys } = load('src/games/presentation.ts');
  const { completedSessionInput } = load('src/services/cognitive.service.ts', { '../client': {}, './active-patient.service': {} });
  const { t, strings } = load('src/i18n/index.ts');
  for (const bad of [0,6,-1,1.5,NaN]) {
    assert.throws(() => preparePatterns(bad)); assert.throws(() => prepareRoutine(bad));
  }
  for (const level of [1,2,3,4,5]) {
    const patterns = preparePatterns(level);
    assert.deepEqual(preparePatterns(level), patterns, 'deterministic');
    assert.equal(patterns.length, 5);
    for (const task of patterns) {
      assert.ok(task.group.length >= 2 && task.group.length <= 5);
      assert.equal(new Set(task.choices).size, task.choices.length);
      assert.equal(task.choices.filter(choice => choice === task.answer).length, 1);
      assert.equal(task.answer, task.missingIndex === null ? task.group[task.sequence.length % task.group.length] : task.sequence[task.missingIndex]);
      assert.ok(task.sequence.every((shape,index)=>PatternShapes.includes(shape) && shape === task.group[index % task.group.length]));
      assert.equal(task.choices.length, level === 1 ? 2 : level < 4 ? 3 : 4);
    }
    const routine = prepareRoutine(level);
    assert.equal(routine.tasks.length, [2,3,4,4,5][level-1]);
    assert.equal(new Set(routine.routine.steps.map(step=>step.id)).size, routine.tasks.length);
    assert.equal(new Set(routine.routine.steps.map(step=>step.text)).size, routine.tasks.length);
    for (const [index, task] of routine.tasks.entries()) {
      assert.equal(task.answer, routine.routine.steps[index].id);
      assert.deepEqual(new Set(task.choices), new Set(routine.routine.steps.slice(index).map(step=>step.id)));
    }
    for (const [gameType,tasks] of [['pattern_recognition',patterns],['routine_recall',routine.tasks]]) {
      let state = engine.createSelection(tasks,1000);
      assert.throws(()=>engine.finalizeSelection(state,gameType));
      const invalid = engine.chooseSelection(state,tasks,'not-an-option',2000);
      assert.equal(invalid,state);
      for (const [index,task] of tasks.entries()) {
        let now = state.lastDecisionAtMs;
        if (index === 0) {
          const mistake = task.choices.find(choice=>choice !== task.answer);
          state = engine.chooseSelection(state,tasks,mistake,now+=1000);
          assert.equal(state.feedback,'retry');
          state = engine.chooseSelection(state,tasks,mistake,now+=1000);
          assert.equal(state.repeatedErrors,1);
          state = engine.hintSelection(state);
          assert.equal(state.hintLevel,2,'second wrong offers first hint; manual request advances support');
          assert.equal(engine.hintSelection({...state,hintLevel:3}).hintLevel,3,'hint support capped at reveal');
          const resumed = engine.resumeSelection(state,now+60000);
          state = resumed; now += 60000;
        }
        state = engine.chooseSelection(state,tasks,task.answer,now+1000);
        assert.equal(state.correctSelections,index+1);
        assert.equal(state.feedback,'correct');
        assert.equal(engine.chooseSelection(state,tasks,task.answer,now+2000),state,'rapid repeat cannot double count');
        assert.equal(engine.hintSelection(state),state,'no hint after answer');
        if (index < tasks.length-1) {
          assert.throws(()=>engine.finalizeSelection(state,gameType));
          state = engine.continueSelection(state,now+11000);
        }
      }
      const result = engine.finalizeSelection(state,gameType);
      assert.equal(result.attempts,tasks.length+2);
      assert.equal(result.accuracy,tasks.length/(tasks.length+2));
      assert.equal(result.hintsUsed,2); assert.equal(result.repeatedErrors,1);
      assert.equal(result.averageResponseMs,1000,'background/Continue waiting excluded');
      assert.equal(result.correctSelections,tasks.length);
      assert.equal(result[gameType === 'pattern_recognition' ? 'challengesCompleted':'stepsCompleted'],tasks.length);
      assert.equal(engine.continueSelection(state,999999),state,'completed activity cannot advance');
      assert.ok(!('totalPairs' in result) && !('matches' in result));
      const extraction = extractAdaptiveFeatures({telemetry:result,patientId:'one',currentDifficulty:level,recentSessions:[]});
      assert.ok(Object.values(extraction.features).every(value=>Number.isFinite(value) && value>=0 && value<=1));
      const model = createInitialAdaptiveModel('one',gameType);
      const recommendation = recommendDifficulty(level,extraction.features,model);
      const input = completedSessionInput({ telemetry:result,patientId:'one',currentDifficulty:level },null,recommendation.recommendedDifficulty);
      assert.equal(input.feedbackLabel,null); assert.equal(input.gameType,gameType);
      assert.ok(!('totalPairs' in input));
      for (const language of Object.keys(strings)) {
        const title = t(language,activityTitleKeys[gameType]);
        for (const direction of ['hold','challenge','gentler']) {
          const key = chooseExplanationTemplate({...recommendation,direction},{...extraction,hasPersonalBaseline:true},gameType);
          assert.ok(t(language,key,{activity:title}).includes(title));
        }
        assert.ok(activitySummary(language,result).trim());
        assert.ok(activityFacts(language,{...input}).trim());
      }
      assert.doesNotMatch(activityFacts('en',input), /pairs|matching attempts/i);
    }
  }
  assert.doesNotMatch(JSON.stringify(Routines), /medicat|dosage|emergency|medical|stove|fire|financial|payment|boil|heat|knife/i);
  assert.throws(()=>engine.createSelection([{id:'x',answer:'a',choices:['a','a']}],0));
  assert.throws(()=>engine.createSelection([{id:'x',answer:'z',choices:['a','b']}],0));
  // Exact Memory Match feature semantics and first level are preserved.
  const memory = load('src/games/memory-match/telemetry.ts');
  let telemetry = memory.createTelemetry(1000);
  telemetry = memory.recordFirstFlip(telemetry,1500);
  telemetry = memory.recordComparison(telemetry,['home','leaf'],false,2000);
  telemetry = memory.recordComparison(telemetry,['leaf','home'],false,3000);
  telemetry = memory.recordHint(telemetry);
  telemetry = memory.recordComparison(telemetry,['home','home'],true,4000);
  telemetry = memory.recordComparison(telemetry,['leaf','leaf'],true,5000);
  const value = memory.finalizeTelemetry(telemetry,2,5000);
  assert.deepEqual(value,{gameType:'memory_match',accuracy:.5,attempts:4,averageResponseMs:1000,completedAtMs:5000,hintsUsed:1,idleTimeBeforeFirstFlipMs:500,matches:2,repeatedMistakes:1,startedAtMs:1000,totalPairs:2});
  const baseline = {patientId:'one',gameType:'memory_match',isDemoSeed:false,totalPairs:2,averageResponseMs:1000,accuracy:.5};
  const extraction = extractAdaptiveFeatures({patientId:'one',currentDifficulty:1,telemetry:value,recentSessions:[baseline]});
  assert.deepEqual(extraction.features,{accuracy:.5,relativePace:.5,workingMemory:.75,independence:.5,stability:.5});
  assert.equal(extraction.personalPaceBaselineMs,1000/Math.sqrt(2));
  assert.equal(load('src/games/memory-match/difficulty.ts').INITIAL_MEMORY_DIFFICULTY,2);
  assert.equal(chooseExplanationTemplate({direction:'challenge'},extraction,'memory_match'),'explanationAddChallenge');
  assert.match(activitySummary('en',value),/2 pairs/);

  const { cognitiveStrings } = load('src/i18n/cognitive-strings.ts');
  const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
  for (const [language,catalog] of Object.entries(cognitiveStrings)) {
    assert.deepEqual(Object.keys(catalog).sort(),Object.keys(cognitiveStrings.en).sort());
    for (const [key,text] of Object.entries(catalog)) {
      assert.ok(text.trim()); assert.deepEqual(slots(text),slots(cognitiveStrings.en[key]),language+'.'+key);
    }
  }
  const production = ['src/games/selection-engine.ts','src/games/pattern-recognition.ts','src/games/routine-recall.ts',
    'components/games/selection-activity-screen.tsx','app/patient/games/index.tsx','app/patient/games/result.tsx',
    'app/patient/games/why-level.tsx','src/services/cognitive.service.ts','src/games/presentation.ts'];
  for (const file of production) {
    const text = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.doesNotMatch(text,/\b(fetch|axios|supabase|firebase|Bhashini|setInterval)\b/);
    assert.doesNotMatch(text,/dementia score|severity|progression|deterioration|cognitive health|memory strength|too slow|wrong!/i);
    assert.doesNotMatch(text,/\bany\b/);
  }
  for (const file of ['app/patient/games/result.tsx', 'app/patient/games/why-level.tsx']) {
    const screen = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(screen, /if \(!focused\) return;/, 'inactive result must not redirect the next activity');
  }
  const ui = fs.readFileSync(path.join(__dirname,'../components/games/selection-activity-screen.tsx'),'utf8');
  assert.match(ui,/recommendedDifficulty \?\? 1/);
  assert.match(ui,/speechLanguage="en"/); assert.match(ui,/routineEnglish/);
  assert.match(ui,/SelectionState \| null/); assert.doesNotMatch(ui,/setTimeout|setInterval/);
  console.log('PASS: Pattern/Routine all levels, unique choices/sequence, retry/hints/timing/accuracy/repeated errors, completion guard, bounds, first levels, Memory Match feature parity, result/Why labels, seven-language parity, routine safety and offline/no-fake-data scans');
}

async function main() { await architectureChecks(); gameChecks(); }
module.exports = { architectureChecks };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
