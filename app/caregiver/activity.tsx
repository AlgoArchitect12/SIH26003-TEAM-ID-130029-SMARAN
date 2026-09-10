import { capturePatientRequest, usePatientSessionStore } from '@/src/stores/patient-session.store';
import { useIsFocused } from '@react-navigation/native';
import { CurrentPerson } from '@components/patient/current-person';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { Spacing } from '@constants/layout';
import { t } from '@i18n/index';
import { AnalyticsPatientChanged, loadActiveAnalytics, type AnalyticsDays, type AnalyticsSummary } from '@services/analytics.service';
import type { AnalyticsCursor } from '@/src/db/repositories/cognitive.repository';
import { activityTitleKeys } from '@/src/games/presentation';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

const feedbackKeys = { easy: 'feedbackEasy', comfortable: 'feedbackComfortable', challenging: 'feedbackChallenging' } as const;

export default function ActivityHistoryScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const savedProfileId = usePatientSessionStore(state => state.revision);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [days, setDays] = useState<AnalyticsDays>(7);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [cursor, setCursor] = useState<AnalyticsCursor>();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadActiveAnalytics>>>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [loadedProfileId, setLoadedProfileId] = useState(savedProfileId);
  const scroll = useRef<ScrollView>(null);
  const request = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      request.current += 1;
      setData(null); setCursor(undefined); setStatus('loading');
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const ticket = ++request.current;
    const current = capturePatientRequest();
    setData(null); setStatus('loading');
    if (!focused || !foreground) return;
    void loadActiveAnalytics(days, cursor).then(result => {
      if (request.current !== ticket || !current()) return;
      if (result) {
        const store = useOnboardingStore.getState();
        store.setLanguage(result.settings.language);
        store.setAccessibilityPreferences({ textSize: result.settings.textSize, highContrast: result.settings.highContrast,
          reducedMotion: result.settings.reducedMotion, voiceGuidance: result.settings.voiceGuidance });
      }
      setLoadedProfileId(savedProfileId); setData(result); setStatus(result ? 'ready' : 'missing');
      scroll.current?.scrollTo({ y: 0, animated: false });
    }).catch(error => {
      if (request.current !== ticket || !current()) return;
      setData(null);
      if (error instanceof AnalyticsPatientChanged && cursor) setCursor(undefined);
      else setStatus('failed');
    });
    return () => { request.current += 1; };
  }, [focused, foreground, savedProfileId, days, cursor, attempt]);

  const visible = focused && foreground && loadedProfileId === savedProfileId && status === 'ready' ? data : null;
  const number = (value: number | null) => value !== null && Number.isFinite(value)
    ? new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value) : t(language, 'analyticsUnknown');
  const percent = (value: number | null) => value !== null && Number.isFinite(value)
    ? new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 }).format(value) : t(language, 'analyticsUnknown');
  const date = (value: string, time = true) => Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric',
      ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const : {}) }).format(new Date(value))
    : t(language, 'analyticsUnknown');
  const summaryLines = (row: NonNullable<AnalyticsSummary['games'][number]['summary']>) => [
    t(language, 'analyticsCompleted', { count: number(row.sessions) }),
    t(language, 'analyticsAccuracy', { accuracy: percent(row.accuracy), correct: number(row.correct), attempts: number(row.attempts) }),
    t(language, 'analyticsResponse', { ms: number(row.averageResponseMs), attempts: number(row.responseAttempts) }),
    t(language, 'analyticsHints', { hints: number(row.hints), sessions: number(row.sessions) }),
    t(language, 'analyticsErrors', { count: number(row.repeatedErrors) }),
    t(language, 'analyticsElapsed', { seconds: number(row.averageElapsedMs === null ? null : row.averageElapsedMs / 1000), sessions: number(row.elapsedSessions) }),
  ];
  const period = visible ? t(language, 'analyticsPeriod', {
    start: date(visible.summary.window.boundaries[0], false),
    end: date(new Date(Date.parse(visible.summary.window.boundaries.at(-1)!) - 1).toISOString(), false),
    zone: visible.summary.window.timezone,
  }) : '';
  const readSummary = visible ? [t(language, 'analyticsTitle'), visible.patient.name, period,
    ...visible.summary.games.flatMap(game => [t(language, activityTitleKeys[game.gameType]),
      ...(game.summary ? summaryLines(game.summary) : [t(language, 'analyticsEmpty')])]),
    t(language, 'analyticsTiming'), t(language, 'analyticsCoverage'), t(language, 'careDisclaimer')].join('. ') : '';
  const retry = () => { setCursor(undefined); setAttempt(value => value + 1); };
  const history = visible?.history;

  return <ScreenWrapper><ScrollView ref={scroll} contentContainerStyle={styles.content}>
    <Stack.Screen options={{ animation: 'none' }} />
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} variant="outline"
      onPress={() => router.dismissTo('/caregiver/home')} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'analyticsTitle')}</ThemedText>
    <ThemedText type="secondary">{t(language, 'careLocal')}</ThemedText>
    <View style={styles.group}>
      {([7, 30] as const).map(value => <SmaranButton key={value} label={t(language, value === 7 ? 'analytics7' : 'analytics30')}
        accessibilityLabel={t(language, value === 7 ? 'analytics7' : 'analytics30')} variant={days === value ? 'primary' : 'outline'}
        accessibilityState={{ selected: days === value }}
        disabled={days === value} onPress={() => { setData(null); setCursor(undefined); setDays(value); }} />)}
    </View>
    {status === 'loading' && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {status === 'failed' && <View style={styles.group} accessibilityRole="alert">
      <ThemedText>{t(language, 'careFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={retry} />
    </View>}
    {status === 'missing' && <View style={styles.group}>
      <ThemedText>{t(language, 'careMissing')}</ThemedText>
      <SmaranButton label={t(language, 'homeReturnSetup')} accessibilityLabel={t(language, 'homeReturnSetup')}
        onPress={() => router.replace('/onboarding/role')} />
    </View>}
    {visible && <>
      <CurrentPerson name={visible.patient.name} language={language} caregiver />
      <ThemedText>{period}</ThemedText>
      <ThemedText type="secondary">{t(language, 'analyticsAsOf', { date: date(visible.summary.window.asOf) })}</ThemedText>
      <ReadScreenButton language={language} text={readSummary} labelKey="careReadSummary" />
      {visible.summary.games.map(game => <View key={game.gameType} style={styles.section}>
        <ThemedText type="cardHeading" accessibilityRole="header">{t(language, activityTitleKeys[game.gameType])}</ThemedText>
        <ThemedText type="secondary">{t(language, game.gameType === 'memory_match' ? 'analyticsMemoryAttempts' : 'analyticsSelectionAttempts')}</ThemedText>
        {game.summary ? <>
          <SmaranCard style={styles.group}>
            {summaryLines(game.summary).map((line, index) => <ThemedText key={index}>{line}</ThemedText>)}
            <ThemedText>{t(language, 'analyticsParticipation', { count: number(game.summary.participationDays), days: number(days) })}</ThemedText>
            <ThemedText>{t(language, 'carePlayedLevel', { level: number(game.summary.latestDifficulty) })}</ThemedText>
            <ThemedText>{t(language, 'analyticsNext', { level: number(game.summary.recommendedDifficulty) })}</ThemedText>
            <ThemedText type="secondary">{date(game.summary.latestAt)}</ThemedText>
          </SmaranCard>
          <SmaranButton label={t(language, 'analyticsLevels')} accessibilityLabel={t(language, 'analyticsLevels')} variant="outline"
            accessibilityState={{ expanded: expandedGame === game.gameType }}
            onPress={() => setExpandedGame(current => current === game.gameType ? null : game.gameType)} />
          {game.levels.map(level => <SmaranCard key={level.difficulty} style={styles.group}>
            <ThemedText type="action">{t(language, 'carePlayedLevel', { level: number(level.difficulty) })}</ThemedText>
            {(expandedGame === game.gameType ? summaryLines(level) : [summaryLines(level)[0]])
              .map((line, index) => <ThemedText key={index}>{line}</ThemedText>)}
          </SmaranCard>)}
        </> : <ThemedText>{t(language, 'analyticsEmpty')}</ThemedText>}
      </View>)}
      <ThemedText>{t(language, 'analyticsTiming')}</ThemedText>
      <ThemedText>{t(language, 'analyticsCoverage')}</ThemedText>
      <ThemedText>{t(language, 'careDisclaimer')}</ThemedText>
      <ThemedText type="cardHeading" accessibilityRole="header" onLayout={event => {
        if (cursor) scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
      }}>{t(language, 'analyticsHistory')}</ThemedText>
      <ThemedText>{t(language, 'analyticsHistoryScope')}</ThemedText>
      {cursor && <SmaranButton label={t(language, 'analyticsNewest')} accessibilityLabel={t(language, 'analyticsNewest')}
        variant="outline" onPress={retry} />}
      {!!history?.sessions.length && <ThemedText accessibilityLiveRegion="polite">{t(language, 'analyticsPage', {
        count: number(history.sessions.length), start: date(history.sessions[0].completedAt), end: date(history.sessions.at(-1)!.completedAt),
      })}</ThemedText>}
      {history?.sessions.map(session => {
        const lines = [t(language, activityTitleKeys[session.gameType]), date(session.completedAt),
          t(language, 'carePlayedLevel', { level: number(session.difficulty) }),
          t(language, 'analyticsAccuracy', { accuracy: percent(session.accuracy), correct: number(session.correct), attempts: number(session.attempts) }),
          t(language, 'analyticsResponse', { ms: number(session.averageResponseMs), attempts: number(session.attempts) }),
          t(language, 'analyticsHints', { hints: number(session.hints), sessions: number(1) }),
          t(language, 'analyticsErrors', { count: number(session.repeatedErrors) }),
          t(language, 'analyticsSessionElapsed', { seconds: number(session.elapsedMs === null ? null : session.elapsedMs / 1000) }),
          t(language, 'analyticsNext', { level: number(session.recommendedDifficulty) }),
          t(language, 'analyticsFeedback', { feedback: session.feedback ? t(language, feedbackKeys[session.feedback]) : t(language, 'analyticsUnknown') })];
        return <SmaranCard key={session.id} style={styles.group}>
          {lines.map((line, index) => <ThemedText key={index} type={index === 0 ? 'action' : 'default'}>{line}</ThemedText>)}
          <ReadScreenButton language={language} text={lines.join('. ')} />
        </SmaranCard>;
      })}
      {!history?.sessions.length && <ThemedText>{t(language, cursor ? 'analyticsEnd' : 'analyticsNoHistory')}</ThemedText>}
      {history?.next ? <SmaranButton label={t(language, 'analyticsOlder')} accessibilityLabel={t(language, 'analyticsOlder')}
        onPress={() => { setData(null); setCursor(history.next!); }} />
        : !!history?.sessions.length && <ThemedText>{t(language, 'analyticsEnd')}</ThemedText>}
    </>}
  </ScrollView></ScreenWrapper>;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, gap: Spacing.xl, paddingBottom: Spacing.xl },
  section: { gap: Spacing.md },
  group: { gap: Spacing.sm },
});
