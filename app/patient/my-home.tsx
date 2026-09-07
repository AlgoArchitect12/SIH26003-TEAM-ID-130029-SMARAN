import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { homeStyles as styles, regionalCategoryKeys, RegionalImage, RegionalRecovery, useMyHomePatient } from '@components/my-home/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { getRegionName, t } from '@i18n/index';
import { getRegionalPack } from '@/src/my-home/content';

export default function MyHomeScreen() {
  const router = useRouter();
  const { state, status, language, retry } = useMyHomePatient();
  const items = getRegionalPack(state);
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.replace('/patient/home')} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeRegionTitle')}</ThemedText>
    {status !== 'ready' ? <RegionalRecovery status={status} language={language} retry={retry} /> : state && <>
      <ThemedText type="cardHeading">{t(language, 'homeRegionContext', { region: getRegionName(language, state) })}</ThemedText>
      <ThemedText>{t(language, 'regionalIntro')}</ThemedText>
      {language !== 'en' && <ThemedText>{t(language, 'regionalEnglish')}</ThemedText>}
      <ReadScreenButton language={language} speechLanguage="en" text={[
        t('en', 'homeRegionTitle'), t('en', 'homeRegionContext', { region: getRegionName('en', state) }),
        t('en', 'regionalIntro'), ...items.map(item => `${item.title}. ${item.shortDescription}`),
      ].join(' ')} />
      {items.map(item => <SmaranCard key={item.id} style={styles.group}>
        <RegionalImage item={item} language={language} />
        <ThemedText type="cardHeading" accessibilityRole="header" accessibilityLanguage="en">{item.title}</ThemedText>
        <ThemedText>{t(language, regionalCategoryKeys[item.category])}</ThemedText>
        <ThemedText accessibilityLanguage="en">{item.shortDescription}</ThemedText>
        <SmaranButton label={t(language, 'memoryOpen')}
          accessibilityLabel={`${item.title}. ${getRegionName(language, item.state)}. ${t(language, regionalCategoryKeys[item.category])}. ${t(language, 'memoryOpen')}.`}
          onPress={() => router.push({ pathname: '/patient/my-home-memory', params: { id: item.id } })} />
      </SmaranCard>)}
      <SmaranButton label={t(language, 'returnHome')} accessibilityLabel={t(language, 'returnHome')} variant="outline" onPress={() => router.replace('/patient/home')} />
    </>}
  </View></ScreenWrapper>;
}
