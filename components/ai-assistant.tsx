import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AppState, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Field } from '@components/ui/smaran-field';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import type { Language } from '@/src/db/schema.types';
import { useAuthStore } from '@/src/cloud/auth';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';
import { askAssistant } from '@/src/services/ai-assistant.service';
import { stopSpeech } from '@/src/services/speech.service';
import { activityTitleKeys } from '@/src/games/presentation';
import type { AssistantAnswer, AssistantIntent } from '@/supabase/functions/ai-care-assistant/contract';

export function AiAssistant({ patientId, language, patient = false }: { patientId: string; language: Language; patient?: boolean }) {
  const focused = useIsFocused(), authRevision = useAuthStore(s => s.revision);
  const revision = usePatientSessionStore(s => s.revision), workspace = usePatientSessionStore(s => s.workspaceRevision);
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null), [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => { request.current?.abort(); request.current = null; setQuestion(''); setAnswer(null); setError(null); setBusy(false); void stopSpeech(); };
    clear();
    const app = AppState.addEventListener('change', state => { if (state !== 'active') clear(); });
    return () => { clear(); app.remove(); };
  }, [patientId, language, focused, authRevision, revision, workspace]);
  const ask = async (intent: AssistantIntent) => {
    if (request.current || !focused) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setAnswer(null); setError(null);
    try {
      const result = await askAssistant(patientId, intent, question, { language, signal: controller.signal,
        isCurrent: () => request.current === controller && !controller.signal.aborted });
      if (!controller.signal.aborted) setAnswer(result);
    } catch (failure) {
      const key = failure instanceof Error ? failure.message : '';
      if (!controller.signal.aborted) setError((['aiSignIn','aiOffline','aiNotConfigured','aiUnavailable','aiMedical','aiRateLimited','aiUnsafe','pairingForbidden'] as string[]).includes(key) ? key as TranslationKey : 'aiFailed');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  const factText = answer?.facts.map(f => {
    const label: TranslationKey = f.kind === 'session' ? 'circleCognitive' : f.kind === 'memory' ? 'circleMemories' : f.kind === 'completed' ? 'dayDone' : 'dayPending';
    const value = f.kind === 'session' && f.text in activityTitleKeys ? t(language, activityTitleKeys[f.text as keyof typeof activityTitleKeys]) : f.text;
    return `${t(language, label)}: ${value}${f.at ? ` · ${f.at}` : ''}`;
  }) ?? [];
  return <View style={PageLayout.group}>
    <ThemedText type="cardHeading">{t(language, patient ? 'aiPatientTitle' : 'aiTitle')}</ThemedText>
    <ThemedText>{t(language, 'aiDisclaimer')}</ThemedText>
    <ThemedText type="secondary">{t(language, 'aiContextNote')}</ThemedText>
    <Field label={t(language, 'aiQuestion')} value={question} onChangeText={setQuestion} maxLength={500} multiline editable={!busy} />
    {([['today_summary','aiSummary'],['week_summary','aiWeek'],['memory_prompt','aiPrompt'],['routine_wording','aiWording'],['game_help','aiGameHelp'],
      [patient ? 'patient_ask' : 'caregiver_ask','aiSend']] as [AssistantIntent, TranslationKey][]).map(([intent,label]) =>
      <SmaranButton key={intent} label={t(language,label)} accessibilityLabel={t(language,label)} disabled={busy}
        variant="outline" onPress={() => void ask(intent)} />)}
    {busy && <ThemedText accessibilityLiveRegion="polite">{t(language,'accountWorking')}</ThemedText>}
    {error && <ThemedText accessibilityRole="alert">{t(language,error)}</ThemedText>}
    {answer && <View style={PageLayout.group} accessibilityLiveRegion="polite">
      <ThemedText type="cardHeading">{t(language,'aiGrounded')}</ThemedText>
      {factText.length ? factText.map((text,i) => <ThemedText key={i}>{text}</ThemedText>) : <ThemedText>{t(language,'aiNoData')}</ThemedText>}
      <ThemedText type="cardHeading">{t(language,'aiSuggestion')}</ThemedText>
      <ThemedText>{t(language,answer.suggestion)}</ThemedText>
      <ReadScreenButton language={language} text={[...factText,t(language,answer.suggestion)].join('. ')} />
    </View>}
  </View>;
}
