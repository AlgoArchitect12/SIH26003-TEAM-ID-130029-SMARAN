import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { AssistantRateLimiter, callAssistantProvider, callBhashiniTts, callGemini, handleAssistant } from './contract.ts';

const limiter = new AssistantRateLimiter();
Deno.serve(request => handleAssistant(request, {
  authenticated: async token => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Gateway configuration missing.');
    const cloud = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
    const { data, error } = await cloud.auth.getUser(token);
    if (error || !data.user) return 'denied';
    return limiter.take(data.user.id) ? 'ok' : 'limited';
  },
  context: async (token, request) => {
    const cloud = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
    });
    const { data, error } = await cloud.rpc('assistant_context', { p_patient: request.patient_id, p_day: request.day });
    if (error) throw new Error('Context unavailable.');
    return data?.ok === true ? data : null;
  },
  provider: (system, user) => callAssistantProvider({
    provider: Deno.env.get('AI_PROVIDER') ?? 'none',
    apiUrl: Deno.env.get('AI_API_URL') ?? '',
    apiKey: Deno.env.get('AI_API_KEY') ?? '',
    model: Deno.env.get('AI_MODEL') ?? '',
  }, system, user),
  bhashiniTts: (text, language, gender) => callBhashiniTts({
    provider: Deno.env.get('BHASHINI_PROVIDER') ?? 'none',
    apiUrl: Deno.env.get('BHASHINI_API_URL') ?? '',
    apiKey: Deno.env.get('BHASHINI_API_KEY') ?? '',
    model: '',
  }, text, language, gender),
  geminiCall: (text, language) => callGemini({
    provider: Deno.env.get('GEMINI_PROVIDER') ?? 'none',
    apiUrl: Deno.env.get('GEMINI_API_URL') ?? '',
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
    model: Deno.env.get('GEMINI_MODEL') ?? '',
  }, text),
}));
