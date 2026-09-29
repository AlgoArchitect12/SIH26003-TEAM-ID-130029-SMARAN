// Fail closed until an authenticated, owner-scoped, idempotent delivery worker
// and an approved provider template are configured and verified.
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
  status: 503,
  headers: { 'Content-Type': 'application/json' },
}));
