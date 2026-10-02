import { SmaranLoading } from '@components/ui/smaran-loading';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { PageIntro } from '@components/ui/page-intro';
import { ProgressIndicator } from '@components/ui/progress-indicator';
import { category, dayStyles as styles, NotificationNotice, useMyDayPatient } from '@components/my-day/shared';
import { t } from '@i18n/index';
import { myDayRepository } from '@db/repositories/my-day.repository';
import { myDayService, type NotificationResult } from '@services/my-day.service';
import { localDay, timeLabel, type Reminder, type ReminderEvent, type TodayReminder } from '@/src/my-day/types';
import { useThemeColors } from '@/hooks/use-theme-color';
import { capturePatientRequest, captureReminderManagement, usePatientSessionStore } from '@/src/stores/patient-session.store';
import { withTimeout } from '@/src/utils/with-timeout';

export function MyDayContent({ caregiver = false }: { caregiver?: boolean } = {}) {
  const router = useRouter();
  const colors = useThemeColors();
  const { patientId, patientName, language, failed: patientFailed, retry } = useMyDayPatient();
  const [today, setToday] = useState<TodayReminder[]>([]);
  const [all, setAll] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [manage, setManage] = useState(caregiver);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const revision = usePatientSessionStore(s => s.revision);
  const switching = usePatientSessionStore(s => s.switching);
  const current = useMemo(() => {
    void revision; void switching;
    return caregiver ? captureReminderManagement() : capturePatientRequest();
  }, [caregiver, revision, switching]);
  const loadRequest = useRef(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationResult | null>(null);
  const [displayDay, setDisplayDay] = useState(localDay());
  const refresh = useCallback(async () => {
    if (!patientId || !current()) return;
    const request = ++loadRequest.current;
    const now = new Date();
    const [items, reminders, history] = await withTimeout(Promise.all([myDayRepository.today(patientId, now), myDayRepository.list(patientId), myDayRepository.currentCompletions(patientId, localDay(now))]));
    if (!current() || request !== loadRequest.current) return;
    setToday(items); setAll(reminders); setEvents(history); setError(false); setDisplayDay(localDay(now)); setLoaded(true);
  }, [patientId, current]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false); setToday([]); setAll([]); setEvents([]); setRemoving(null); setNotifications(null);
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
  const managing = caregiver && manage;
  const content = (managing ? all : today);
  const firstPending = content.find(r => !completedState(r));
  const speech = [t(language, 'homeDayTitle'), t(language, 'dayIntro'), ...content.map(r =>
    `${t(language, category[r.type].key)}. ${r.title}. ${timeLabel(language, r.timeOfDay)}. ${r.note}. ${
      !r.isEnabled ? t(language, 'dayDisabled') : completedState(r) ? completionLabel(r) : t(language, 'dayPending')}`),
    !content.length ? t(language, managing ? 'dayEmpty' : 'careNoRoutine') : ''].join(' ');
  return <ScreenWrapper scroll><View style={styles.content}>
    {button('backHome', () => router.dismissTo(caregiver ? '/caregiver/home' : '/patient/home'))}
    
    <View style={{ gap: 12, paddingBottom: 16 }}>
      <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 16, gap: 16, shadowColor: colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MaterialIcons name="wb-sunny" size={28} color={colors.primary} />
            <View>
              <ThemedText type="defaultSemiBold" style={{ color: colors.primary, textTransform: 'uppercase', fontSize: 14 }}>
                {patientName ? `${t(language, 'homeDayTitle')}, ${patientName}` : t(language, 'homeDayTitle')}
              </ThemedText>
              <ThemedText type="screenTitle" style={{ fontSize: 20 }}>
                {new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date(`${displayDay}T12:00:00`))}
              </ThemedText>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 4 }}>
          <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary, flex: 1, alignItems: 'center' }}>
            <ThemedText style={{ fontSize: 12, color: colors.onActionPrimary, textTransform: 'uppercase', fontWeight: 'bold' }}>Today</ThemedText>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surface, marginTop: 4 }} />
          </View>
          <View style={{ flex: 3 }} />
        </View>
        {loaded && <>
          <ProgressIndicator current={today.filter(item => item.completed).length} total={today.length}
            label={t(language, 'careDoneCount', { done: String(today.filter(item => item.completed).length), total: String(today.length) })} />
          <ReadScreenButton language={language} text={speech} />
        </>}
      </View>
    </View>

    {(error || patientFailed) && <View accessibilityRole="alert" style={styles.group}>
      <ThemedText>{t(language, 'dayFailed')}</ThemedText>
      {button('retry', () => { if (patientFailed) retry(); else void act(refresh); })}
    </View>}
    {!loaded && !error && !patientFailed && <SmaranLoading label={t(language, 'loadingSetup')} />}
    {caregiver && patientId && button('dayAdd', () => router.push('/caregiver/reminder'), true)}
    {loaded && <>
      {caregiver && button(managing ? 'dayToday' : 'dayManage', () => { setManage(!manage); setRemoving(null); })}
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 12, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="schedule" size={24} color={colors.primary} />
          <ThemedText type="cardHeading">{t(language, managing ? 'dayManage' : 'dayToday')}</ThemedText>
        </View>
      </View>

      {!content.length && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><ThemedText>{t(language, managing ? 'dayEmpty' : 'careNoRoutine')}</ThemedText></View>}
      
      {content.map(reminder => {
        const completed = completedState(reminder);
        const state = !reminder.isEnabled ? t(language, 'dayDisabled') : completed ? completionLabel(reminder) : t(language, 'dayPending');
        const doneKey = reminder.type === 'hydration' ? 'dayDrankWater' : 'dayDone';
        const summary = `${t(language, category[reminder.type].key)}. ${reminder.title}. ${timeLabel(language, reminder.timeOfDay)}. ${reminder.note}. ${reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}. ${state}`;
        const isUpNext = !managing && !completed && firstPending?.id === reminder.id;

        return <View key={reminder.id} style={[styles.card, { 
          borderWidth: 0,
          backgroundColor: colors.surface, 
          elevation: isUpNext ? 4 : 1,
          shadowColor: colors.text, shadowOpacity: isUpNext ? 0.1 : 0.05, shadowRadius: isUpNext ? 12 : 8,
          opacity: completed ? 0.8 : 1,
        }]}>
          {isUpNext && (
            <View style={{ position: 'absolute', top: -12, right: 16, backgroundColor: colors.error, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, elevation: 2 }}>
               <ThemedText style={{ color: colors.surface, fontSize: 12, fontWeight: 'bold' }}>Up Next</ThemedText>
            </View>
          )}

          <View accessible accessibilityLabel={summary} style={styles.group}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{timeLabel(language, reminder.timeOfDay)}</ThemedText>
                </View>
                {completed && (
                  <View style={{ backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="check-circle" color={colors.surface} size={16} />
                    <ThemedText style={{ color: colors.surface, fontSize: 12, fontWeight: 'bold' }}>Done</ThemedText>
                  </View>
                )}
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                 <MaterialIcons accessible={false} aria-hidden name={category[reminder.type].icon} color={colors.primary} size={20} />
              </View>
            </View>
            <View style={{ paddingLeft: 4 }}>
              <ThemedText type="cardHeading">{reminder.title}</ThemedText>
              <ThemedText type="secondary" style={{ marginTop: 4 }}>{t(language, category[reminder.type].key)} • {reminder.repeatRule === 'daily' ? t(language, 'dayDaily') : reminder.scheduledDate}</ThemedText>
              {!!reminder.note && <ThemedText style={{ marginTop: 4 }}>{reminder.note}</ThemedText>}
              {reminder.type === 'hydration' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><MaterialIcons name="water-drop" size={18} color={colors.primary} /><ThemedText type="secondary" style={{ fontSize: 12 }}>{t(language, 'dayWaterTapOnly')}</ThemedText></View>}
            </View>
          </View>
          {!managing && !completed && button(doneKey, () => void act(async () => {
            if (!patientId) return;
            await myDayService.complete(patientId, reminder.id, displayDay);
            if (current()) return myDayService.sync(patientId);
          }), true, `${summary}. ${t(language, doneKey)}`)}
          {managing && <>
            {button('dayEdit', () => router.push({ pathname: '/caregiver/reminder', params: { id: reminder.id } }), false, `${t(language, 'dayEdit')}. ${reminder.title}`)}
            {button(reminder.isEnabled ? 'dayDisable' : 'dayEnable', () => void act(() => myDayService.setEnabled(patientId!, reminder.id, !reminder.isEnabled)), false, `${t(language, reminder.isEnabled ? 'dayDisable' : 'dayEnable')}. ${reminder.title}`)}
            {removing === reminder.id ? <View accessibilityRole="alert" style={styles.group}>
              <ThemedText>{t(language, 'dayRemoveConfirm')}</ThemedText>
              {button('dayKeep', () => setRemoving(null))}
              {button('dayRemove', () => void act(async () => { const result = await myDayService.remove(patientId!, reminder.id); if (current()) setRemoving(null); return result; }))}
            </View> : button('dayRemove', () => setRemoving(reminder.id), false, `${t(language, 'dayRemove')}. ${reminder.title}`)}
          </>}
        </View>;
      })}
      <ThemedText type="secondary">{t(language, 'voiceInputUnavailable')}</ThemedText>
      {caregiver && <NotificationNotice result={notifications} busy={busy}
        onRetry={() => void act(() => myDayService.sync(patientId!))}
        onAllow={() => void act(() => myDayService.sync(patientId!, true))} />}
    </>}
  </View></ScreenWrapper>;
}
