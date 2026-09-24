// Family pairing: server contract, disposable-PostgreSQL execution, client
// service boundaries and caregiver UI flows. No hosted writes are made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load } = require('./check-elderly-ux.cjs');
const { screen, nodes } = require('./check-privacy-recovery.cjs');
const { A, B } = require('./check-auth-sync-migration.cjs');
const { t, strings } = load('src/i18n/index.ts');
const tick = () => new Promise(setImmediate);
const root = path.join(__dirname, '..');
const migration = 'supabase/migrations/20260924000000_family_pairing.sql';

function structuralChecks() {
  const source = fs.readFileSync(path.join(root, migration), 'utf8');
  assert.ok(source.startsWith('-- Family pairing'));
  assert.equal((source.match(/\$\$/g) || []).length % 2, 0, 'balanced function bodies');
  assert.ok(source.trimStart().startsWith('--') && /begin;/.test(source) && /commit;\s*$/.test(source));
  for (const name of ['pairing_codes', 'patient_memberships', 'create_pairing_code', 'claim_pairing_code',
    'revoke_membership', 'list_memberships', 'granted_snapshot', 'valid_pairing_scopes']) {
    assert.ok(source.includes(name), name);
  }
  for (const scope of ['daily_activity', 'reminders', 'cognitive_activity', 'reports', 'memories']) {
    assert.ok(source.includes(`'${scope}'`), scope + ' allowlisted');
  }
  assert.ok(!/\b(service_role|service-role|sb_secret|sk-proj-|sk-ant-|PRIVATE KEY|eyJ[A-Za-z0-9_-]{12,}\.)/.test(source), 'no privileged secrets');
  assert.ok(!/create policy|grant select|grant all|grant insert|grant update|grant delete/i.test(source), 'RPC-only, no direct table grants');
  for (const fn of ['create_pairing_code', 'claim_pairing_code', 'revoke_membership', 'list_memberships', 'granted_snapshot']) {
    assert.ok(source.includes(`revoke all on function public.${fn}`), fn + ' hidden');
    assert.ok(source.includes(`grant execute on function public.${fn}`), fn + ' callable by sign-in');
  }
  assert.ok(source.includes('p_ttl_minutes not between 5 and 60') && source.includes('p_max_uses not between 1 and 5'));
  assert.ok(source.includes('>= 10'), 'creation rate limit');
  assert.ok(source.includes('gen_random_uuid()') && !source.includes('random() *'), 'CSPRNG code generation');
  assert.ok(/FOREIGN KEY|references public\.sync_patients/.test(source), 'grants stay owner-scoped');
  assert.ok(source.includes('md5(') && !source.includes('encode('), 'hashed lookup without extensions');
  console.log('PASS pairing contract: hashed expiring single-use codes, owner-scoped grants, scope allowlist, rate limits, RPC-only grants, no secrets.');
}

function pgTools() {
  const bin = process.env.SMARAN_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  return fs.existsSync(path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql')) ? bin : null;
}

async function pgChecks() {
  const bin = pgTools();
  if (!bin) { console.log('SKIP pairing PostgreSQL execution: no local binaries.'); return; }
  const exe = name => path.join(bin, process.platform === 'win32' ? name + '.exe' : name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaran-pairing-'));
  const data = path.join(dir, 'postgres');
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  execFileSync(exe('initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true, stdio: 'pipe' });
  const stop = () => { try { execFileSync(exe('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { windowsHide: true, stdio: 'ignore' }); } catch {} };
  try {
    execFileSync(exe('pg_ctl'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], { windowsHide: true, stdio: 'ignore' });
    const sql = input => execFileSync(exe('psql'), ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres'], { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const q = value => `'${String(value).replace(/'/g, "''")}'`;
    sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
    for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
    }
    assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relname IN ('pairing_codes','patient_memberships') AND relrowsecurity`), '2');
    assert.equal(sql(`SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public'
      AND table_name IN ('pairing_codes','patient_memberships') AND grantee IN ('anon','authenticated','PUBLIC')`), '0');
    sql(`INSERT INTO auth.users(id) VALUES (${q(A)}),(${q(B)});`);
    const call = (fn, args, owner) => JSON.parse(sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = ${q(owner)}; SELECT public.${fn}(${args}); COMMIT;`));
    sql(`INSERT INTO public.sync_accounts(owner_id) VALUES (${q(A)}),(${q(B)});
      INSERT INTO public.sync_patients(owner_id,patient_id) VALUES (${q(A)},'one'),(${q(A)},'two');
      INSERT INTO public.sync_records(owner_id,patient_id,entity_type,entity_id,payload,version) VALUES
      (${q(A)},'one','patient_profiles','one',${q(JSON.stringify({ id: 'one', preferred_name: 'Synthetic elder', age_bracket: '70s', emergency_name: '', emergency_phone: '', created_at: 'now', updated_at: 'now' }))}::jsonb,1),
      (${q(A)},'one','reminders','r1',${q(JSON.stringify({ id: 'r1', patient_id: 'one', type: 'medicine', title: 'Synthetic pill', note: '', time_of_day: '08:00', scheduled_date: null, repeat_rule: 'daily', is_enabled: 1, deleted_at: null, created_at: 'now', updated_at: 'now' }))}::jsonb,2);`);
    assert.throws(() => call('create_pairing_code', `${q('one')},'{reminders}','X','family',15,1`, B), /not authorized/);
    assert.equal(call('create_pairing_code', `${q('one')},'{admin}','X','family',15,1`, A).error, 'invalid_input');
    assert.equal(call('create_pairing_code', `${q('one')},'{reminders}','X','superuser',15,1`, A).error, 'invalid_input');
    assert.equal(call('create_pairing_code', `${q('one')},'{}','X','family',15,1`, A).error, 'invalid_input', 'at least one scope');
    const created = call('create_pairing_code', `${q('one')},'{reminders,memories}','Daughter','family',15,1`, A);
    assert.equal(created.ok, true); assert.match(created.code, /^[A-F0-9]{16}$/);
    assert.ok(Date.parse(created.expires_at) > Date.now());
    // Plaintext codes never persist: only the hash is stored.
    assert.equal(sql(`SELECT count(*) FROM public.pairing_codes WHERE code_hash = md5(${q(created.code)})`), '1');
    assert.equal(sql(`SELECT count(*) FROM public.pairing_codes WHERE ${q(created.code)} LIKE '%' || code_hash || '%'`), '0');
    assert.equal(call('claim_pairing_code', q('AAAAAAAAAAAAAAAA'), B).error, 'invalid_code');
    assert.equal(call('claim_pairing_code', q('short'), B).error, 'invalid_code');
    const claimed = call('claim_pairing_code', q(created.code.toLowerCase()), B);
    assert.equal(claimed.ok, true); assert.equal(claimed.patient_id, 'one');
    assert.deepEqual(claimed.scopes, ['reminders', 'memories']); assert.equal(claimed.label, 'Daughter');
    assert.equal(call('claim_pairing_code', q(created.code), B).error, 'invalid_code', 'single use enforced');
    const own = call('create_pairing_code', `${q('one')},'{reports}','Self','family',15,1`, A);
    assert.equal(call('claim_pairing_code', q(own.code), A).error, 'invalid_code', 'owners cannot claim their own codes');
    const listed = call('list_memberships', '', B);
    assert.equal(listed.received.length, 1); assert.equal(listed.received[0].display_name, 'Synthetic elder');
    assert.equal(call('list_memberships', '', A).granted.length, 1);
    const snap = call('granted_snapshot', q('one'), B);
    assert.equal(snap.ok, true); assert.equal(snap.display_name, 'Synthetic elder');
    assert.deepEqual(snap.scopes, ['reminders', 'memories']);
    assert.equal(snap.counts, null, 'dashboard counts need the daily_activity scope');
    assert.equal(snap.reminders.length, 1); assert.equal(snap.reminders[0].title, 'Synthetic pill');
    assert.equal(snap.sessions, null, 'ungranted scope omitted, not errored');
    assert.equal(snap.reports, null);
    sql(`UPDATE public.sync_accounts SET version=2 WHERE owner_id=${q(A)};`);
    const patch = JSON.stringify({title:'Updated water',time_of_day:'09:30'});
    assert.equal(call('update_shared_record', `${q('one')},'reminders','r1',2,${q(patch)}::jsonb`, B).ok, true);
    assert.equal(call('granted_snapshot', q('one'), B).reminders[0].title, 'Updated water');
    assert.equal(call('update_shared_record', `${q('one')},'reminders','r1',2,${q(patch)}::jsonb`, B).error, 'conflict');
    assert.equal(call('update_shared_record', `${q('one')},'reminders','r1',3,'{"owner_id":"other"}'::jsonb`, B).error, 'invalid_input');
    assert.equal(call('update_shared_record', `${q('one')},'reminders','r1',3,'{"time_of_day":"29:00"}'::jsonb`, B).error, 'invalid_input');
    assert.equal(call('update_shared_record', `${q('two')},'reminders','r1',3,${q(patch)}::jsonb`, B).error, 'forbidden');
    assert.equal(call('update_shared_record', `${q('one')},'patient_settings','one',3,'{"language":"hi"}'::jsonb`, B).error, 'forbidden');
    const pulled = call('pull_changes', '2', A);
    assert.equal(pulled.records[0].payload.title, 'Updated water', 'remote write uses original owner pull stream');
    assert.equal(call('pull_changes', '0', B).records.length, 0, 'member never becomes owner of copied records');
    assert.equal(call('assistant_context', "'one',current_date", A).role, 'owner');
    const ai = call('assistant_context', "'one',current_date", B);
    assert.equal(ai.role, 'family');assert.deepEqual(ai.scopes, ['reminders','memories']);
    assert.ok(ai.records.every(r=>['reminders','reminder_events','personal_memories'].includes(r.kind)));
    assert.equal(call('assistant_context', "'two',current_date", B).error,'forbidden');
    assert.equal(call('granted_snapshot', q('one'), B).reminders[0].title,'Updated water','A→B→A reads stay patient scoped');
    assert.equal(call('granted_snapshot', q('two'), B).error, 'forbidden', 'no cross-patient leakage');
    const wide = call('create_pairing_code', `${q('one')},'{daily_activity,reminders}','All','family',15,5`, A);
    assert.equal(call('claim_pairing_code', q(wide.code), B).ok, true);
    assert.equal(call('granted_snapshot', q('one'), B).counts.reminders_pending, 1);
    assert.equal(call('granted_snapshot', q('one'), A).error, 'forbidden', 'grantor uses their own data, not the grant path');
    assert.equal(call('revoke_membership', `${q('one')},${q(A)}::uuid`, B).error, 'forbidden', 'members cannot revoke others');
    assert.equal(call('revoke_membership', q('one'), B).revoked, 1);
    assert.equal(call('granted_snapshot', q('one'), B).error, 'forbidden', 'revoked grants stop reads');
    assert.equal(call('assistant_context', "'one',current_date", B).error, 'forbidden', 'revoked grants stop AI context');
    assert.equal(call('update_shared_record', `${q('one')},'reminders','r1',3,${q(patch)}::jsonb`, B).error, 'forbidden', 'revoked grants stop writes');
    const second = call('create_pairing_code', `${q('one')},'{reports}','Daughter','family',15,1`, A);
    assert.equal(call('claim_pairing_code', q(second.code), B).ok, true, 'fresh codes re-activate revoked members');
    const third = call('create_pairing_code', `${q('one')},'{reports}','X','family',15,1`, A);
    assert.equal(call('revoke_membership', `${q('one')},${q(B)}::uuid`, A).revoked, 1);
    assert.equal(call('claim_pairing_code', q(third.code), B).error, 'invalid_code', 'codes die with the grant');
    const fourth = call('create_pairing_code', `${q('one')},'{reports}','X','family',5,1`, A);
    sql(`UPDATE public.pairing_codes SET expires_at = now() - interval '1 minute' WHERE code_hash = md5(${q(fourth.code)});`);
    assert.equal(call('claim_pairing_code', q(fourth.code), B).error, 'expired');
    for (let i = 0; i < 10; i++) {
      const bulk = call('create_pairing_code', `${q('one')},'{reports}','R${i}','family',60,5`, A);
      assert.match(bulk.code, /^[A-F0-9]{16}$/, 'every generated code is a full 16 symbols');
    }
    assert.equal(call('create_pairing_code', `${q('one')},'{reports}','Overflow','family',60,5`, A).error, 'rate_limited');
    assert.equal(call('revoke_pairing_codes',q('one'),B).error,'forbidden');
    assert.equal(call('revoke_pairing_codes',q('one'),A).ok,true);
    assert.equal(sql(`SELECT count(*) FROM public.pairing_codes WHERE owner_id=${q(A)} AND revoked_at IS NULL`),'0');
    let limited;for(let i=0;i<21;i++)limited=call('claim_pairing_code',q('0000000000000000'),B);
    assert.equal(limited.error,'rate_limited','claim limit persists across RPCs');
    console.log('PASS remote SQL: bounded edits, field validation, optimistic conflicts, owner pull compatibility, A→B→A isolation, AI scopes, revoked reads/writes/context and durable claim rate limit.');
    console.log('PASS pairing PostgreSQL: hashed expiring single-use codes, owner-only mint, claim/revoke/list, scope-filtered snapshots, no cross-patient leakage, expiry and rate limits.');
  } finally { stop(); assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep) && path.basename(dir).startsWith('smaran-pairing-')); fs.rmSync(dir, { recursive: true, force: true }); }
}

function clientChecks() {
  let session = true, online = true;
  const calls = [];
  let responses = [];
  const service = load('src/services/pairing.service.ts', {
    '../cloud/auth': {
      captureAccount: () => ({ ownerId: 'owner-a', signal: {}, current: () => session }),
      getCloudClient: () => {
        if (!online) throw new Error('Cloud sync is not configured on this build.');
        return { rpc: (name, args) => { calls.push({ name, args }); return { abortSignal: async () => responses.shift() ?? { error: {}, status: 500 } }; } };
      },
    },
  }).pairingService;
  const run = work => work.then(() => { throw new Error('expected rejection'); }, error => error.message);
  const future = new Date(Date.now() + 900000).toISOString();
  return (async () => {
    responses = [{ error: null, data: { ok: true, code: 'ABCDEF0123456789', expires_at: future } }];
    assert.deepEqual(await service.generate('one', ['reminders'], 'Daughter'),
      { code: 'ABCDEF0123456789', expiresAt: future });
    assert.deepEqual(calls.at(-1), { name: 'create_pairing_code',
      args: { p_patient: 'one', p_scopes: ['reminders'], p_label: 'Daughter', p_role: 'family' } });
    const before = calls.length;
    assert.equal(await run(service.generate('one', ['admin'], 'X')), 'pairingInvalidInput');
    assert.equal(await run(service.generate('one', [], 'X')), 'pairingInvalidInput');
    assert.equal(await run(service.generate('one', ['reminders'], 'x'.repeat(65))), 'pairingInvalidInput');
    assert.equal(await run(service.generate('one', ['reminders'], 'X', 'superuser')), 'pairingInvalidInput');
    assert.equal(calls.length, before, 'invalid input never reaches the network');
    assert.equal(await run(service.claim('bad!')), 'pairingInvalid');
    assert.equal(calls.length, before, 'malformed codes never reach the network');
    responses = [{ error: null, data: { ok: true, patient_id: 'one', access_role: 'family', scopes: ['reports'], label: 'Son' } }];
    assert.deepEqual(await service.claim('abcdef0123456789'), { patientId: 'one', accessRole: 'family', scopes: ['reports'], label: 'Son' });
    for (const [error, key] of [[{ error: 'x', status: 0 }, 'pairingOffline'], [{ error: 'x', status: 500 }, 'pairingFailed'],
      [{ error: null, data: { ok: false, error: 'expired' } }, 'pairingExpired'],
      [{ error: null, data: { ok: false, error: 'whatever' } }, 'pairingFailed'],
      [{ error: null, data: null }, 'pairingFailed'],
      [{ error: null, data: { ok: true, patient_id: 'one' } }, 'pairingFailed']]) {
      responses = [error];
      assert.equal(await run(service.claim('ABCDEF0123456789')), key);
    }
    session = false;
    assert.equal(await run(service.claim('ABCDEF0123456789')), 'pairingSignIn');
    assert.equal(calls.length, before + 7, 'expired sessions never reach the network');
    session = true; online = false;
    assert.equal(await run(service.list()), 'pairingOffline');
    online = true;
    responses = [{ error: null, data: { ok: true, received: [{ patient_id: 'one', access_role: 'family', scopes: ['reports'], label: 'Son', display_name: 'Elder' }], granted: [{ patient_id: 'one', member_id: 'm', access_role: 'family', scopes: [], label: '', revoked: true }] } }];
    assert.deepEqual(await service.list(), { received: [{ patientId: 'one', accessRole: 'family', scopes: ['reports'], label: 'Son', memberId: undefined, revoked: undefined, displayName: 'Elder' }],
      granted: [{ patientId: 'one', memberId: 'm', accessRole: 'family', scopes: [], label: '', revoked: true, displayName: null }] });
    responses = [{ error: null, data: { ok: true } }, { error: null, data: { ok: true } }];
    await service.revoke('one', 'm');
    assert.deepEqual(calls.at(-1), { name: 'revoke_membership', args: { p_patient: 'one', p_member: 'm' } });
    await service.revoke('one');
    assert.deepEqual(calls.at(-1), { name: 'revoke_membership', args: { p_patient: 'one' } });
    responses = [{ error: null, data: { ok: false, error: 'forbidden' } }];
    assert.equal(await run(service.snapshot('one')), 'pairingForbidden');
    console.log('PASS pairing service: strict input validation before any RPC, offline/session guards, envelope error mapping, malformed-payload rejection and patient-scoped calls.');
  })();
}

async function uiChecks() {
  const scopeKeys = { daily_activity: 'circleDaily', reminders: 'circleReminders', cognitive_activity: 'circleCognitive', reports: 'reportTitle', memories: 'circleMemories' };
  for (const language of ['en','hi','as','bn','mni','kha','lus']) {
    let links = { received: [{ patientId: 'two', accessRole: 'family', scopes: ['reports'], label: 'Son', displayName: 'Synthetic elder' }], granted: [] };
    let snapshot = null;
    const calls = [];
    const data = { patient: { id: 'one' }, settings: { language }, current: () => true };
    const overrides = {
      '@components/caregiver/care-member-fields': { scopeKeys },
      '@/src/stores/onboarding.store': {useOnboardingStore: fn=>fn({language})},
      '@/src/services/speech.service': {stopSpeech:async()=>{}},
      'react-native': {View:'View',AppState:{addEventListener:()=>({remove(){}})}},
      '@/src/cloud/auth': { useAuthStore: fn => fn({revision:0}), captureAccount: () => ({current:()=>true}) },
      '@/src/caregiver/care-circle': load('src/caregiver/care-circle.ts'),
      '@/src/services/pairing.service': { pairingService: {
        generate: async (patientId, scopes, label) => { calls.push({ op: 'generate', patientId, scopes, label }); return { code: 'ABCDEF0123456789', expiresAt: new Date(Date.now() + 900000).toISOString() }; },
        claim: async code => { calls.push({ op: 'claim', code }); return { patientId: 'two', accessRole: 'family', scopes: ['reports'], label: 'Son' }; },
        list: async () => JSON.parse(JSON.stringify(links)),
        revoke: async (patientId, memberId) => { calls.push({ op: 'revoke', patientId, memberId }); links = { received: [], granted: [] }; },
        snapshot: async patientId => { calls.push({ op: 'snapshot', patientId }); return snapshot ?? { patientId, displayName: 'Synthetic elder', scopes: ['reports'], counts: null, sessions: null, reminders: [], memories: null, reports: null }; },
      } },
    };
    const render = screen('components/caregiver/pairing-panel.tsx', overrides, { data });
    render(); await tick();
    let tree = nodes(render());
    const button = label => tree.find(n => n.type === 'SmaranButton' && n.props.label === label);
    const field = label => tree.find(n => n.type === 'Field' && n.props.label === label);
    assert.ok(button(t(language, 'pairingGenerate')), language + ' generate control');
    for (const scope of Object.values(scopeKeys)) { button(t(language,scope)).props.onPress(); tree=nodes(render()); }
    button(t(language, 'pairingGenerate')).props.onPress(); await tick(); tree = nodes(render());
    assert.ok(tree.some(n => n.props?.children === 'ABCDEF0123456789'), language + ' code shown once for sharing');
    assert.deepEqual(calls[0], { op: 'generate', patientId: 'one', scopes: ['daily_activity', 'reminders', 'cognitive_activity', 'reports', 'memories'], label: '' });
    field(t(language, 'pairingEnterCode')).props.onChangeText('abcdef0123456789');
    tree = nodes(render());
    button(t(language, 'pairingClaim')).props.onPress(); await tick(); tree = nodes(render());
    assert.deepEqual(calls.at(-2), { op: 'claim', code: 'ABCDEF0123456789' });
    assert.ok(tree.some(n => n.props?.children === 'Synthetic elder'), language + ' claimed snapshot shown');
    assert.ok(button(t(language, 'pairingView')), language + ' received entry');
    button(t(language, 'pairingView')).props.onPress(); await tick(); tree = nodes(render());
    assert.deepEqual(calls.at(-1), { op: 'snapshot', patientId: 'two' });
    const leave = tree.find(n => n.type === 'SmaranButton' && n.props.accessibilityLabel === `${t(language, 'pairingLeave')}: Synthetic elder`);
    assert.ok(leave, language + ' leave control');
    leave.props.onPress(); await tick(); tree = nodes(render());
    assert.deepEqual(calls.at(-1), { op: 'revoke', patientId: 'two', memberId: undefined });
    assert.ok(!tree.some(n => n.props?.label === t(language, 'pairingView')), language + ' revoked entry disappears after reload');
  }
  console.log('PASS pairing UI: scoped code generation, one-time code display, claim-to-snapshot, received/granted lists and revoke across languages.');
}

async function main() { structuralChecks(); await pgChecks(); await clientChecks(); await uiChecks(); }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
