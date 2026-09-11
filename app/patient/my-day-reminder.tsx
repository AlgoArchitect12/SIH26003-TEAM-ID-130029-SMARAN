import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SelectionCard } from '@components/onboarding/selection-card';
import { category, dayStyles as styles, Field, useMyDayPatient } from '@components/my-day/shared';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { t, type TranslationKey } from '@i18n/index';
import { myDayRepository } from '@db/repositories/my-day.repository';
import { myDayService } from '@services/my-day.service';
import { localDateTime, localDay, MyDayError, validateReminder, type ReminderType } from '@/src/my-day/types';
import { reminderPresets } from '@/src/my-day/presets';

export default function ReminderEditor() {
  const router = useRouter();
  const { id: parameter } = useLocalSearchParams<{ id?: string }>();
  const id = typeof parameter === 'string' ? parameter : undefined;
  const { patientId, language, failed, retry } = useMyDayPatient();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ReminderType>('medicine');
  const [presetId, setPresetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [repeat, setRepeat] = useState<'daily' | 'once'>('daily');
  const [year, setYear] = useState(localDay().slice(0,4));
  const [month, setMonth] = useState(localDay().slice(5,7));
  const [day, setDay] = useState(localDay().slice(8,10));
  const [loaded, setLoaded] = useState(!id);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const current = useRef(capturePatientRequest()).current;
  useEffect(() => {
    let active = true;
    if (!patientId || !id) return;
    void myDayRepository.get(patientId, id).then(reminder => {
      if (!active || !current()) return;
      if (!reminder || reminder.deletedAt) throw new MyDayError('missing');
      setType(reminder.type); setTitle(reminder.title); setNote(reminder.note);
      setHour(reminder.timeOfDay.slice(0,2)); setMinute(reminder.timeOfDay.slice(3)); setRepeat(reminder.repeatRule);
      if (reminder.scheduledDate) { setYear(reminder.scheduledDate.slice(0,4)); setMonth(reminder.scheduledDate.slice(5,7)); setDay(reminder.scheduledDate.slice(8)); }
      setLoaded(true); setError(null);
    }).catch(() => { if (active && current()) setError('dayFailed'); });
    return () => { active = false; };
  }, [patientId, id, attempt, current]);
  const save = async () => {
    if (!current()) return;
    if (!patientId || locked.current) return;
    setError(null);
    try {
      if (!/^\d{1,2}$/u.test(hour) || !/^\d{1,2}$/u.test(minute)) throw new MyDayError('invalid');
      const input = validateReminder({ type, title, note, timeOfDay: `${hour.padStart(2,'0')}:${minute.padStart(2,'0')}`,
        repeatRule: repeat, scheduledDate: repeat === 'daily' ? null : `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}` });
      if (input.repeatRule === 'once' && localDateTime(input.scheduledDate!, input.timeOfDay).getTime() <= Date.now()) throw new MyDayError('past');
      locked.current = true; setBusy(true);
      await myDayService.save(patientId, input, id);
      if (current()) router.dismissTo('/patient/my-day');
    } catch (reason) { if (current()) setError(reason instanceof MyDayError ? reason.code === 'limit' ? 'dayLimit' : reason.code === 'past' ? 'dayPast' : reason.code === 'invalid' ? 'dayInvalid' : 'dayFailed' : 'dayFailed'); }
    finally { locked.current = false; if (current()) setBusy(false); }
  };
  const heading: TranslationKey = step === 0 ? 'dayType' : step === 1 ? 'dayDetails' : 'dayWhen';
  const speech = [t(language, heading), step === 0 ? [...reminderPresets.map(item => t(language, item.key)), t(language, 'dayOther')].join('. ')
    : step === 1 ? `${t(language, 'dayTitle')}. ${title}. ${t(language, 'dayNote')}. ${note}`
      : `${t(language, 'dayTime')}. ${hour}:${minute}. ${t(language, repeat === 'daily' ? 'dayDaily' : 'dayOnce')}. ${repeat === 'once' ? `${day} ${month} ${year}` : ''}. ${t(language, 'dayTimeHelp')}`].join(' ');
  return <ScreenWrapper scroll key={step}><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} disabled={busy} variant="outline"
      onPress={() => { if (step > 0) { setStep(step - 1); setError(null); } else router.dismissTo('/patient/my-day'); }} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, id ? 'dayEdit' : 'dayAdd')}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{t(language, 'stepProgress', { current: String(step + 1), total: '3' })}</ThemedText>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(language, heading)}</ThemedText>
    {(error || failed) && <View accessibilityRole="alert" style={styles.group}>
      <ThemedText>{t(language, error ?? 'dayFailed')}</ThemedText>
      {(!loaded || failed) && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => { retry(); setAttempt(n => n + 1); }} />}
    </View>}
    {!patientId || !loaded ? (!error && !failed && <SmaranLoading label={t(language, 'loadingSetup')} />) : <>
      {step === 0 && <>
        {reminderPresets.map(item => <SelectionCard key={item.id} icon={item.icon}
          title={t(language, item.key)} selected={presetId === item.id || (presetId === null && type !== 'custom' && type === item.type)} selectedLabel={t(language, 'selected')}
          onPress={() => {
            setPresetId(item.id); setType(item.type);
            if (!id) {
              setTitle(t(language, item.key)); setRepeat(item.repeat);
              setHour(item.time.slice(0, 2)); setMinute(item.time.slice(3));
            }
          }} />)}
        <SelectionCard icon={category.custom.icon} title={t(language, 'dayOther')}
          selected={type === 'custom' && presetId !== 'meal'} selectedLabel={t(language, 'selected')}
          onPress={() => { setPresetId('other'); setType('custom'); if (!id) setTitle(''); }} />
      </>}
      {step === 1 && <>
        <Field label={t(language, 'dayTitle')} value={title} onChangeText={setTitle} maxLength={120} multiline />
        <Field label={t(language, 'dayNote')} value={note} onChangeText={setNote} maxLength={300} multiline />
        {type === 'medicine' && <ThemedText>{t(language, 'daySafety')}</ThemedText>}
        {type === 'hydration' && <ThemedText>{t(language, 'dayWaterTapOnly')}</ThemedText>}
      </>}
      {step === 2 && <>
        <ThemedText>{t(language, 'dayTimeHelp')}</ThemedText>
        <Field label={t(language, 'dayHour')} value={hour} onChangeText={setHour} keyboardType="number-pad" maxLength={2} editable={!busy} />
        <Field label={t(language, 'dayMinute')} value={minute} onChangeText={setMinute} keyboardType="number-pad" maxLength={2} editable={!busy} />
        <SelectionCard icon="repeat" title={t(language, 'dayDaily')} selected={repeat === 'daily'} selectedLabel={t(language, 'selected')} onPress={() => { if (!busy) setRepeat('daily'); }} />
        <SelectionCard icon="event" title={t(language, 'dayOnce')} selected={repeat === 'once'} selectedLabel={t(language, 'selected')} onPress={() => { if (!busy) setRepeat('once'); }} />
        {repeat === 'once' && <>
          <ThemedText type="cardHeading">{t(language, 'dayDate')}</ThemedText>
          <Field label={t(language, 'dayDateDay')} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} editable={!busy} />
          <Field label={t(language, 'dayDateMonth')} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} editable={!busy} />
          <Field label={t(language, 'dayDateYear')} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} editable={!busy} />
        </>}
      </>}
      <SmaranButton size="large" label={t(language, step === 2 ? 'daySave' : 'continue')} accessibilityLabel={t(language, step === 2 ? 'daySave' : 'continue')}
        disabled={busy} loading={busy} onPress={() => {
          if (step === 2) void save();
          else if (step === 1 && !title.trim()) setError('dayInvalid');
          else {
            if (step === 0 && !id && !title && type !== 'custom') setTitle(t(language, category[type].key));
            setError(null); setStep(step + 1);
          }
        }} />
      <ReadScreenButton language={language} text={speech} />
    </>}
  </View></ScreenWrapper>;
}
