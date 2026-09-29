const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { runtime } = require('./check-care-circle-reports.cjs');
const { seed, A } = require('./check-auth-sync-migration.cjs');
const { load } = require('./check-elderly-ux.cjs');

async function workerChecks() {
  const { handleDelivery, deliveryConfig, sendReport, reportText } = load('supabase/functions/report-delivery/contract.ts');
  const config = { enabled: true, token: 'synthetic-provider-token', phoneId: '1234567890', version: 'v25.0',
    template: 'synthetic_report', language: 'en', appSecret: 'synthetic-app-secret', verifyToken: 'v'.repeat(32), workerSecret: 'w'.repeat(32) };
  const claim = { ok: true, claim: '11111111-1111-4111-8111-111111111111', destination: '+15551234567',
    start: '2026-09-01T00:00:00Z', end: '2026-09-08T00:00:00Z', scopes: ['reports','cognitive_activity'],
    snapshot: { days: 7, games: [{ gameType: 'memory_match', sessions: 1, attempts: 4, correct: 3 }],
      routine: { completed: 99 }, memories: { stored: 88, added: 77 } } };
  assert.match(reportText(claim), /3\/4 correct attempts/);
  assert.doesNotMatch(reportText(claim), /99|88|77|Memories|Routine/);
  assert.doesNotMatch(reportText({ ...claim, scopes: ['reports'] }), /memory match/);
  assert.throws(() => reportText({ ...claim, scopes: [] }));
  let sends = 0, claims = 0, completed = [], auth = A, available = true;
  const fetch = async (url, options) => {
    sends++; assert.equal(url, 'https://graph.facebook.com/v25.0/1234567890/messages');
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    const body = JSON.parse(options.body);
    assert.equal(body.biz_opaque_callback_data, claim.claim); assert.equal(body.type, 'template');
    assert.equal(body.template.components[0].parameters[0].type, 'text');
    return Response.json({ messages: [{ id: 'synthetic-message-id' }] });
  };
  const deps = { config, authenticate: async () => auth, pending: async () => [{ owner_id: A, patient_id: 'one', delivery_id: 'delivery' }],
    claim: async job => { claims++; assert.equal(job.owner_id, A); if (!available) return { ok: false, error: 'already_claimed' }; available = false; return claim; },
    finish: async (...args) => { completed.push(args); }, fetch };
  const req = (body = { patient_id: 'one', delivery_id: 'delivery' }, headers = {}) => new Request('https://example.invalid', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'a'.repeat(24), ...headers }, body: JSON.stringify(body) });
  assert.equal((await handleDelivery(req(), { ...deps, config: deliveryConfig(() => undefined) })).status, 503);
  assert.equal(sends + claims, 0);
  auth = null; assert.equal((await handleDelivery(req(), deps)).status, 401); auth = A;
  assert.equal((await handleDelivery(req({ patient_id: 'one', delivery_id: 'delivery', owner_id: A }), deps)).status, 400);
  assert.equal((await handleDelivery(req({ patient_id: 123, delivery_id: ['delivery'] }), deps)).status, 400);
  assert.equal((await handleDelivery(req(), { ...deps, claim: async () => ({ ok: false, error: 'forbidden' }) })).status, 403);
  assert.equal((await handleDelivery(req({ patient_id: 'one', delivery_id: 'x'.repeat(2000) }), deps)).status, 413);
  assert.deepEqual(await (await handleDelivery(req(), deps)).json(), { ok: true, results: ['accepted'] });
  assert.deepEqual(completed[0], [claim.claim, 'accepted', 'synthetic-message-id']);
  assert.deepEqual(await (await handleDelivery(req(), deps)).json(), { ok: true, results: ['already_claimed'] });
  assert.equal(sends, 1);
  available = true;
  assert.equal((await handleDelivery(req({}, { 'x-report-worker-secret': config.workerSecret }), deps)).status, 200);
  assert.equal(sends, 2);
  for (const [status, result] of [[429,'rate_limited'],[400,'rejected'],[401,'rejected'],[500,'unknown'],[408,'unknown']]) {
    assert.deepEqual(await sendReport(claim, config, async () => new Response('', { status })), { result });
  }
  assert.deepEqual(await sendReport(claim, config, async () => { throw Error('synthetic timeout'); }), { result: 'unknown' });
  assert.deepEqual(await sendReport(claim, config, async () => Response.json({})), { result: 'unknown' });
  assert.equal((await handleDelivery(req(), { ...deps, claim: async () => { throw Error('private detail'); } })).status, 503);
  const verification = new Request('https://example.invalid?hub.mode=subscribe&hub.challenge=123&hub.verify_token=' + config.verifyToken);
  assert.equal(await (await handleDelivery(verification, deps)).text(), '123');
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: config.phoneId }, statuses: [{ id: 'synthetic-message-id', status: 'delivered', biz_opaque_callback_data: claim.claim }],
  } }] }] });
  const signature = require('node:crypto').createHmac('sha256', config.appSecret).update(body).digest('hex');
  const hook = sig => new Request('https://example.invalid', { method: 'POST', body, headers: {
    'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + sig } });
  const before = completed.length;
  assert.equal((await handleDelivery(hook('0'.repeat(64)), deps)).status, 401); assert.equal(completed.length, before);
  assert.equal((await handleDelivery(hook(signature), { ...deps, config: { ...config, enabled: false } })).status, 200);
  assert.deepEqual(completed.at(-1), [claim.claim, 'delivered', 'synthetic-message-id']);
  console.log('PASS worker auth, body limits, disabled boundary, scope filtering, Meta request/receipt contract, failure classification and HMAC webhook verification (synthetic transport).');
}

async function main() {
  for (const file of fs.readdirSync('src/db/migrations').filter(f => /^\d{3}_/.test(f)).map(f => 'src/db/migrations/' + f)) {
    const original = execFileSync('git', ['show', `d99ec29:${file}`], { encoding: 'utf8' });
    assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), original.replace(/\r\n/g, '\n'), file + ' unchanged');
  }
  const r = runtime();
  try {
    await r.run(r.db); await seed(r.db); await r.sync.link(A, () => true);
    const guard = r.current();
    const input = { display_name: 'Synthetic recipient', relationship: 'doctor', access_role: 'healthcare_worker',
      email: null, phone: '+15551234567', scopes: ['reports', 'cognitive_activity'] };
    const member = await r.repo.save('one', input, guard);
    const recipient = await r.repo.saveRecipient('one', member.id, input.phone, 'weekly', true, guard);
    await assert.rejects(r.repo.saveRecipient('two', member.id, input.phone, 'weekly', true, guard), /recipient/);
    await assert.rejects(r.repo.saveRecipient('one', member.id, input.phone, 'weekly', true, guard, 'missing'), /Missing/);
    await assert.rejects(r.repo.saveRecipient('one', member.id, '+15557654321', 'weekly', true, guard), /phone/);
    const { normalizePhoneNumber } = r.module('src/db/repositories/care-circle.repository.ts');
    assert.equal(normalizePhoneNumber('9876543210'), '+919876543210');
    assert.equal(normalizePhoneNumber('+1 555-123-4567'), input.phone);
    assert.throws(() => normalizePhoneNumber('123'));
    const games = r.module('src/db/schema.types.ts').CognitiveActivityTypes;
    const facts = days => ({ patientName: 'Synthetic patient', days, timezone: 'UTC',
      games: games.map(gameType => ({ gameType, sessions: 0, attempts: null, correct: null, hints: null, repeatedErrors: null })),
      routine: { completed: 0, hydration: 0, activity: 0, appointment: 0, unknownCategory: 0, scheduledToday: 0, completedToday: 0 },
      memories: { stored: 0, added: 0 } });
    for (const days of [7, 30]) {
      const start = '2026-09-01T00:00:00.000Z', end = new Date(Date.parse(start) + days * 86400000).toISOString();
      const reportInput = { period_start: start, period_end: end, generated_at: end, report_version: 1, snapshot: JSON.stringify(facts(days)) };
      const report = await r.repo.saveReport('one', reportInput, guard);
      const queue = (patient = 'one', snapshot = report.id, period = `${days}-day`, from = start) =>
        r.repo.queueDelivery(patient, recipient.id, period, from, end, snapshot, guard);
      const first = await queue(), outboxCount = r.rows('sync_outbox').length;
      assert.equal(first.status, 'queued'); assert.equal(first.provider_message_id, null);
      assert.deepEqual(await queue(), first, 'retry returns the original queued intent');
      assert.equal(r.rows('sync_outbox').length, outboxCount, 'retry creates no mutation');
      await assert.rejects(queue('two'), /Missing report recipient/);
      await assert.rejects(queue('one', 'missing'), /Missing report snapshot/);
      await assert.rejects(queue('one', report.id, days === 7 ? '30-day' : '7-day'), /period/);
      await assert.rejects(queue('one', report.id, `${days}-day`, '2026-08-01'), /period/);
      const replacement = await r.repo.saveReport('one', reportInput, guard);
      await assert.rejects(queue('one', replacement.id), /different snapshot/);
      await assert.rejects(r.repo.queueDelivery('one', recipient.id, `${days}-day`, start, end, report.id, () => false), /changed/);
    }
    assert.equal((await r.repo.deliveries('one')).length, 2);
    const report = (await r.repo.reports('one'))[0];
    const queue = () => r.repo.queueDelivery('one', recipient.id, '30-day', report.period_start, report.period_end, report.id, guard);
    await r.repo.save('one', { ...input, scopes: [] }, guard, member.id);
    await assert.rejects(queue(), /access changed/);
    await assert.rejects(r.repo.saveRecipient('one', member.id, input.phone, 'weekly', true, guard, recipient.id), /access/);
    await r.repo.save('one', { ...input, phone: '+15557654321' }, guard, member.id);
    await assert.rejects(queue(), /access changed/);
    await r.repo.save('one', input, guard, member.id);
    await r.repo.saveRecipient('one', member.id, input.phone, 'weekly', false, guard, recipient.id);
    await assert.rejects(queue(), /consented/);
    await r.repo.saveRecipient('one', member.id, input.phone, 'weekly', true, guard, recipient.id);
    await r.repo.revoke('one', member.id, guard);
    await assert.rejects(queue(), /access changed/);
    const before = r.rows('report_deliveries'); await r.run(r.db);
    assert.deepEqual(r.rows('report_deliveries'), before, 'migration rerun preserves queued intents');
    assert.deepEqual(await r.db.getAllAsync('PRAGMA foreign_key_check'), []);
    for (const event of r.rows('sync_outbox').filter(e => ['report_recipients', 'report_deliveries'].includes(e.entity_type))) {
      r.module('src/cloud/sync-contract.ts').validateCloudRecord({ ...event, payload: JSON.parse(event.payload), deleted: false, version: 1 }, A);
    }
  } finally { r.sqlite.close(); }
  console.log('PASS unchanged migration history, real SQLite queue/retry without duplicate mutations, 7/30-day snapshot matching.');
  console.log('PASS recipient/patient isolation, stale requests, revoked consent, changed scopes/phone, missing recipient updates and foreign keys.');
  console.log('PASS generated recipient/delivery outbox payload validation. Queueing does not prove provider delivery.');
  await workerChecks();
}
module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
