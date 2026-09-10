import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { CurrentPerson } from '@components/patient/current-person';
import { useIsFocused } from '@react-navigation/native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { MemoryPhoto } from '@components/memories/memory-photo';
import { category } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Spacing } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { PatientSelectionRequiredError, resolveActivePatient } from '@services/active-patient.service';
import { loadCaregiverDashboard } from '@services/caregiver.service';
import type { CareActivity, CaregiverDashboard, UpcomingReminder } from '@/src/caregiver/types';
import { activityFacts, activityTitleKeys } from '@/src/games/presentation';
import { timeLabel } from '@/src/my-day/types';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}>
    <ThemedText type="cardHeading" accessibilityRole="header">{title}</ThemedText>
    {children}
  </View>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <SmaranCard style={styles.metric}>
    <View accessible accessibilityLabel={`${label}. ${value}`} style={styles.group}>
      <ThemedText type="secondary">{label}</ThemedText>
      <ThemedText type="action">{value}</ThemedText>
    </View>
  </SmaranCard>;
}
const eventKeys: Record<CareActivity['kind'], TranslationKey> = {
  session: 'careSessionEvent', reminder: 'careReminderEvent', memoryCreated: 'careMemoryCreated', memoryUpdated: 'careMemoryUpdated',
};

export default function CaregiverHomeScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const voiceGuidance = useOnboardingStore(state => state.accessibility.voiceGuidance);
  const [data, setData] = useState<CaregiverDashboard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    const current = capturePatientRequest();
    setStatus('loading'); setData(null);
    void (async () => {
      const resolution = await resolveActivePatient();
      if (!active || !current()) return;
      if (resolution.status !== 'ready') { setStatus('missing'); return; }
      const store = useOnboardingStore.getState();
      store.setLanguage(resolution.settings.language);
      store.setAccessibilityPreferences({
        textSize: resolution.settings.textSize, highContrast: resolution.settings.highContrast,
        reducedMotion: resolution.settings.reducedMotion, voiceGuidance: resolution.settings.voiceGuidance,
      });
      const dashboard = await loadCaregiverDashboard(resolution.profile.id);
      if (active && current()) { setData(dashboard); setStatus(dashboard ? 'ready' : 'missing'); }
    })().catch(error => {
      if (!active || !current()) return;
      if (error instanceof PatientSelectionRequiredError) router.replace({ pathname: '/profiles', params: { view: 'caregiver' } });
      else setStatus('failed');
    });
    return () => { active = false; };
  }, [focused, attempt, router]);

  const back = () => data ? router.dismissTo('/patient/home') : router.canGoBack() ? router.back() : router.replace('/onboarding/role');
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(language, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
  const upcomingText = (item: UpcomingReminder) => `${item.reminder.title} • ${date(item.scheduledAt)}`;
  const latest = data?.cognitive.recent[0];
  const summary = data ? [
    t(language, 'homeCareTitle'), data.patient.preferredName, t(language, 'careLocal'),
    t(language, 'careToday'), t(language, 'careCount', { count: number(data.cognitive.today) }),
    t(language, 'careDoneCount', { done: number(data.routine.done), total: number(data.routine.today.length) }),
    t(language, 'careMemories', { count: number(data.memories.count) }),
    ...data.memories.recent.map(memory => `${memory.name}. ${memory.relationship}`),
    t(language, 'careNext'), data.upcoming[0] ? upcomingText(data.upcoming[0]) : t(language, 'careNoUpcoming'),
    t(language, 'careAppointment'), data.appointment ? upcomingText(data.appointment) : t(language, 'careNoAppointment'),
    latest ? t(language, 'careNextLevel', { level: number(latest.recommendedDifficulty) }) : t(language, 'careNoSessions'),
    latest ? t(language, activityTitleKeys[latest.gameType]) + '. ' + t(language, 'careLevelSource') : '', t(language, 'careDisclaimer'),
  ].join('. ') : '';
  return <ScreenWrapper scroll><View style={styles.content}>
    <Stack.Screen options={{ animation: 'none' }} />
    <SmaranButton label={t(language, data ? 'backHome' : 'back')} accessibilityLabel={t(language, data ? 'backHome' : 'back')} variant="outline" onPress={back} />
    <View style={styles.group}>
      <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeCareTitle')}</ThemedText>
      <ThemedText type="secondary">{t(language, 'careLocal')}</ThemedText>
      <CurrentPerson name={data?.patient.preferredName} language={language} caregiver />
    </View>
    {status === 'loading' && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {status === 'failed' && <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, 'careFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => setAttempt(n => n + 1)} />
    </View>}
    {status === 'missing' && <SmaranCard style={styles.group}>
      <ThemedText>{t(language, 'careMissing')}</ThemedText>
      <SmaranButton label={t(language, 'homeReturnSetup')} accessibilityLabel={t(language, 'homeReturnSetup')}
        onPress={() => router.replace('/onboarding/role')} />
    </SmaranCard>}
    {status === 'ready' && data && <>
      {voiceGuidance && <ReadScreenButton language={language} text={summary} labelKey="careReadSummary" />}
      <Section title={t(language, 'careGlance')}>
        <View style={styles.metrics}>
          <Metric label={t(language, 'careToday')} value={t(language, 'careCount', { count: number(data.cognitive.today) })} />
          <Metric label={t(language, 'careRoutine')} value={t(language, 'careDoneCount', { done: number(data.routine.done), total: number(data.routine.today.length) })} />
          <Metric label={t(language, 'homeMemoriesTitle')} value={t(language, 'careMemories', { count: number(data.memories.count) })} />
        </View>
      </Section>
      <Section title={t(language, 'careCognitive')}>
        <SmaranButton label={t(language, 'analyticsTitle')} accessibilityLabel={t(language, 'analyticsTitle')}
          onPress={() => router.push('/caregiver/activity')} variant="outline" />
        <View style={styles.metrics}>
          <Metric label={t(language, 'careLast7')} value={t(language, 'careCount', { count: number(data.cognitive.last7) })} />
          <Metric label={t(language, 'carePrevious7')} value={t(language, 'careCount', { count: number(data.cognitive.previous7) })} />
        </View>
        {latest ? <SmaranCard style={styles.group}>
          <ThemedText type="action">{t(language, 'careNextLevel', { level: number(latest.recommendedDifficulty) })}</ThemedText>
          <ThemedText type="cardHeading">{t(language, activityTitleKeys[latest.gameType])}</ThemedText>
          <ThemedText>{t(language, 'careLevelSource')}</ThemedText>
          <ThemedText type="secondary">{date(latest.completedAt)}</ThemedText>
          <ThemedText>{t(language, 'careAdaptive')}</ThemedText>
        </SmaranCard> : <View style={styles.group}><ThemedText>{t(language, 'careNoSessions')}</ThemedText><SmaranButton label={t(language, 'homeTrainTitle')} accessibilityLabel={t(language, 'homeTrainTitle')} onPress={() => router.push('/patient/games')} /></View>}
        {!!data.cognitive.recent.length && <ThemedText type="action" accessibilityRole="header">{t(language, 'careRecentSessions')}</ThemedText>}
        {data.cognitive.recent.map(session => <SmaranCard key={session.id} style={styles.group}>
          <ThemedText type="action">{t(language, activityTitleKeys[session.gameType])}</ThemedText>
          <ThemedText type="secondary">{date(session.completedAt)}</ThemedText>
          <ThemedText>{t(language, 'carePlayedLevel', { level: number(session.difficulty) })}</ThemedText>
          <ThemedText>{activityFacts(language, session)}</ThemedText>
        </SmaranCard>)}
      </Section>
      <Section title={t(language, 'careRoutine')}>
        <ThemedText>{t(language, 'carePending', { count: number(data.routine.pending) })}</ThemedText>
        {!data.routine.today.length && <View style={styles.group}><ThemedText>{t(language, 'careNoRoutine')}</ThemedText><SmaranButton label={t(language, 'dayAdd')} accessibilityLabel={t(language, 'dayAdd')} onPress={() => router.push('/patient/my-day-reminder')} variant="outline" /></View>}
        {data.routine.today.map(reminder => <SmaranCard key={reminder.id} style={styles.group}>
          <ThemedText type="secondary">{t(language, category[reminder.type].key)} • {timeLabel(language, reminder.timeOfDay)}</ThemedText>
          <ThemedText type="action">{reminder.title}</ThemedText>
          <ThemedText>{t(language, reminder.completed ? 'careDone' : 'dayPending')}</ThemedText>
        </SmaranCard>)}
      </Section>
      <Section title={t(language, 'careUpcoming')}>
        <View style={styles.metrics}>
          <Metric label={t(language, 'careAppointment')} value={data.appointment ? upcomingText(data.appointment) : t(language, 'careNoAppointment')} />
        </View>
        {!data.upcoming.length && <ThemedText>{t(language, 'careNoUpcoming')}</ThemedText>}
        {data.upcoming.map(item => <SmaranCard key={item.reminder.id} style={styles.group}>
          <ThemedText type="secondary">{t(language, item.reminder.type === 'appointment' ? 'careAppointment' : category[item.reminder.type].key)}</ThemedText>
          <ThemedText type="action">{item.reminder.title}</ThemedText>
          <ThemedText>{date(item.scheduledAt)}</ThemedText>
        </SmaranCard>)}
      </Section>
      <Section title={t(language, 'homeMemoriesTitle')}>
        <ThemedText>{t(language, 'careMemories', { count: number(data.memories.count) })}</ThemedText>
        {!data.memories.count && <View style={styles.group}><ThemedText>{t(language, 'careNoMemories')}</ThemedText><SmaranButton label={t(language, 'memoryAdd')} accessibilityLabel={t(language, 'memoryAdd')} onPress={() => router.push('/patient/my-memory-editor')} variant="outline" /></View>}
        {data.memories.recent.map(memory => <SmaranCard key={memory.id} style={styles.group}>
          <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />
          <ThemedText type="action">{memory.name}</ThemedText>
          {!!memory.relationship && <ThemedText>{memory.relationship}</ThemedText>}
          <ThemedText type="secondary">{t(language, 'careUpdated', { date: date(memory.updatedAt) })}</ThemedText>
        </SmaranCard>)}
      </Section>
      <Section title={t(language, 'careRecent')}>
        {!data.recentActivity.length && <ThemedText>{t(language, 'careNoActivity')}</ThemedText>}
        {data.recentActivity.map(event => <SmaranCard key={event.id} style={styles.group}>
          <ThemedText>{event.kind === 'session' && event.gameType ? t(language, 'activityComplete', { activity: t(language, activityTitleKeys[event.gameType]) }) : t(language, eventKeys[event.kind], { name: event.name ?? '' })}</ThemedText>
          <ThemedText type="secondary">{date(event.at)}</ThemedText>
        </SmaranCard>)}
      </Section>
    </>}
    <Section title={t(language, 'careAbout')}>
      <ThemedText>{t(language, 'careBoundary')}</ThemedText>
      <ThemedText>{t(language, 'careDisclaimer')}</ThemedText>
    </Section>
  </View></ScreenWrapper>;
}
const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, gap: Spacing.xl },
  section: { gap: Spacing.md },
  group: { gap: Spacing.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metric: { flexGrow: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%' },
});
