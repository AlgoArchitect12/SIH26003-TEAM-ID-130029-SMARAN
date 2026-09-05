import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { category, dayStyles as styles, NotificationNotice, useMyDayPatient } from '@components/my-day/shared';
import { t } from '@i18n/index';
import { myDayRepository } from '@db/repositories/my-day.repository';
import { myDayService, type NotificationResult } from '@services/my-day.service';
import { localDay, timeLabel, type Reminder, type ReminderEvent, type TodayReminder } from '@/src/my-day/types';
import { useThemeColors } from '@/hooks/use-theme-color';

export default function MyDayScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { patientId, language, failed: patientFailed, retry } = useMyDayPatient();
  const [today, setToday] = useState<TodayReminder[]>([]);
  const [all, setAll] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [manage, setManage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationResult | null>(null);
  const [displayDay, setDisplayDay] = useState(localDay());
  const refresh = useCallback(async () => {
    if (!patientId) return;
    const now = new Date();
    const [items, reminders, history] = await Promise.all([myDayRepository.today(patientId, now), myDayRepository.list(patientId), myDayRepository.currentCompletions(patientId, localDay(now))]);
    setToday(items); setAll(reminders); setEvents(history); setError(false); setDisplayDay(localDay(now)); setLoaded(true);
  }, [patientId]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const load = () => { void refresh().catch(() => { if (active) setError(true); }); };
    load();
    if (patientId) void myDayService.sync(patientId).then(result => { if (active) setNotifications(result); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    const timer = setInterval(load, 60000);
    return () => { active = false; subscription.remove(); clearInterval(timer); };
  }, [patientId, refresh]));
  const act = async (work: () => Promise<NotificationResult | void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    try { const result = await work(); if (result) setNotifications(result); await refresh(); }
    catch { setError(true); }
    finally { locked.current = false; setBusy(false); }
  };
  const button = (key: Parameters<typeof t>[1], onPress: () => void, primary = false, label?: string) =>
    <SmaranButton label={t(language, key)} accessibilityLabel={label ?? t(language, key)} onPress={onPress}
      disabled={busy} size={primary ? 'large' : 'normal'} variant={primary ? 'primary' : 'outline'} />;
  const completedState = (reminder: Reminder) => reminder.repeatRule === 'once'
    ? events.some(event => event.reminderId === reminder.id) : today.some(item => item.id === reminder.id && item.completed);
  const completionKey = (reminder: Reminder) => reminder.repeatRule === 'once' && reminder.scheduledDate !== displayDay ? 'dayDone' : 'dayCompleted';
  const content = (manage ? all : today);
  const speech = [t(language, 'homeDayTitle'), t(language, 'dayIntro'), ...content.map(r =>
    `${t(language, category[r.type].key)}. ${r.title}. ${timeLabel(language, r.timeOfDay)}. ${r.note}. ${t(language,
      !r.isEnabled ? 'dayDisabled' : completedState(r) ? completionKey(r) : 'dayPending')}`),
    !content.length ? t(language, 'dayEmpty') : ''].join(' ');
  return <ScreenWrapper scroll><View style={styles.content}>
    {button('backHome', () => router.replace('/patient/home'))}
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeDayTitle')}</ThemedText>
    <ThemedText>{t(language, 'dayIntro')}</ThemedText>
    {(error || patientFailed) && <View accessibilityRole="alert" style={styles.group}>
      <ThemedText>{t(language, 'dayFailed')}</ThemedText>
      {button('retry', () => { if (patientFailed) retry(); else void act(refresh); })}
    </View>}
    {!loaded && !error && !patientFailed && <ThemedText accessibilityLiveRegion="polite">{t(language, 'loadingSetup')}</ThemedText>}
    {patientId && button('dayAdd', () => router.push('/patient/my-day-reminder'), true)}
    {loaded && <>
      {button(manage ? 'dayToday' : 'dayManage', () => { setManage(!manage); setRemoving(null); })}
      <ThemedText type="cardHeading" accessibilityRole="header">{t(language, manage ? 'dayManage' : 'dayToday')}</ThemedText>
      {!content.length && <ThemedText>{t(language, 'dayEmpty')}</ThemedText>}
      {content.map(reminder => {
        const completed = completedState(reminder);
        const state = t(language, !reminder.isEnabled ? 'dayDisabled' : completed ? completionKey(reminder) : 'dayPending');
        const summary = `${t(language, category[reminder.type].key)}. ${reminder.title}. ${timeLabel(language, reminder.timeOfDay)}. ${reminder.note}. ${reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}. ${state}`;
        return <View key={reminder.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: completed ? colors.success : colors.border }]}>
          <View accessible accessibilityLabel={summary} style={styles.group}>
            <View style={styles.category}>
              <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={category[reminder.type].icon} color={colors.primary} size={32} />
              <ThemedText style={styles.copy}>{t(language, category[reminder.type].key)}</ThemedText>
            </View>
            <ThemedText type="cardHeading">{reminder.title}</ThemedText>
            <ThemedText type="cardHeading">{timeLabel(language, reminder.timeOfDay)}</ThemedText>
            <ThemedText>{reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}</ThemedText>
            {!!reminder.note && <ThemedText>{reminder.note}</ThemedText>}
            <ThemedText accessibilityLiveRegion="polite">{state}</ThemedText>
          </View>
          {!manage && !completed && button('dayDone', () => void act(async () => {
            if (!patientId) return;
            await myDayService.complete(patientId, reminder.id, displayDay);
            await refresh();
            return myDayService.sync(patientId);
          }), true, `${summary}. ${t(language, 'dayDone')}`)}
          {manage && <>
            {button('dayEdit', () => router.push({ pathname: '/patient/my-day-reminder', params: { id: reminder.id } }), false, `${t(language, 'dayEdit')}. ${reminder.title}`)}
            {button(reminder.isEnabled ? 'dayDisable' : 'dayEnable', () => void act(() => myDayService.setEnabled(patientId!, reminder.id, !reminder.isEnabled)), false, `${t(language, reminder.isEnabled ? 'dayDisable' : 'dayEnable')}. ${reminder.title}`)}
            {removing === reminder.id ? <View accessibilityRole="alert" style={styles.group}>
              <ThemedText>{t(language, 'dayRemoveConfirm')}</ThemedText>
              {button('dayKeep', () => setRemoving(null))}
              {button('dayRemove', () => void act(async () => { const result = await myDayService.remove(patientId!, reminder.id); setRemoving(null); return result; }))}
            </View> : button('dayRemove', () => setRemoving(reminder.id), false, `${t(language, 'dayRemove')}. ${reminder.title}`)}
          </>}
        </View>;
      })}
      <ReadScreenButton language={language} text={speech} />
      <NotificationNotice result={notifications} busy={busy}
        onRetry={() => void act(() => myDayService.sync(patientId!))}
        onAllow={() => void act(() => myDayService.sync(patientId!, true))} />
    </>}
  </View></ScreenWrapper>;
}
