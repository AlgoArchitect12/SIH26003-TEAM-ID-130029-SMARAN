import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { HomeActionCard } from '@components/patient/home-action-card';
import { MemoryPhoto } from '@components/memories/memory-photo';
import { regionalCategoryKeys } from '@components/my-home/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { PageIntro } from '@components/ui/page-intro';
import { PageLayout, Radius, Spacing } from '@constants/layout';
import { useMyDayPatient } from '@components/my-day/shared';
import { myDayRepository } from '@db/repositories/my-day.repository';
import { memoriesRepository } from '@db/repositories/memories.repository';
import { patientRepository } from '@db/repositories/patient.repository';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { getRegionName, t } from '@i18n/index';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { getRegionalPack } from '@/src/my-home/content';
import type { PersonalMemory } from '@/src/memories/types';
import { timeLabel, type TodayReminder } from '@/src/my-day/types';
import { useLocationStore } from '@/src/services/location.service';
import { freshness } from '@/src/location/live';

type HomeData = { profile: PatientProfile; settings: PatientSettings; reminders: TodayReminder[]; memory: PersonalMemory | null; now: Date };
export default function PatientHomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const textSize = useTextSize();
  const { patientId, language, failed: patientFailed, retry } = useMyDayPatient();
  const preferences = useOnboardingStore(s => s.accessibility);
  const location = useLocationStore();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    void attempt;
    const load = async () => {
      if (!patientId) return;
      try {
        const now = new Date();
        const [profile, settings, reminders, memories] = await Promise.all([
          patientRepository.getProfileById(patientId), patientRepository.getSettings(patientId),
          myDayRepository.today(patientId, now), memoriesRepository.list(patientId),
        ]);
        if (!profile || !settings) throw new Error('Missing profile.');
        if (active) { setData({ profile, settings, reminders, memory: memories[0] ?? null, now }); setFailed(false); }
      } catch { if (active) setFailed(true); }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [patientId, attempt]));
  const button = (label: string, onPress: () => void) => <SmaranButton label={label} accessibilityLabel={label} onPress={onPress} variant="outline" />;
  if (failed || patientFailed || !data) return <ScreenWrapper scroll><View style={styles.content}>
    {failed || patientFailed ? <>
      <ThemedText accessibilityRole="alert">{t(language, 'homeLoadFailed')}</ThemedText>
      {button(t(language, 'retry'), () => { retry(); setAttempt(n => n + 1); })}
    </> : <SmaranLoading label={t(language, 'homeLoading')} />}
  </View></ScreenWrapper>;
  const { profile, settings, reminders, memory, now } = data;
  const greeting = t(language, now.getHours() < 12 ? 'homeGreetingMorning' : now.getHours() < 17 ? 'homeGreetingAfternoon' : 'homeGreetingEvening', { name: profile.preferredName });
  const date = `${t(language, 'dayToday')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const reminder = reminders.filter(item => !item.completed).sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay))[0];
  const todayText = reminder ? `${timeLabel(language, reminder.timeOfDay)}  ${reminder.title}` : t(language, reminders.length ? 'todayClear' : 'careNoRoutine');
  const regional = getRegionalPack(settings.region)[0];
  const speech = [greeting, date, t(language, 'dayToday'), todayText, t(language, 'homeTrainTitle'),
    t(language, 'homeTrainDescription'), t(language, 'familiarMemory'), memory ? `${memory.name}. ${memory.relationship}` : t(language, 'memoryEmpty')].join('. ');
  return <ScreenWrapper scroll><View style={styles.content}>
    <PageIntro title={greeting} description={`${getRegionName(language, settings.region)} · ${date}`} icon={now.getHours() < 17 ? 'wb-sunny' : 'nights-stay'}>
      {preferences.voiceGuidance && <ReadScreenButton language={language} text={speech} />}
    </PageIntro>
    <HomeActionCard featured title={t(language, 'homeTrainTitle')} description={t(language, 'homeTrainDescription')}
      imageSource={regional?.imageAsset}
      accessibilityHint={t(language, 'activitiesOpen')} icon="psychology" highContrast={preferences.highContrast}
      reducedMotion={preferences.reducedMotion} textSize={textSize} onPress={() => router.navigate('/patient/games')} />
    <SmaranCard style={[styles.group, { borderLeftWidth: 5, borderLeftColor: colors.primary }]}>
      <ThemedText type="cardHeading">{t(language, 'dayToday')}</ThemedText>
      <ThemedText type={reminder ? 'action' : 'body'}>{todayText}</ThemedText>
      {button(t(language, 'homeDayTitle'), () => router.navigate('/patient/my-day'))}
    </SmaranCard>
    <View style={styles.group}>
      <ThemedText type="cardHeading">{t(language, 'familiarMemory')}</ThemedText>
      {memory ? <SmaranCard style={styles.group}>
        {memory.photoPath && <MemoryPhoto patientId={memory.patientId} path={memory.photoPath} name={memory.name} language={language} />}
        <ThemedText type="action">{memory.name}</ThemedText>
        {!!memory.relationship && <ThemedText>{memory.relationship}</ThemedText>}
        {button(t(language, 'memoryOpen'), () => router.navigate({ pathname: '/patient/my-memory', params: { id: memory.id } }))}
      </SmaranCard> : <>
        <ThemedText>{t(language, 'memoryEmpty')}</ThemedText>
        {button(t(language, 'memoryAdd'), () => router.navigate('/patient/my-memory-editor'))}
      </>}
    </View>
    {regional && <View style={styles.group}>
      <ThemedText type="cardHeading">{t(language, 'fromHome')}</ThemedText>
      <SmaranCard style={styles.group}>
        <Image source={regional.imageAsset} contentFit="cover" transition={0} accessible
          accessibilityLabel={`${getRegionName(language, settings.region)}. ${t(language, regionalCategoryKeys[regional.category])}`}
          style={{ width: '100%', aspectRatio: 2, borderRadius: Radius.card }} />
        <ThemedText type="action">{getRegionName(language, settings.region)}</ThemedText>
        <ThemedText>{t(language, regionalCategoryKeys[regional.category])}</ThemedText>
        {button(t(language, 'memoryOpen'), () => router.navigate({ pathname: '/patient/my-home-memory', params: { id: regional.id } }))}
      </SmaranCard>
    </View>}
    <SmaranCard style={styles.group}>
      <ThemedText type="cardHeading">{t(language,'gpsPatientTitle')}</ThemedText>
      <ThemedText>{t(language,location.patientId===patientId?location.status:'gpsPaused')}</ThemedText>
      {location.patientId===patientId&&location.point&&<ThemedText>{t(language,freshness(location.point))}</ThemedText>}
      {button(t(language, 'gpsPatientTitle'), () => router.navigate('/patient/location'))}
    </SmaranCard>
    <View style={styles.brand}>
      <MaterialIcons name="offline-pin" size={24} color={colors.success} accessible={false} aria-hidden />
      <ThemedText type="secondary">{t(language, 'readyOffline')}</ThemedText>
    </View>
  </View></ScreenWrapper>;
}
const styles = StyleSheet.create({
  content: PageLayout.content,
  group: PageLayout.group,
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
