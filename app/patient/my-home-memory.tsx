import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { homeStyles as styles, RegionalImage, RegionalRecovery, useMyHomePatient } from '@components/my-home/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { getRegionName, t } from '@i18n/index';
import { getRegionalItem, imageCredits } from '@/src/my-home/content';

export default function MyHomeMemoryScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, status, language, retry } = useMyHomePatient();
  const [responded, setResponded] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  useEffect(() => { setResponded(false); setShowCredits(false); }, [id, focused]);
  const candidate = getRegionalItem(id);
  const item = candidate?.state === state ? candidate : undefined;
  const credit = item ? imageCredits[item.imageCredit] : undefined;
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={`${t(language, 'back')}. ${t(language, 'homeRegionTitle')}`} variant="outline" onPress={() => router.replace('/patient/my-home')} />
    {status !== 'ready' ? <RegionalRecovery status={status} language={language} retry={retry} /> : !item ?
      <ThemedText accessibilityRole="alert">{t(language, 'regionalMissing')}</ThemedText> : <>
        <RegionalImage key={item.id} item={item} language={language} />
        <ThemedText type="screenTitle" accessibilityRole="header" accessibilityLanguage="en">{item.title}</ThemedText>
        <ThemedText type="cardHeading">{getRegionName(language, item.state)}</ThemedText>
        {language !== 'en' && <ThemedText>{t(language, 'regionalEnglish')}</ThemedText>}
        <ThemedText accessibilityLanguage="en">{item.detail}</ThemedText>
        <ThemedText accessibilityLanguage="en">{item.gentlePrompt}</ThemedText>
        <ReadScreenButton language={language} speechLanguage="en" labelKey="memoryHear"
          text={`${item.title}. ${getRegionName('en', item.state)}. ${item.detail} ${item.gentlePrompt}`} />
        <ThemedText type="cardHeading">{t(language, 'regionalFamiliar')}</ThemedText>
        {responded ? <ThemedText accessibilityLiveRegion="polite">{t(language, 'regionalThanks')}</ThemedText> : <View style={styles.group}>
          <SmaranButton label={t(language, 'regionalYes')} accessibilityLabel={t(language, 'regionalYes')} onPress={() => setResponded(true)} />
          <SmaranButton label={t(language, 'regionalNotToday')} accessibilityLabel={t(language, 'regionalNotToday')} variant="outline" onPress={() => setResponded(true)} />
        </View>}
        <SmaranButton label={t(language, 'returnHome')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.replace('/patient/home')} />
        <SmaranButton label={t(language, 'regionalCredits')} accessibilityLabel={t(language, 'regionalCredits')} variant="outline" onPress={() => setShowCredits(value => !value)} />
        {showCredits && credit && <View style={styles.group}>
          <ThemedText>{credit.title}</ThemedText>
          <ThemedText>{credit.author} · {credit.license}</ThemedText>
          <ThemedText>{t(language, 'regionalImageChanges')}</ThemedText>
          <ThemedText>{t(language, 'regionalOriginal')}</ThemedText>
          <ThemedText selectable>{decodeURI(credit.originalPage).replace(/([/_.])/gu, '$1\u200b')}</ThemedText>
          <ThemedText>{t(language, 'regionalLicense')}</ThemedText>
          <ThemedText selectable>{credit.licenseUrl.replace(/([/_.])/gu, '$1\u200b')}</ThemedText>
        </View>}
      </>}
    {status === 'ready' && !item && <SmaranButton label={t(language, 'returnHome')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.replace('/patient/home')} />}
  </View></ScreenWrapper>;
}
