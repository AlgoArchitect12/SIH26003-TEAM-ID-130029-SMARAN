export const activities = ['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall'] as const;
export const languages = ['en','hi','as','bn','mni','kha','lus'] as const;
export type InstructionRequest = { version: 1; task: 'game-instruction'; activity: typeof activities[number]; language: typeof languages[number] };

export function validInstruction(value: unknown): value is InstructionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as InstructionRequest;
  return Object.keys(r).sort().join(',') === 'activity,language,task,version' && r.version === 1 &&
    r.task === 'game-instruction' && activities.includes(r.activity) && languages.includes(r.language);
}
export async function handleOnlineAI(request: Request, authenticated: (token: string) => Promise<boolean>) {
  const response = (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message } }, { status });
  if (request.method !== 'POST') return response(405, 'method', 'Use a supported request.');
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
  if (!token) return response(401, 'auth', 'Sign in to use online enhancements.');
  try { if (!await authenticated(token)) return response(401, 'auth', 'Sign in to use online enhancements.'); }
  catch { return response(503, 'unavailable', 'Online enhancement is temporarily unavailable.'); }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return response(400, 'invalid', 'This request is not supported.');
  const reader = request.body?.getReader();
  if (!reader) return response(400, 'invalid', 'This request is not supported.');
  let size = 0;
  let body = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return response(413, 'too-large', 'This request is too large.'); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    if (!validInstruction(JSON.parse(body))) return response(400, 'invalid', 'This request is not supported.');
  } catch { return response(400, 'invalid', 'This request is not supported.'); }
  // No provider is wired. No prompt, history, diagnosis or generated medical advice is accepted or fabricated.
  return response(503, 'not-configured', 'Online AI enhancement is not configured.');
}
