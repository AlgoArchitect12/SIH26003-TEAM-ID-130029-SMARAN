import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handleOnlineAI } from './contract.ts';

Deno.serve(request => handleOnlineAI(request, async token => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Gateway configuration missing.');
  const cloud = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
  const { data, error } = await cloud.auth.getUser(token);
  return !error && !!data.user;
}));
