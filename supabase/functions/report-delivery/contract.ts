type Config = { enabled: boolean; token: string; phoneId: string; version: string; template: string; language: string;
  appSecret: string; verifyToken: string; workerSecret: string };
type Claim = { ok: true; claim: string; destination: string; start: string; end: string;
  scopes: string[]; snapshot: { days: number; games: { gameType: string; sessions: number; attempts: number | null; correct: number | null }[];
    routine: { completed: number }; memories: { stored: number; added: number } } };
type Job = { owner_id: string; patient_id: string; delivery_id: string };
type Dependencies = { config: Config; authenticate: (token: string) => Promise<string | null>;
  pending: () => Promise<Job[]>; claim: (job: Job) => Promise<Claim | { ok: false; error: string }>;
  finish: (claim: string, result: string, message?: string) => Promise<void>; fetch?: typeof fetch };
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = /^[A-Za-z0-9_-]{1,128}$/;
const response = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export function deliveryConfig(env: (key: string) => string | undefined): Config {
  return { enabled: env('REPORT_DELIVERY_ENABLED') === 'true', token: env('WHATSAPP_ACCESS_TOKEN') ?? '',
    phoneId: env('WHATSAPP_PHONE_NUMBER_ID') ?? '', version: env('WHATSAPP_GRAPH_VERSION') ?? '',
    template: env('WHATSAPP_REPORT_TEMPLATE') ?? '', language: env('WHATSAPP_TEMPLATE_LANGUAGE') ?? '',
    appSecret: env('WHATSAPP_APP_SECRET') ?? '', verifyToken: env('WHATSAPP_VERIFY_TOKEN') ?? '',
    workerSecret: env('REPORT_DELIVERY_WORKER_SECRET') ?? '' };
}
export function configured(config: Config) {
  return config.enabled && /^[A-Za-z0-9._-]{20,4096}$/.test(config.token) && /^\d{5,32}$/.test(config.phoneId) && /^v\d{1,3}\.0$/.test(config.version) &&
    /^[a-z0-9_]{1,512}$/.test(config.template) && /^en(?:_US|_GB)?$/.test(config.language) &&
    config.appSecret.length >= 16 && config.verifyToken.length >= 32 && config.workerSecret.length >= 32;
}
async function sameSecret(actual: string, expected: string) {
  if (!expected || actual.length > 8192) return false;
  const [a, b] = await Promise.all([actual, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  let difference = 0; const bytes = new Uint8Array(b);
  new Uint8Array(a).forEach((value, index) => { difference |= value ^ bytes[index]; });
  return difference === 0;
}
export async function readBody(request: Pick<Request, 'headers' | 'body'>, limit: number) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Error('invalid');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  const chunks: Uint8Array[] = []; let length = 0, expired = false;
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) { void reader.cancel().catch(() => {}); throw new Error('too_large'); }
      chunks.push(value);
    }
    if (expired) throw new Error('invalid');
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

// One positional body parameter; the approved template supplies the surrounding non-clinical wording.
export function reportText(claim: Claim) {
  const { snapshot: facts, scopes } = claim;
  if (!uuid.test(claim.claim) || !/^\+[1-9]\d{4,14}$/.test(claim.destination) || !scopes.includes('reports') ||
      ![7,30].includes(facts.days) || !Number.isFinite(Date.parse(claim.start)) || !Number.isFinite(Date.parse(claim.end))) throw new Error('invalid');
  const count = (n: number) => { if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid'); return n; };
  const lines = [`${facts.days}-day activity summary (${claim.start.slice(0,10)} to ${claim.end.slice(0,10)}, end exclusive).`];
  if (scopes.includes('cognitive_activity')) {
    for (const game of facts.games) {
      if (!/^[a-z_]{1,40}$/.test(game.gameType)) throw new Error('invalid');
      lines.push(`${game.gameType.replaceAll('_',' ')}: ${count(game.sessions)} sessions${game.attempts === null || game.correct === null ? '' : `, ${count(game.correct)}/${count(game.attempts)} correct attempts`}.`);
    }
  }
  if (scopes.includes('daily_activity') || scopes.includes('reminders')) lines.push(`Routine completions: ${count(facts.routine.completed)}.`);
  if (scopes.includes('memories')) lines.push(`Memories stored: ${count(facts.memories.stored)}; added: ${count(facts.memories.added)}.`);
  const text = lines.join(' ');
  if (text.length > 950) throw new Error('invalid');
  return text;
}

export async function sendReport(claim: Claim, config: Config, send = fetch): Promise<{ result: string; message?: string }> {
  // Validate before any network work; never log destination, body, token, or provider errors.
  const text = reportText(claim);
  try {
    const result = await send(`https://graph.facebook.com/${config.version}/${config.phoneId}/messages`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: claim.destination,
        type: 'template', biz_opaque_callback_data: claim.claim,
        template: { name: config.template, language: { code: config.language },
          components: [{ type: 'body', parameters: [{ type: 'text', text }] }] } }),
    });
    if (result.status === 429) { await result.body?.cancel(); return { result: 'rate_limited' }; }
    if (result.status >= 400 && result.status < 500 && result.status !== 408) { await result.body?.cancel(); return { result: 'rejected' }; }
    if (!result.ok) { await result.body?.cancel(); return { result: 'unknown' }; }
    const data = JSON.parse(new TextDecoder().decode(await readBody(result, 16384)));
    const message = data?.messages?.[0]?.id;
    return typeof message === 'string' && message.length > 0 && message.length <= 256
      ? { result: 'accepted', message } : { result: 'unknown' };
  } catch { return { result: 'unknown' }; }
}

async function webhook(request: Request, deps: Dependencies) {
  const signature = request.headers.get('x-hub-signature-256') ?? '';
  if (!/^sha256=[a-f0-9]{64}$/.test(signature) || !deps.config.appSecret) return response(401,'auth');
  const bytes = await readBody(request, 65536);
  const key = await crypto.subtle.importKey('raw', encoder.encode(deps.config.appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const expected = Uint8Array.from(signature.slice(7).match(/../g)!, value => parseInt(value,16));
  if (!await crypto.subtle.verify('HMAC', key, expected, bytes)) return response(401,'auth');
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return response(400,'invalid');
  for (const entry of body.entry) for (const change of entry.changes ?? []) {
    if (change.field !== 'messages' || change.value?.metadata?.phone_number_id !== deps.config.phoneId) continue;
    for (const receipt of change.value.statuses ?? []) {
      if (!uuid.test(receipt.biz_opaque_callback_data ?? '') || typeof receipt.id !== 'string' || receipt.id.length > 256 ||
          !['sent','delivered','read','failed'].includes(receipt.status)) continue;
      await deps.finish(receipt.biz_opaque_callback_data, receipt.status, receipt.id);
    }
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleDelivery(request: Request, deps: Dependencies): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams, challenge = query.get('hub.challenge');
      if (query.get('hub.mode') !== 'subscribe' || !challenge || !/^\d{1,128}$/.test(challenge) ||
          !await sameSecret(query.get('hub.verify_token') ?? '', deps.config.verifyToken)) return response(401,'auth');
      return new Response(challenge, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' } });
    }
    if (request.method !== 'POST') return response(405,'method');
    // Receipts still reconcile when sending is disabled during an incident.
    if (request.headers.has('x-hub-signature-256')) return await webhook(request, deps);
    if (!configured(deps.config)) return response(503,'not_configured');
    let owner: string | null = null;
    const worker = await sameSecret(request.headers.get('x-report-worker-secret') ?? '', deps.config.workerSecret);
    if (!worker) {
      const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
      if (!token || !(owner = await deps.authenticate(token))) return response(401,'auth');
    }
    const body = JSON.parse(new TextDecoder().decode(await readBody(request, 1024)));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response(400,'invalid');
    let jobs: Job[];
    if (worker) {
      if (Object.keys(body).length) return response(400,'invalid');
      jobs = await deps.pending();
    } else {
      if (Object.keys(body).sort().join() !== 'delivery_id,patient_id' || typeof body.patient_id !== 'string' ||
          typeof body.delivery_id !== 'string' || !id.test(body.patient_id) || !id.test(body.delivery_id)) return response(400,'invalid');
      jobs = [{ owner_id: owner!, patient_id: body.patient_id, delivery_id: body.delivery_id }];
    }
    if (!Array.isArray(jobs) || jobs.length > 3) throw new Error('unavailable');
    const results: string[] = [];
    for (const job of jobs) {
      const claim = await deps.claim(job);
      if (!claim.ok) { results.push(claim.error === 'already_claimed' ? 'already_claimed' : 'forbidden'); continue; }
      let result: { result: string; message?: string };
      try { result = await sendReport(claim, deps.config, deps.fetch); }
      catch { result = { result: 'rejected' }; }
      await deps.finish(claim.claim, result.result, result.message);
      results.push(result.result);
    }
    if (!worker && results[0] === 'forbidden') return response(403,'forbidden');
    // Provider acceptance is not a delivered receipt. No private data is returned.
    return Response.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return response(error instanceof SyntaxError ? 400 : error instanceof Error && error.message === 'too_large' ? 413 :
      error instanceof Error && error.message === 'invalid' ? 400 : 503, 'unavailable');
  }
}
