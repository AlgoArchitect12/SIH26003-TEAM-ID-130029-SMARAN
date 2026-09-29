import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { deliveryConfig, handleDelivery } from './contract.ts';

const env = (key: string) => Deno.env.get(key);
function cloud(privileged = false) {
  const url = env('SUPABASE_URL'), key = env(privileged ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await cloud(true).rpc(name, args);
  if (error) throw new Error('unavailable');
  return data;
}
Deno.serve(request => handleDelivery(request, {
  config: deliveryConfig(env),
  authenticate: async token => { const { data, error } = await cloud().auth.getUser(token); return error ? null : data.user?.id ?? null; },
  pending: () => rpc('report_delivery_pending'),
  claim: job => rpc('report_delivery_claim', { p_owner: job.owner_id, p_patient: job.patient_id, p_delivery: job.delivery_id }),
  finish: (claim, result, message) => rpc('report_delivery_finish', { p_claim: claim, p_result: result, p_message: message ?? null }),
}));
