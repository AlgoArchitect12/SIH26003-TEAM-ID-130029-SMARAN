import { captureAccount, getCloudClient } from '../cloud/auth';
import { cloudConfig } from '../cloud/config';
import { capturePatientRequest, usePatientSessionStore } from '../stores/patient-session.store';
import { localDay } from '../my-day/types';
import type { Language } from '../db/schema.types';
import { assistantIntents, refusesMedical, suggestionKeys, type AssistantIntent, type AssistantAnswer } from '../../supabase/functions/ai-care-assistant/contract';

export async function askAssistant(patientId:string,intent:AssistantIntent,question='',
  options:{language:Language;signal:AbortSignal;isCurrent:()=>boolean}):Promise<AssistantAnswer> {
  const account = captureAccount(), patient = capturePatientRequest();
  const workspace = usePatientSessionStore.getState().workspaceRevision;
  const current = () => account.current() && patient() && options.isCurrent() && !options.signal.aborted &&
    usePatientSessionStore.getState().workspaceRevision === workspace;
  const check = () => { if (!current()) throw new Error('aiSignIn'); };
  check();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(patientId) || !assistantIntents.includes(intent) || question.length > 500) throw new Error('aiFailed');
  if (refusesMedical(question)) throw new Error('aiMedical');
  if (!cloudConfig) throw new Error('aiNotConfigured');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal.addEventListener('abort',cancel);
  account.signal.addEventListener('abort',cancel);
  const timer = setTimeout(cancel,25000);
  try {
    const {data,error} = await getCloudClient().auth.getSession();
    check();
    if (error || !data.session) throw new Error('aiSignIn');
    const response = await fetch(cloudConfig.url+'/functions/v1/ai-care-assistant',{
      method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json',apikey:cloudConfig.key,authorization:'Bearer '+data.session.access_token},
      body:JSON.stringify({version:1,patient_id:patientId,intent,language:options.language,question:question.trim(),
        day:localDay(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}),
    });
    check();
    const payload = await response.json();
    check();
    if (!response.ok) {
      const codes:Record<string,string> = {auth:'aiSignIn',forbidden:'pairingForbidden',medical:'aiMedical',
        'not-configured':'aiNotConfigured',rate_limited:'aiRateLimited',unsafe:'aiUnsafe'};
      throw new Error(codes[payload?.error?.code] ?? 'aiUnavailable');
    }
    if (payload?.intent !== intent || !suggestionKeys.includes(payload.suggestion) || !Array.isArray(payload.facts) ||
      payload.facts.length > 50 || payload.facts.some((f:Record<string,unknown>) => !f ||
        !['session','pending','completed','memory'].includes(String(f.kind)) ||
        typeof f.id !== 'string' || typeof f.text !== 'string' || f.text.length > 710 || typeof f.at !== 'string')) throw new Error('aiUnsafe');
    return payload;
  } catch (error) {
    check();
    if (error instanceof Error && /^(ai|pairing)/.test(error.message)) throw error;
    throw new Error(controller.signal.aborted ? 'aiUnavailable' : 'aiOffline');
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort',cancel);
    account.signal.removeEventListener('abort',cancel);
  }
}

