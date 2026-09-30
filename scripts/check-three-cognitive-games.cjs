const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { createDatabase, seed, A, stamp } = require('./check-auth-sync-migration.cjs');
const { insertRow, rowFor } = require('./check-cognitive-migration.cjs');
const engine = load('src/games/selection-engine.ts');
const sudoku = load('src/games/sudoku-lite.ts');
const chess = load('src/games/chess-puzzle.ts');
const words = load('src/games/word-match.ts');
const { CognitiveActivityTypes: games, Languages, Regions } = load('src/db/schema.types.ts');
const { strings, t } = load('src/i18n/index.ts');
const extra = ['sudoku_lite', 'chess_puzzle', 'word_match'];
const expected = { sudoku_lite: [3,6,8,12,16], chess_puzzle: [6,4,4,3,3], word_match: [3,4,4,5,6] };
const tick = () => new Promise(setImmediate);
const seeded = (seed = 123) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function prepare(gameType, level, random = seeded()) {
  if (gameType === 'sudoku_lite') { const value = sudoku.prepareSudoku(level, random); return { gameType, sudoku: value, tasks: value.tasks }; }
  if (gameType === 'chess_puzzle') { const value = chess.prepareChess(level, random); return { gameType, chess: value, tasks: value }; }
  const value = words.prepareWords(level, 'assam', random); return { gameType, words: value, tasks: value.tasks };
}
let currentPlayTime = Date.parse(stamp);
function play(game, level, wrong = true) {
  const { tasks } = prepare(game, level);
  let now = currentPlayTime, state = engine.createSelection(tasks, now);
  assert.throws(() => engine.finalizeSelection(state, game));
  if (wrong) {
    const mistake = tasks[0].choices.find(c => c !== tasks[0].answer);
    for (const hint of [0, 1, 3]) {
      state = engine.chooseSelection(state, tasks, mistake, now += 1000);
      assert.equal(state.hintLevel, hint); assert.equal(state.position, 0); assert.equal(state.correctSelections, 0);
      assert.equal(state.completedAtMs, null);
    }
    assert.equal(engine.chooseSelection(state, tasks, mistake, now), state);
  }
  for (const [i, task] of tasks.entries()) {
    state = engine.resumeSelection(state, now += 60000);
    state = engine.chooseSelection(state, tasks, task.answer, now += 1000);
    assert.equal(engine.chooseSelection(state, tasks, task.answer, now), state, 'double taps cannot fabricate success');
    if (i < tasks.length - 1) state = engine.continueSelection(state, now += 9000);
  }
  const telemetry = engine.finalizeSelection(state, game);
  assert.equal(telemetry.stepsCompleted, expected[game][level - 1]);
  assert.equal(telemetry.correctSelections, telemetry.stepsCompleted);
  assert.equal(telemetry.attempts, telemetry.stepsCompleted + (wrong ? 3 : 0));
  assert.equal(telemetry.hintsUsed, wrong ? 2 : 0); assert.equal(telemetry.repeatedErrors, wrong ? 2 : 0);
  assert.equal(telemetry.accuracy, telemetry.correctSelections / telemetry.attempts);
  assert.equal(telemetry.averageResponseMs, 1000); assert.ok(telemetry.completedAtMs > telemetry.startedAtMs);
  currentPlayTime = now + 1000;
  return telemetry;
}

// Independent exhaustive solver: does not call the production candidate/validation helpers.
function solutions(puzzle) {
  const b = [...puzzle.clues], n = puzzle.size, w = n / 2;
  let count = 0;
  function visit() {
    if (count > 1) return;
    const i = b.indexOf(0);
    if (i < 0) { assert.deepEqual(b, puzzle.solution); count++; return; }
    const r = Math.floor(i / n), c = i % n;
    for (let v = 1; v <= n; v++) {
      let allowed = true;
      for (let j = 0; j < b.length; j++) if (b[j] === v) {
        const rr = Math.floor(j / n), cc = j % n;
        if (rr === r || cc === c || (Math.floor(rr / 2) === Math.floor(r / 2) && Math.floor(cc / w) === Math.floor(c / w))) allowed = false;
      }
      if (allowed) { b[i] = v; visit(); b[i] = 0; }
    }
  }
  visit(); return count;
}
function contentChecks() {
  assert.equal(games.length, 11); assert.deepEqual(games.slice(-3), extra);
  for (const game of extra) {
    const route = game.replaceAll('_', '-');
    assert.match(fs.readFileSync(`app/patient/games/${route}.tsx`, 'utf8'), new RegExp(`gameType="${game}"`));
    assert.ok(fs.readFileSync('app/patient/games/index.tsx', 'utf8').includes('/patient/games/' + route));
    for (const level of [0, 6, NaN, 1.5]) assert.throws(() => prepare(game, level));
    for (let level = 1; level <= 5; level++) {
      play(game, level); play(game, level, false);
      const activity = prepare(game, level); let state = engine.createSelection(activity.tasks, 0);
      for (const hint of [1,2,3]) { state = engine.hintSelection(state); assert.equal(state.hintLevel, hint); }
      assert.equal(engine.hintSelection(state), state);
    }
  }
  for (let level = 1; level <= 5; level++) {
    const variations = new Set();
    for (let seed = 1; seed <= 24; seed++) {
      const p = sudoku.prepareSudoku(level, seeded(seed));
      assert.equal(p.size, level <= 2 ? 4 : 6); assert.equal(solutions(p), 1);
      assert.equal(p.clues.filter(n => !n).length, expected.sudoku_lite[level - 1]);
      assert.equal(sudoku.validateSudoku(p).length, p.tasks.length);
      variations.add(JSON.stringify(p.clues));
      assert.deepEqual(p, sudoku.prepareSudoku(level, seeded(seed)));
      for (let cell = 0; cell < p.clues.length; cell++) if (p.clues[cell]) assert.ok(!p.tasks.some(task => Number(task.id) === cell), 'fixed clues have no answer task');
    }
    assert.ok(variations.size >= 6, 'several validated variations per difficulty');
    for (const task of chess.prepareChess(level, seeded())) {
      assert.ok(chess.validChessBoard(task.board));
      assert.deepEqual(task.choices.filter(c => chess.isChessAnswer(task, c)), [task.answer]);
      assert.ok(!chess.chessSquareAttacked(task.board, 'a1', 'black'), 'white starts outside check');
      assert.ok(!chess.chessSquareAttacked(task.board, 'h7', 'white'), 'black starts outside check');
      if (level === 1) assert.equal(task.answer, task.board[task.source].kind);
      else assert.ok(chess.isLegalChessMove(task.board, task.source, task.answer));
      if (level === 5) assert.equal(task.choices.filter(c => chess.isLegalChessMove(task.board, task.source, c)).length, 2, 'safe-capture task requires choosing between two legal captures');
    }
    for (const region of Regions) for (const language of Languages) {
      const a = words.prepareWords(level, region, seeded());
      assert.equal(a.pairs.length, expected.word_match[level - 1]);
      assert.equal(a.options.length, a.pairs.length + Number(level === 3));
      assert.equal(new Set(a.pairs.map(p => t(language, p.left))).size, a.pairs.length);
      assert.equal(new Set(a.options.map(p => t(language, p.right))).size, a.options.length);
      for (const p of a.pairs) for (const key of [p.left,p.right,p.hint]) assert.ok(strings[language][key]?.trim());
    }
  }
  const p = sudoku.prepareSudoku(1);
  assert.throws(() => sudoku.validateSudoku({ ...p, solution: Array(16).fill(1) }));
  assert.throws(() => sudoku.validateSudoku({ ...p, clues: Array(16).fill(0) }));
  assert.throws(() => words.prepareWords(1, 'unknown'));
  const base = { a1: { kind: 'king', side: 'white' }, h8: { kind: 'king', side: 'black' } };
  const withPiece = (kind, from, extra = {}) => ({ ...base, [from]: { kind, side: 'white' }, ...extra });
  const black = kind => ({ kind, side: 'black' });
  assert.ok(chess.isLegalChessMove(withPiece('rook','d4'), 'd4','d7'));
  assert.ok(!chess.isLegalChessMove(withPiece('rook','d4',{d5:black('pawn')}), 'd4','d7'));
  assert.ok(!chess.isLegalChessMove(withPiece('rook','d4'), 'd4','e5'));
  assert.ok(chess.isLegalChessMove(withPiece('bishop','d4'), 'd4','f6'));
  assert.ok(!chess.isLegalChessMove(withPiece('bishop','d4',{e5:black('pawn')}), 'd4','f6'));
  assert.ok(chess.isLegalChessMove(withPiece('knight','d4',{d5:black('pawn')}), 'd4','e6'));
  assert.ok(!chess.isLegalChessMove(withPiece('knight','d4'), 'd4','e5'));
  assert.ok(chess.isLegalChessMove(withPiece('pawn','d2'), 'd2','d4'));
  assert.ok(!chess.isLegalChessMove(withPiece('pawn','d2',{d3:black('pawn')}), 'd2','d4'));
  assert.ok(!chess.isLegalChessMove(withPiece('pawn','d4'), 'd4','d3'));
  assert.ok(!chess.isLegalChessMove(withPiece('pawn','d4'), 'd4','e5'));
  assert.ok(chess.isLegalChessMove(withPiece('pawn','d4',{e5:black('pawn')}), 'd4','e5'));
  assert.ok(!chess.isLegalChessMove(withPiece('rook','d4'), 'd4','a1'), 'cannot capture own piece');
  assert.ok(!chess.isLegalChessMove(withPiece('rook','h4'), 'h4','h8'), 'cannot capture king');
  assert.ok(!chess.isLegalChessMove(withPiece('rook','a2',{a7:black('rook')}), 'a2','b2'), 'pinned rook exposes king');
  assert.ok(!chess.isLegalChessMove({ ...base, b8:black('rook') }, 'a1','b1'), 'king cannot enter check');
  for (const s of ['i4','d0','a9','', 'a10']) assert.ok(!chess.isLegalChessMove(base, 'a1', s));
  assert.ok(!chess.validChessBoard({a1:base.a1}));
  const catalog = load('src/i18n/three-game-strings.ts').threeGameStrings;
  const slots = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const language of Languages) {
    assert.deepEqual(Object.keys(catalog[language]), Object.keys(catalog.en));
    for (const [key,value] of Object.entries(catalog[language])) {
      assert.ok(value.trim()); assert.equal(strings[language][key], value); assert.deepEqual(slots(value), slots(catalog.en[key]));
      if (language !== 'en' && /[a-z]/i.test(catalog.en[key].replace(/\{\w+\}/g,''))) assert.notEqual(value, catalog.en[key], 'no English placeholders: '+language+'.'+key);
    }
  }
  console.log('PASS content: 11 games; 120 independently solved unique Sudoku variations; all 5 levels; chess recognition, obstruction, pawn/knight, capture, king safety and two-capture tactics; regional word pairs in 7 languages; coaching and exact telemetry.');
}

function runtime() {
  const r = createDatabase(), cache = new Map(); r.active = 'one';
  r.overrides = { '../client': { getDatabase: async () => r.db }, '../db/client': { getDatabase: async () => r.db },
    './active-patient.service': { resolveActivePatient: async () => ({ status:'ready', profile: await r.patient.getProfileById(r.active), settings: await r.patient.getSettings(r.active) }) } };
  r.module = file => load(file, r.overrides, cache);
  r.patient = r.module('src/db/repositories/patient.repository.ts').patientRepository;
  r.repo = r.module('src/db/repositories/cognitive.repository.ts').cognitiveRepository;
  r.session = r.module('src/stores/patient-session.store.ts');
  r.change = id => { r.active = id; r.session.usePatientSessionStore.setState(s => ({ patientId:id, revision:s.revision+1 })); };
  r.rows = table => r.sqlite.prepare(`SELECT rowid AS saved_rowid,* FROM ${table} ORDER BY rowid`).all();
  r.run = r.module('src/db/migrations/index.ts').runMigrations;
  return r;
}
function pending(r, game, level) {
  const telemetry = play(game,level), ai = r.module('src/ai/adaptive-engine.ts');
  const model = ai.createInitialAdaptiveModel(r.active,game);
  const extraction = r.module('src/ai/feature-extractor.ts').extractAdaptiveFeatures({patientId:r.active,currentDifficulty:level,telemetry,recentSessions:[]});
  return {patientId:r.active,currentDifficulty:level,telemetry,model,extraction,initialRecommendation:ai.recommendDifficulty(level,extraction.features,model)};
}
async function migrationChecks() {
  const r = runtime();
  try {
    // Stop at the next migration boundary using the real production registry/transactions.
    const pre12 = load('src/db/migrations/index.ts', { './012_three_cognitive_games': { threeCognitiveGamesMigration: {
      version:12,name:'three_cognitive_games',up:async () => { throw Error('Stop at 012'); },
    } } }).runMigrations;
    await assert.rejects(pre12(r.db), /Stop at 012/); assert.equal(r.rows('schema_migrations').length,11);
    await seed(r.db);
    for (const id of ['one','two']) for (const game of games.slice(0,8)) {
      const row = rowFor(game,id+'-'+game,id,1);
      if (['remember_lights','number_path'].includes(game)) {
        const n = game === 'remember_lights' ? 4 : 5;
        Object.assign(row,{steps_completed:n,challenges_completed:null,correct_selections:n,attempts:n+2,accuracy:n/(n+2)});
      }
      insertRow(r.sqlite,'cognitive_sessions',row);
      await r.repo.saveCompletedSession({ ...r.module('src/games/telemetry.ts').activityMetrics(await r.repo.getSessionById(id,row.id)),
        patientId:id,difficulty:1,recommendedDifficulty:1,startedAt:stamp,completedAt:stamp,attempts:row.attempts,accuracy:row.accuracy,
        hintsUsed:row.hints_used,averageResponseMs:row.avg_response_ms,feedbackLabel:null },r.module('src/ai/adaptive-engine.ts').createInitialAdaptiveModel(id,game));
    }
    const care = r.module('src/db/repositories/care-circle.repository.ts').careCircleRepository;
    const member = await care.save('one',{display_name:'Synthetic family',relationship:'daughter',access_role:'family',email:'fixture@example.invalid',phone:null,scopes:['reports','cognitive_activity']},()=>true);
    await care.savePreference('one',member.id,'weekly',true,()=>true);
    const facts = (await r.module('src/services/reports.service.ts').loadReportFacts('one',7,new Date(stamp))).facts;
    facts.games = facts.games.slice(0,8);
    const report = await care.saveReport('one',{period_start:'2026-09-06T00:00:00.000Z',period_end:'2026-09-13T00:00:00.000Z',generated_at:stamp,report_version:1,snapshot:JSON.stringify(facts)},()=>true);
    const sync = r.module('src/db/repositories/sync.repository.ts').syncRepository;
    await sync.link(A,()=>true);
    await r.db.runAsync('UPDATE sync_accounts SET pull_cursor=42,last_success_at=? WHERE owner_id=?',stamp,A);
    await r.db.runAsync("UPDATE sync_outbox SET attempts=3,next_attempt_at=12345,last_failure='network'");
    await r.db.runAsync("INSERT INTO sync_versions(owner_id,patient_id,entity_type,entity_id,version) VALUES(?,'one','patient_profiles','one',42)",A);
    r.sqlite.exec("CREATE INDEX three_game_preserve_index ON cognitive_sessions(completed_at DESC) WHERE is_demo_seed=0; CREATE TRIGGER three_game_external AFTER UPDATE ON patient_settings BEGIN SELECT count(*) FROM cognitive_sessions; END;");
    const tables = r.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(row=>row.name);
    const snapshot = () => Object.fromEntries(tables.map(table=>[table,r.rows(table)]));
    const schema = () => r.sqlite.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name').all();
    const before = snapshot(), beforeSchema = schema();
    const fks = Object.fromEntries(tables.map(table=>[table,r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all()]));
    for (const fault of ['DROP TRIGGER','CREATE TABLE cognitive_sessions_v12','CREATE INDEX three_game_preserve_index','CREATE TRIGGER sync_initial_snapshot','INSERT INTO schema_migrations']) {
      r.db.fault = fault; await assert.rejects(r.run(r.db),/Injected/);
      assert.deepEqual(snapshot(),before,'rollback rows at '+fault); assert.deepEqual(schema(),beforeSchema,'rollback schema at '+fault);
    }
    r.db.fault = null;
    const original = r.db.getAllAsync;
    r.db.getAllAsync = async (sql,...args) => sql === 'PRAGMA foreign_key_check' ? [{}] : original(sql,...args);
    await assert.rejects(r.run(r.db),/foreign key/); assert.deepEqual(snapshot(),before); assert.deepEqual(schema(),beforeSchema);
    r.db.getAllAsync = original;
    await r.run(r.db);
    for (const table of tables) {
      const afterRows = table === 'schema_migrations' ? r.rows(table).slice(0,11) : table === 'personal_memories'
        ? r.rows(table).map(({audio_path,...row}) => { assert.equal(audio_path,null); return row; }) : r.rows(table);
      assert.deepEqual(afterRows,table === 'personal_memories' ? before[table].map(row=>({...row})) : before[table],table+' all historical fields/IDs/rowids preserved');
      assert.deepEqual(r.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all(),fks[table],table+' FKs');
    }
    for (const item of beforeSchema.filter(row=>row.type==='index'||row.type==='trigger')) assert.deepEqual(schema().find(row=>row.name===item.name),item);
    const after = snapshot(); await r.run(r.db); assert.deepEqual(snapshot(),after); assert.equal(r.rows('schema_migrations').length, 16);
    assert.equal((await care.report('one',report.id)).snapshot,report.snapshot);
    assert.ok(r.module('src/caregiver/report-presentation.ts').reportSections(report,'en').length);
    for (const game of extra) for (let level=1;level<=5;level++) {
      const input=r.module('src/services/cognitive.service.ts').completedSessionInput(pending(r,game,level),null,level);
      const outbox=r.rows('sync_outbox').length;
      const saved=await r.repo.saveCompletedSession(input);
      assert.equal(r.rows('sync_outbox').length,outbox+1,'restored triggers enqueue exactly once');
      const event=r.rows('sync_outbox').at(-1);
      r.module('src/cloud/sync-contract.ts').validateCloudRecord({owner_id:A,patient_id:'one',entity_type:'cognitive_sessions',entity_id:saved.id,payload:JSON.parse(event.payload),deleted:false,version:1},A);
      const row=r.sqlite.prepare('SELECT * FROM cognitive_sessions WHERE id=?').get(saved.id);
      for (const change of [{steps_completed:1},{steps_completed:null},{steps_completed:2.5},{correct_selections:0},{accuracy:0},{repeated_errors:999},{game_type:'unknown'},{difficulty:0},{difficulty:6},{recommended_difficulty:level===1?3:1},{patient_id:'absent'},{challenges_completed:1}]) {
        if (change.recommended_difficulty && Math.abs(change.recommended_difficulty-level)<=1) continue;
        assert.throws(()=>insertRow(r.sqlite,'cognitive_sessions',{...row,id:'invalid',...change}));
      }
    }
    assert.equal(r.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok'); assert.deepEqual(r.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {r.sqlite.close();}
  for (const fk of [0,1]) { const r=runtime();try {r.sqlite.exec('PRAGMA foreign_keys='+fk);await r.run(r.db);await r.run(r.db);assert.equal(r.rows('schema_migrations').length, 16);assert.equal(r.rows('cognitive_sessions').length,0);}finally{r.sqlite.close();} }
  console.log('PASS migration 012: production runner, populated 011 upgrade, all history/models/sync/consent/Care Circle/reports/rowids/indexes/triggers/FKs preserved; six rollback boundaries; exact new completion constraints; fresh install and idempotence.');
}

async function persistenceChecks() {
  const r=runtime();
  try {
    await r.run(r.db);
    for (const id of ['one','two']) await r.patient.upsertProfileWithSettings({id,preferredName:id},{language:'en'});
    const service=r.module('src/services/cognitive.service.ts'), ai=r.module('src/ai/adaptive-engine.ts');
    for (const id of ['one','two','one']) {
      r.change(id);
      for (const game of extra) for (let level=1;level<=5;level++) {
        const p=pending(r,game,level), others=r.rows('adaptive_model_state').filter(row=>row.patient_id!==id||row.game_type!==game);
        const result=await service.saveCognitiveResult(p,'comfortable'), saved=await r.repo.getSessionById(id,result.session.id);
        for (const key of ['gameType','stepsCompleted','attempts','correctSelections','hintsUsed','repeatedErrors','accuracy','averageResponseMs']) assert.equal(saved[key],p.telemetry[key]);
        assert.equal(saved.patientId,id);assert.equal(await r.repo.getSessionById(id==='one'?'two':'one',saved.id),null);
        assert.deepEqual(r.rows('adaptive_model_state').filter(row=>row.patient_id!==id||row.game_type!==game),others);
        const extraction=r.module('src/ai/feature-extractor.ts').extractAdaptiveFeatures;
        assert.deepEqual(extraction({patientId:id,currentDifficulty:level,telemetry:p.telemetry,recentSessions:[{...saved,patientId:'foreign'},{...saved,gameType:'memory_match'},{...saved,isDemoSeed:true}]}),p.extraction);
        assert.ok(saved.recommendedDifficulty>=1&&saved.recommendedDifficulty<=5&&Math.abs(saved.recommendedDifficulty-level)<=1);
      }
    }
    for (const game of extra) {
      const p=pending(r,game,3), model=await r.repo.getAdaptiveModel('one',game);
      await service.saveCognitiveResult(p,null);assert.deepEqual(await r.repo.getAdaptiveModel('one',game),model);
      for (let level=1;level<=5;level++) for (const n of [0,.25,.5,.75,1]) {
        const next=ai.recommendDifficulty(level,{accuracy:n,relativePace:n,workingMemory:n,independence:n,stability:n},model).recommendedDifficulty;
        assert.ok(next>=1&&next<=5&&Math.abs(next-level)<=1);
      }
      const snapshot=()=>JSON.stringify([r.rows('cognitive_sessions'),r.rows('adaptive_model_state'),r.rows('sync_outbox')]);
      for (const phase of ['resolution','database','patient','session','model','readback']) {
        const before=snapshot(), original={resolve:r.overrides['./active-patient.service'].resolveActivePatient,database:r.overrides['../client'].getDatabase,first:r.db.getFirstAsync,run:r.db.runAsync};
        const flip=()=>{r.change('two');r.change('one');};
        r.overrides['./active-patient.service'].resolveActivePatient=async()=>{const v=await original.resolve();if(phase==='resolution')flip();return v;};
        r.overrides['../client'].getDatabase=async()=>{if(phase==='database')flip();return r.db;};
        r.db.getFirstAsync=async(sql,...args)=>{const v=await original.first(sql,...args);if((phase==='patient'&&sql.includes('SELECT id FROM patient_profiles'))||(phase==='readback'&&sql.includes('SELECT * FROM cognitive_sessions WHERE patient_id')))flip();return v;};
        r.db.runAsync=async(sql,...args)=>{const v=await original.run(sql,...args);if((phase==='session'&&sql.includes('INSERT INTO cognitive_sessions'))||(phase==='model'&&sql.includes('INSERT INTO adaptive_model_state')))flip();return v;};
        await assert.rejects(service.saveCognitiveResult(p,'easy'),/patient changed/);assert.equal(snapshot(),before,game+' stale rollback at '+phase);
        r.db.getFirstAsync=original.first;r.db.runAsync=original.run;r.overrides['./active-patient.service'].resolveActivePatient=original.resolve;r.overrides['../client'].getDatabase=original.database;
      }
      r.change('two');await assert.rejects(service.saveCognitiveResult(p,null),/patient changed/);r.change('one');
    }
    const now=new Date('2026-09-12T12:00:00.000Z');
    for (const days of [7,30]) for (const id of ['one','two']) {
      const result=await r.module('src/services/reports.service.ts').loadReportFacts(id,days,now);
      assert.equal(result.facts.games.length,11);
      for (const game of extra) {const fact=result.facts.games.find(g=>g.gameType===game),saved=r.rows('cognitive_sessions').filter(s=>s.patient_id===id&&s.game_type===game);
        assert.equal(fact.sessions,saved.length);assert.equal(fact.correct,saved.reduce((n,s)=>n+s.correct_selections,0));assert.equal(fact.attempts,saved.reduce((n,s)=>n+s.attempts,0));}
      assert.deepEqual(r.module('src/caregiver/reports.ts').parseReportFacts(JSON.stringify(result.facts)),JSON.parse(JSON.stringify(result.facts)));
      const historical={...result.facts,games:result.facts.games.slice(0,8)};
      assert.deepEqual(r.module('src/caregiver/reports.ts').parseReportFacts(JSON.stringify(historical)),JSON.parse(JSON.stringify(historical)));
      for (const bad of [result.facts.games.slice(0,9),[...result.facts.games].reverse(),[...result.facts.games.slice(0,10),result.facts.games[0]]]) assert.throws(()=>r.module('src/caregiver/reports.ts').parseReportFacts(JSON.stringify({...result.facts,games:bad})));
    }
    const dashboard=await r.module('src/services/caregiver.service.ts').loadCaregiverDashboard('one',now);
    assert.equal(dashboard.cognitive.last7,33);
  } finally {r.sqlite.close();}
  console.log('PASS persistence: factual session readback, per-patient/per-game models, 1–5 and ±1 bounds, A→B→A, all 3 games at six stale-save boundaries, shared dashboard and 7/30-day reports, strict historical eight-game snapshot compatibility.');
}

async function screenChecks() {
  const hook=store=>Object.assign(selector=>selector(store.getState()),{getState:store.getState});
  for (const game of extra) for (const level of [1,5]) for (const language of Languages) {
    const r=runtime();
    try {
      let valid=true, focused=true; const backgroundListeners=[]; const background=(state)=>{backgroundListeners.forEach(fn=>fn(state));};
      const routes=[],router={replace:route=>routes.push(route),dismissTo:route=>routes.push(route)};
      const onboarding=r.module('src/stores/onboarding.store.ts').useOnboardingStore;
      const cognitive=r.module('src/stores/cognitive-session.store.ts').useCognitiveSessionStore;
      const overrides={
        'expo-router':{useRouter:()=>router}, '@expo/vector-icons':{MaterialIcons:'MaterialIcons'},
        // Automatic progression (challenge → answer → feedback → short auto
        // transition → next) registers multiple AppState listeners (board
        // foreground ref + useGameTransition). Notify all of them so background
        // guards are exercised faithfully; the user must NOT press Continue
        // after every successful round.
        'react-native':{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:s=>s},AppState:{currentState:'active',addEventListener:(_,cb)=>{backgroundListeners.push(cb);return{remove(){}};}}},
        '@react-navigation/native':{useIsFocused:()=>focused}, '@/hooks/use-theme-color':{useThemeColors:()=>({})},
        '@/src/stores/patient-session.store':{capturePatientRequest:()=>()=>valid},
        '@/src/stores/onboarding.store':{useOnboardingStore:hook(onboarding)},'@/src/stores/cognitive-session.store':{useCognitiveSessionStore:hook(cognitive)},
        '@services/active-patient.service':{resolveActivePatient:async()=>({status:'ready',profile:{id:'one'},settings:{language,region:'assam',textSize:'extra-large',highContrast:true,reducedMotion:true,voiceGuidance:true}})},
        '@db/repositories/cognitive.repository':{cognitiveRepository:{getRecentSessions:async(id,limit,type)=>{assert.equal(id,'one');assert.equal(type,game);assert.equal(limit,5);return[{recommendedDifficulty:level}];},getAdaptiveModel:async(id,type)=>{assert.equal(id,'one');assert.equal(type,game);return null;}}},
      };
      for(const name of ['adaptive-engine','feature-extractor','cognitive-coach'])overrides['@ai/'+name]=r.module('src/ai/'+name+'.ts');
      for(const name of ['selection-engine','presentation','pattern-recognition','routine-recall','recall-activities','grid-activities','sudoku-lite','chess-puzzle','word-match','memory-match/assets'])overrides['@/src/games/'+name]=r.module('src/games/'+name+'.ts');
      overrides['@/src/games/sudoku-lite']={...sudoku,prepareSudoku:l=>prepare('sudoku_lite',l).sudoku};
      overrides['@/src/games/chess-puzzle']={...chess,prepareChess:l=>prepare('chess_puzzle',l).chess};
      overrides['@/src/games/word-match']={...words,prepareWords:l=>prepare('word_match',l).words};
      overrides['@components/games/answer-feedback']=load('components/games/answer-feedback.tsx',overrides);
      const parent=screen('components/games/selection-activity-screen.tsx',overrides,{gameType:game});parent();await tick();
      const byId=(tree,id)=>nodes(tree).find(n=>n.props?.testID===id);
      byId(parent(),'activity-start').props.onPress();
      const props={...nodes(parent()).find(n=>n.type==='PuzzleActivityBoard').props};
      const board=screen('components/games/puzzle-activity-board.tsx',overrides,props);
      const render=()=>{Object.assign(props,nodes(parent()).find(n=>n.type==='PuzzleActivityBoard').props);return board();};
      const click=id=>{const n=byId(render(),id);assert.ok(n,id);assert.ok(!n.props.disabled,id);n.props.onPress();render();};
      const tasks=[...prepare(game,level).tasks];
      render();board().props.onLayout({nativeEvent:{layout:{width:320}}});render();
      if(game==='sudoku_lite') {
        const fixed=props.activity.sudoku.clues.findIndex(Boolean),n=byId(render(),'sudoku-cell-'+fixed);
        assert.ok(n.props.disabled);const before=props.selection;n.props.onPress();render();assert.equal(props.selection,before,'fixed cell immutable even through stale callback');
      }
      if(game!=='chess_puzzle') {
        const prefix=game==='sudoku_lite'?(byId(render(),'sudoku-focus-'+tasks[1].id)?'sudoku-focus-':'sudoku-cell-'):'word-focus-';
        // Change the selected blank/pair without losing its coaching history.
        const wrong=tasks[0].choices.find(c=>c!==tasks[0].answer);click('puzzle-choice-'+wrong);
        click(prefix+tasks[1].id);click(prefix+tasks[0].id);assert.equal(props.selection.wrongAnswers,1);
        click(prefix+tasks.at(-1).id);[tasks[0],tasks[tasks.length-1]]=[tasks.at(-1),tasks[0]];
      }
      for(const [i,task] of tasks.entries()) {
        if(i===0) {const wrong=task.choices.find(c=>c!==task.answer);for(const hint of [0,1,3]){click('puzzle-choice-'+wrong);assert.equal(props.selection.hintLevel,hint);assert.equal(props.selection.correctSelections,0);}
          assert.equal(byId(render(),'puzzle-choice-'+wrong).props.accessibilityHint,t(language,'answerWrong'),'wrong choice carries a non-color status hint');
          assert.ok(byId(render(),'puzzle-choice-'+wrong).props.disabled);assert.ok(nodes(render()).some(n=>n.props?.children===t(language,'puzzleReveal',{answer:game==='word_match'?t(language,props.activity.words.options.find(p=>p.id===task.answer).right):game==='chess_puzzle'?(level===1?t(language,chess.pieceKeys[task.answer]):t(language,'chessSquare',{square:task.answer,piece:task.board[task.answer]?t(language,'chessBlack')+' '+t(language,chess.pieceKeys[task.board[task.answer].kind]):t(language,'chessEmpty'),mark:''}).trim()):task.answer})));}
        const callback=byId(render(),'puzzle-choice-'+task.answer).props.onPress;
        valid=false;callback();render();assert.equal(props.selection.correctSelections,i);valid=true;
        background('background');callback();render();assert.equal(props.selection.correctSelections,i);background('active');
        focused=false;render();callback();render();assert.equal(props.selection.correctSelections,i);focused=true;render();
        click('puzzle-choice-'+task.answer);assert.equal(props.selection.correctSelections,i+1);
        assert.ok(byId(render(),'puzzle-choice-'+task.answer).props.accessibilityState?.selected,'correct choice exposes a non-color selected state');
        callback();render();assert.equal(props.selection.correctSelections,i+1);
        if(i===tasks.length-1){valid=false;board.advance();assert.equal(cognitive.getState().pending,null);assert.deepEqual(routes,[]);valid=true;props.onContinue();}
        else {board.advance();render();}
      }
      assert.equal(routes.at(-1),'/patient/games/result');const result=cognitive.getState().pending;
      assert.equal(result.patientId,'one');assert.equal(result.currentDifficulty,level);assert.equal(result.telemetry.stepsCompleted,tasks.length);
      assert.equal(result.telemetry.attempts,tasks.length+3+Number(game!=='chess_puzzle'));
    } finally {r.sqlite.close();}
  }
  console.log('PASS actual screens: 3 games × 7 languages × levels 1/5, selecting arbitrary blanks/pairs, immutable clues, wrong/hint/reveal, completion, telemetry, background/focus/stale input and stale result navigation.');
}

async function preparationChecks() {
  for (const game of extra) for (const phase of ['resolve','history','model']) {
    const r=runtime();
    try {
      r.change('one');let release;const gate=new Promise(resolve=>{release=resolve;});const routes=[];
      const router={replace:r=>routes.push(r),dismissTo:r=>routes.push(r)};
      const onboarding=r.module('src/stores/onboarding.store.ts').useOnboardingStore;
      const cognitive=r.module('src/stores/cognitive-session.store.ts').useCognitiveSessionStore;
      const hook=store=>Object.assign(s=>s(store.getState()),{getState:store.getState});
      const overrides={
        'expo-router':{useRouter:()=>router},'react-native':{View:'View',StyleSheet:{create:s=>s},AppState:{addEventListener:()=>({remove(){}})}},
        '@expo/vector-icons':{MaterialIcons:'MaterialIcons'},'@/hooks/use-theme-color':{useThemeColors:()=>({})},
        '@/src/stores/patient-session.store':r.session,'@/src/stores/onboarding.store':{useOnboardingStore:hook(onboarding)},
        '@/src/stores/cognitive-session.store':{useCognitiveSessionStore:hook(cognitive)},
        '@services/active-patient.service':{resolveActivePatient:async()=>{if(phase==='resolve')await gate;return{status:'ready',profile:{id:'one'},settings:{language:'hi',region:'assam',textSize:'large'}};}},
        '@db/repositories/cognitive.repository':{cognitiveRepository:{getRecentSessions:async()=>{if(phase==='history')await gate;return[];},getAdaptiveModel:async()=>{if(phase==='model')await gate;return null;}}},
      };
      for(const name of ['adaptive-engine','feature-extractor','cognitive-coach'])overrides['@ai/'+name]=r.module('src/ai/'+name+'.ts');
      for(const name of ['selection-engine','presentation','pattern-recognition','routine-recall','recall-activities','grid-activities','sudoku-lite','chess-puzzle','word-match','memory-match/assets'])overrides['@/src/games/'+name]=r.module('src/games/'+name+'.ts');
      const render=screen('components/games/selection-activity-screen.tsx',overrides,{gameType:game});render();await tick();
      r.change('two');r.change('one');release();await tick();
      assert.ok(!nodes(render()).some(n=>n.props?.testID==='activity-start'),game+' stale '+phase+' cannot prepare an A session after A→B→A');
      assert.equal(cognitive.getState().pending,null);assert.deepEqual(routes,[]);
    }finally{r.sqlite.close();}
  }
  console.log('PASS preparation: real patient revision guard rejects A→B→A during profile/history/model reads for each new game.');
}

function sourceChecks() {
  for(const file of [...fs.readdirSync('src/db/migrations').filter(f=>/^0(0[1-9]|11)_/.test(f)).map(f=>'src/db/migrations/'+f),
    ...fs.readdirSync('supabase/migrations').filter(f=>f<'20260916000000').map(f=>'supabase/migrations/'+f),'src/db/client.web.ts']) {
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','a030ac8:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+' protected');
  }
  // Required network/mail dependencies are explicitly validated while
  // all other dependency fields remain protected against accidental loss.
  // GPS left the product surface, so its packages and their transitive lock
  // entries are gone; the remaining required Expo modules pull no extra entries.
  for(const file of ['package.json','package-lock.json']) {
    const before=JSON.parse(execFileSync('git',['show','a030ac8:'+file],{encoding:'utf8'}));
    const after=JSON.parse(fs.readFileSync(file,'utf8'));
    const dependencies=file==='package.json'?after.dependencies:after.packages[''].dependencies;
    if(file==='package-lock.json') {
      assert.deepEqual(after.packages['node_modules/expo-asset'],before.packages['node_modules/expo/node_modules/expo-asset'],'SDK asset peer hoisted unchanged');
      delete before.packages['node_modules/expo/node_modules/expo-asset'];
    }
    for(const [name,version] of Object.entries({'expo-network':'~8.0.8','expo-mail-composer':'~15.0.8','expo-location':'~19.0.8','react-native-maps':'1.20.1','expo-audio':'~1.1.1','expo-battery':'~10.0.8','expo-asset':'~12.0.13'})) {
      assert.equal(dependencies[name],version,name+' required'); delete dependencies[name];
      if(file==='package-lock.json') { assert.equal(after.packages['node_modules/'+name].version,version.replace(/^~/,'')); delete after.packages['node_modules/'+name]; }
    }
    assert.equal(after.version,'1.0.1');before.version='1.0.1';
    if(file==='package-lock.json') {
      assert.equal(after.packages['node_modules/unimodules-app-loader'],undefined);
      assert.equal(after.packages['node_modules/@types/geojson'].version,'7946.0.16');delete after.packages['node_modules/@types/geojson'];
      before.packages[''].version='1.0.1';
    }
    assert.deepEqual(after,before,'all other dependency fields preserved: '+file);
  }
  const old=fs.readFileSync('supabase/migrations/20260915000000_care_circle_reports.sql','utf8').replace(/\r\n/g,'\n');
  const next=fs.readFileSync('supabase/migrations/20260916000000_three_cognitive_games.sql','utf8').replace(/\r\n/g,'\n');
  const fn=(sql,name)=>sql.match(new RegExp('function public\\.'+name+'\\([\\s\\S]*?\\$\\$;'))[0];
  let normalized=fn(next,'valid_sync_record').replaceAll(",'sudoku_lite','chess_puzzle','word_match'",'').split('\n').filter(line=>!extra.some(g=>line.includes("p->>'game_type' = '"+g+"'"))).join('\n');
  assert.equal(normalized,fn(old,'valid_sync_record'),'all prior validation byte-for-byte outside allowed ID/metric extensions');
  normalized=fn(next,'valid_care_record').replaceAll(",'sudoku_lite','chess_puzzle','word_match'",'').replace("jsonb_array_length(s->'games') not in (8,11)","jsonb_array_length(s->'games')<>8");
  assert.equal(normalized,fn(old,'valid_care_record'),'report schema validation unchanged except exact 8/11 catalogs');
  assert.doesNotMatch(next,/create table|alter table|drop |grant |revoke |policy|security definer/i);
  for(const file of ['src/games/sudoku-lite.ts','src/games/chess-puzzle.ts','src/games/word-match.ts','components/games/puzzle-activity-board.tsx']) {
    const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/setInterval|setTimeout|countdown|fetch\(|https?:|Stockfish|chess\.com|lichess/i);
  }
  const board=fs.readFileSync('components/games/puzzle-activity-board.tsx','utf8');
  assert.match(board,/Layout.minTouchTarget/);assert.match(board,/accessibilityLabel/);assert.match(board,/accessibilityState/);assert.match(board,/useThemeColors/);assert.match(board,/ReadScreenButton/);
  assert.doesNotMatch(board,/numberOfLines|ellipsizeMode|#[0-9a-f]{3,8}/i);
  console.log('PASS source contracts: historical SQLite 001–011 and all historical cloud migrations unchanged, dependencies unchanged, strict forward cloud validators with RLS/grants untouched, appearance/accessibility/read-aloud and no game clock/network. PostgreSQL/native device execution remains separate.');
}
function continuedCoachingChecks() {
  for (const gameType of ['sudoku_lite','word_match']) for (let level=1;level<=5;level++) {
    const activity=prepare(gameType,level), [first,second]=activity.tasks;
    const props={activity,selection:engine.createSelection(activity.tasks,0),level,language:'en',voice:false,isCurrent:()=>true,
      onChange:change=>{props.selection=change(props.selection);},onContinue:()=>{props.selection=engine.continueSelection(props.selection,100);}};
    const overrides={'@react-navigation/native':{useIsFocused:()=>true},'@/hooks/use-theme-color':{useThemeColors:()=>({})},
      'react-native':{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:s=>s},AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
      '@ai/cognitive-coach':load('src/ai/cognitive-coach.ts')};
    for(const name of ['selection-engine','chess-puzzle','sudoku-lite'])overrides['@/src/games/'+name]=load('src/games/'+name+'.ts');
    overrides['@components/games/answer-feedback']=load('components/games/answer-feedback.tsx',overrides);
    const render=screen('components/games/puzzle-activity-board.tsx',overrides,props);
    const click=id=>{const node=nodes(render()).find(n=>n.props?.testID===id);assert.ok(node&&!node.props.disabled,id);node.props.onPress();render();};
    click('puzzle-choice-'+first.choices.find(choice=>choice!==first.answer));
    click('activity-hint');click('activity-hint');
    click((gameType==='sudoku_lite'?'sudoku-focus-':'word-focus-')+second.id);
    click('puzzle-choice-'+second.answer);render.advance();render();
    assert.equal(props.selection.hintLevel,2,'Continue must retain guidance for a previously visited task');
    assert.equal(props.selection.wrongAnswers,1,'Continue must retain earlier wrong answers');
    assert.equal(props.selection.hintsUsed,2,'restored guidance must not add a hint');
    click('activity-hint');assert.equal(props.selection.hintLevel,3);
    assert.equal(props.selection.hintsUsed,3);
  }
  console.log('PASS continued coaching: Sudoku/Word Match at all five levels retain hint stages and errors after another item is solved.');
}
async function syncOrderingChecks() {
  const r=runtime();
  try {
    await r.run(r.db);await seed(r.db);
    for(let i=0;i<30;i++)await r.repo.saveCompletedSession(r.module('src/services/cognitive.service.ts').completedSessionInput(pending(r,'word_match',1),null,1));
    const care=r.module('src/db/repositories/care-circle.repository.ts').careCircleRepository;
    const member=await care.save('one',{display_name:'Synthetic family',relationship:'daughter',access_role:'family',email:'fixture@example.invalid',phone:null,scopes:['reports']},()=>true);
    await care.savePreference('one',member.id,'weekly',true,()=>true);
    const sync=r.module('src/db/repositories/sync.repository.ts').syncRepository;
    await sync.link(A,()=>true);
    await r.patient.upsertProfileWithSettings({id:'one',preferredName:'Updated synthetic patient'},{language:'hi'});
    const before=r.rows('sync_outbox'),seen=new Set(),last=new Map(),sent=[];
    assert.ok(before.length>25,'exercise dependencies across production batch boundaries');
    for(let batch=await sync.pending(A);batch.length;batch=await sync.pending(A)) {
      for(const event of batch) {
        const p=JSON.parse(event.payload),key=event.patient_id+':'+event.entity_type+':'+event.entity_id;
        if(event.entity_type!=='patient_profiles')assert.ok(seen.has(event.patient_id+':patient_profiles:'+event.patient_id),'profile before child');
        if(event.entity_type==='report_preferences'&&p.recipient_id)assert.ok(seen.has(event.patient_id+':care_circle_members:'+p.recipient_id),'Care Circle member before report preference');
        if(event.entity_type==='reminder_events')assert.ok(seen.has(event.patient_id+':reminders:'+p.reminder_id),'reminder before completion');
        assert.ok(event.sequence>(last.get(key)??0),'same-entity mutations retain sequence order');
        last.set(key,event.sequence);seen.add(key);sent.push(event.sequence);
        assert.deepEqual({...event},Object.fromEntries(Object.entries(before.find(row=>row.sequence===event.sequence)).filter(([key])=>key!=='saved_rowid')),'dequeue preserves every retry/payload field');
      }
      await sync.acknowledge(A,batch,batch.map(event=>({mutation_id:event.mutation_id,status:'applied'})),()=>true);
    }
    assert.deepEqual(sent.sort((a,b)=>a-b),before.map(row=>row.sequence).sort((a,b)=>a-b),'no queue event skipped or duplicated');
  } finally {r.sqlite.close();}
  console.log('PASS sync dependency order: initial backup sends parents before children across batches, retaining same-entity order and retry fields.');
}
async function main(){contentChecks();continuedCoachingChecks();await syncOrderingChecks();await migrationChecks();await persistenceChecks();await screenChecks();await preparationChecks();sourceChecks();}
module.exports={prepare,play};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
