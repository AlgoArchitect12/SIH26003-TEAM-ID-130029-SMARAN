import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { homeStyles as styles, RegionalImage, RegionalRecovery, useMyHomePatient } from '@components/my-home/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { getRegionName, t } from '@i18n/index';
import { getRegionalItem, imageCredits, nextRegionalItem } from '@/src/my-home/content';

export default function MyHomeMemoryScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, status, language, retry } = useMyHomePatient();
  const [response, setResponse] = useState<'yes' | 'next' | null>(null);
  const [shownId, setShownId] = useState(id);
  const [showCredits, setShowCredits] = useState(false);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShownId(id); setResponse(null); setShowCredits(false);
    return () => { if (nextTimer.current) clearTimeout(nextTimer.current); };
  }, [id, focused, state]);

  const candidate = getRegionalItem(shownId);
  const item = candidate?.state === state ? candidate : undefined;
  const credit = item ? imageCredits[item.imageCredit] : undefined;

  const handleNotToday = () => {
    if (!item || !focused) return;
    setResponse('next'); setShowCredits(false);
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = setTimeout(() => {
      const following = nextRegionalItem(state, item.id);
      if (following) {
        setShownId(following.id);
        setResponse(null);
      }
    }, 2500);
  };

  const handleNext = () => {
    if (!item || !focused) return;
    const following = nextRegionalItem(state, item.id);
    if (following) {
      setShownId(following.id);
      setResponse(null);
    }
  };

  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={`${t(language, 'back')}. ${t(language, 'homeRegionTitle')}`} variant="outline" onPress={() => router.dismissTo('/patient/my-home')} />
    {status !== 'ready' ? <RegionalRecovery status={status} language={language} retry={retry} /> : !item ?
      <ThemedText accessibilityRole="alert">{t(language, 'regionalMissing')}</ThemedText> : <>
        <RegionalImage key={item.id} item={item} language={language} />
        <ThemedText type="screenTitle" accessibilityRole="header" accessibilityLanguage="en">{item.title}</ThemedText>
        <ThemedText type="cardHeading">{getRegionName(language, item.state)}</ThemedText>
        {language !== 'en' && <ThemedText>{t(language, 'regionalEnglish')}</ThemedText>}
        <ThemedText accessibilityLanguage="en">{item.detail}</ThemedText>
        <ThemedText accessibilityLanguage="en">{item.gentlePrompt}</ThemedText>
        <ReadScreenButton language={language} labelKey="memoryHear"
          text={language === 'en' ? `${item.title}. ${getRegionName(language, item.state)}. ${item.detail} ${item.gentlePrompt}`
            : `${getRegionName(language, item.state)}. ${t(language, 'regionalIntro')} ${t(language, 'regionalFamiliar')}`} />
        <ThemedText type="cardHeading">{t(language, 'regionalFamiliar')}</ThemedText>
        {response && <View style={styles.group}><ThemedText accessibilityLiveRegion="polite">{t(language, response === 'yes' ? 'regionalYesResponse' : 'regionalNextResponse')}</ThemedText>
          <ReadScreenButton language={language} text={t(language, response === 'yes' ? 'regionalYesResponse' : 'regionalNextResponse')} /></View>}
        {!response && <View style={styles.group}>
          <SmaranButton label={t(language, 'regionalYes')} accessibilityLabel={t(language, 'regionalYes')} onPress={() => setResponse('yes')} />
          <SmaranButton label={t(language, 'regionalNotToday')} accessibilityLabel={t(language, 'regionalNotToday')} variant="outline" onPress={handleNotToday} />
        </View>}
        {response === 'yes' && <SmaranButton label={t(language, 'regionalNext')} accessibilityLabel={t(language, 'regionalNext')} variant="outline" onPress={handleNext} />}
        <SmaranButton label={t(language, 'returnHome')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />
        <SmaranButton label={t(language, 'regionalCredits')} accessibilityLabel={t(language, 'regionalCredits')} variant="outline" onPress={() => setShowCredits(value => !value)} />
        {showCredits && credit && <View style={styles.group}>
          <ThemedText>{credit.title}</ThemedText>
          <ThemedText>{credit.author} A {credit.license}</ThemedText>
          <ThemedText>{t(language, 'regionalImageChanges')}</ThemedText>
          <ThemedText>{t(language, 'regionalOriginal')}</ThemedText>
          <ThemedText selectable>{decodeURI(credit.originalPage).replace(/([/_.])/gu, '$1\u200b')}</ThemedText>
          <ThemedText>{t(language, 'regionalLicense')}</ThemedText>
          <ThemedText selectable>{credit.licenseUrl.replace(/([/_.])/gu, '$1\u200b')}</ThemedText>
        </View>}
      </>}
    {status === 'ready' && !item && <SmaranButton label={t(language, 'returnHome')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />}
  </View></ScreenWrapper>;
}
