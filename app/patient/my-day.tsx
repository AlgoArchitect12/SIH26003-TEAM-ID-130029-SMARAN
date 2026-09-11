import { SmaranLoading } from '@components/ui/smaran-loading';
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
import { capturePatientRequest } from '@/src/stores/patient-session.store';

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
  const current = useRef(capturePatientRequest()).current;
  const loadRequest = useRef(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationResult | null>(null);
  const [displayDay, setDisplayDay] = useState(localDay());
  const refresh = useCallback(async () => {
    if (!patientId || !current()) return;
    const request = ++loadRequest.current;
    const now = new Date();
    const [items, reminders, history] = await Promise.all([myDayRepository.today(patientId, now), myDayRepository.list(patientId), myDayRepository.currentCompletions(patientId, localDay(now))]);
    if (!current() || request !== loadRequest.current) return;
    setToday(items); setAll(reminders); setEvents(history); setError(false); setDisplayDay(localDay(now)); setLoaded(true);
  }, [patientId, current]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const load = () => { void refresh().catch(() => { if (active && current()) setError(true); }); };
    load();
    if (patientId) void myDayService.sync(patientId).then(result => { if (active && current()) setNotifications(result); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    const timer = setInterval(load, 60000);
    return () => { active = false; loadRequest.current++; subscription.remove(); clearInterval(timer); };
  }, [patientId, refresh, current]));
  const act = async (work: () => Promise<NotificationResult | void>) => {
    if (locked.current || !current()) return;
    locked.current = true; setBusy(true); setError(false);
    try { const result = await work(); if (!current()) return; if (result) setNotifications(result); await refresh(); }
    catch { if (current()) setError(true); }
    finally { locked.current = false; if (current()) setBusy(false); }
  };
  const button = (key: Parameters<typeof t>[1], onPress: () => void, primary = false, label?: string) =>
    <SmaranButton label={t(language, key)} accessibilityLabel={label ?? t(language, key)} onPress={onPress}
      disabled={busy} size={primary ? 'large' : 'normal'} variant={primary ? 'primary' : 'outline'} />;
  const completedState = (reminder: Reminder) => reminder.repeatRule === 'once'
    ? events.some(event => event.reminderId === reminder.id) : today.some(item => item.id === reminder.id && item.completed);
  const completionLabel = (reminder: Reminder) => {
    const event = events.find(item => item.reminderId === reminder.id);
    // Events do not snapshot category: factual wording stays correct after an edit.
    return event ? t(language, 'dayMarkedAt', { time: new Intl.DateTimeFormat(language, {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(event.completedAt)) }) : t(language, 'careDone');
  };
  const content = (manage ? all : today);
  const speech = [t(language, 'homeDayTitle'), t(language, 'dayIntro'), ...content.map(r =>
    `${t(language, category[r.type].key)}. ${r.title}. ${timeLabel(language, r.timeOfDay)}. ${r.note}. ${
      !r.isEnabled ? t(language, 'dayDisabled') : completedState(r) ? completionLabel(r) : t(language, 'dayPending')}`),
    !content.length ? t(language, manage ? 'dayEmpty' : 'careNoRoutine') : ''].join(' ');
  return <ScreenWrapper scroll><View style={styles.content}>
    {button('backHome', () => router.dismissTo('/patient/home'))}
    <View style={styles.heading}>
      <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeDayTitle')}</ThemedText>
      <ThemedText type="secondary">{t(language, 'dayIntro')}</ThemedText>
    </View>
    {(error || patientFailed) && <View accessibilityRole="alert" style={styles.group}>
      <ThemedText>{t(language, 'dayFailed')}</ThemedText>
      {button('retry', () => { if (patientFailed) retry(); else void act(refresh); })}
    </View>}
    {!loaded && !error && !patientFailed && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {patientId && button('dayAdd', () => router.push('/patient/my-day-reminder'), true)}
    {loaded && <>
      {button(manage ? 'dayToday' : 'dayManage', () => { setManage(!manage); setRemoving(null); })}
      <ThemedText type="cardHeading" accessibilityRole="header">{t(language, manage ? 'dayManage' : 'dayToday')}</ThemedText>
      {!content.length && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><ThemedText>{t(language, manage ? 'dayEmpty' : 'careNoRoutine')}</ThemedText></View>}
      {content.map(reminder => {
        const completed = completedState(reminder);
        const state = !reminder.isEnabled ? t(language, 'dayDisabled') : completed ? completionLabel(reminder) : t(language, 'dayPending');
        const doneKey = reminder.type === 'hydration' ? 'dayDrankWater' : 'dayDone';
        const summary = `${t(language, category[reminder.type].key)}. ${reminder.title}. ${timeLabel(language, reminder.timeOfDay)}. ${reminder.note}. ${reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}. ${state}`;
        return <View key={reminder.id} style={[styles.card, { backgroundColor: completed ? colors.successSurface : colors.surface, borderColor: completed ? colors.success : colors.border }]}>
          <View accessible accessibilityLabel={summary} style={styles.group}>
            <View style={styles.category}>
              <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={category[reminder.type].icon} color={colors.primary} size={32} />
              <ThemedText style={styles.copy}>{t(language, category[reminder.type].key)}</ThemedText>
            </View>
            <ThemedText type="cardHeading">{reminder.title}</ThemedText>
            <ThemedText type="cardHeading">{timeLabel(language, reminder.timeOfDay)}</ThemedText>
            <ThemedText type="secondary">{reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}</ThemedText>
            {!!reminder.note && <ThemedText>{reminder.note}</ThemedText>}
            {reminder.type === 'hydration' && <ThemedText type="secondary">{t(language, 'dayWaterTapOnly')}</ThemedText>}
            <View style={styles.category}>
              <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={completed ? 'check-circle' : 'schedule'} color={completed ? colors.success : colors.textSecondary} size={28} />
              <ThemedText accessibilityLiveRegion="polite" type="defaultSemiBold" style={styles.copy}>{state}</ThemedText>
            </View>
          </View>
          {!manage && !completed && button(doneKey, () => void act(async () => {
            if (!patientId) return;
            await myDayService.complete(patientId, reminder.id, displayDay);
            if (current()) return myDayService.sync(patientId);
          }), true, `${summary}. ${t(language, doneKey)}`)}
          {manage && <>
            {button('dayEdit', () => router.push({ pathname: '/patient/my-day-reminder', params: { id: reminder.id } }), false, `${t(language, 'dayEdit')}. ${reminder.title}`)}
            {button(reminder.isEnabled ? 'dayDisable' : 'dayEnable', () => void act(() => myDayService.setEnabled(patientId!, reminder.id, !reminder.isEnabled)), false, `${t(language, reminder.isEnabled ? 'dayDisable' : 'dayEnable')}. ${reminder.title}`)}
            {removing === reminder.id ? <View accessibilityRole="alert" style={styles.group}>
              <ThemedText>{t(language, 'dayRemoveConfirm')}</ThemedText>
              {button('dayKeep', () => setRemoving(null))}
              {button('dayRemove', () => void act(async () => { const result = await myDayService.remove(patientId!, reminder.id); if (current()) setRemoving(null); return result; }))}
            </View> : button('dayRemove', () => setRemoving(reminder.id), false, `${t(language, 'dayRemove')}. ${reminder.title}`)}
          </>}
        </View>;
      })}
      <ReadScreenButton language={language} text={speech} />
      <ThemedText type="secondary">{t(language, 'voiceInputUnavailable')}</ThemedText>
      <NotificationNotice result={notifications} busy={busy}
        onRetry={() => void act(() => myDayService.sync(patientId!))}
        onAllow={() => void act(() => myDayService.sync(patientId!, true))} />
    </>}
  </View></ScreenWrapper>;
}
