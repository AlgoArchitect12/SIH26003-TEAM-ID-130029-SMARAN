import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { homeStyles as styles, regionalCategoryKeys, RegionalImage, RegionalRecovery, useMyHomePatient } from '@components/my-home/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageIntro } from '@components/ui/page-intro';
import { Radius } from '@constants/layout';
import { getRegionName, t } from '@i18n/index';
import { getRegionalPack } from '@/src/my-home/content';

export default function MyHomeScreen() {
  const router = useRouter();
  const { state, status, language, retry } = useMyHomePatient();
  const items = getRegionalPack(state);
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />
    <PageIntro title={t(language, 'homeRegionTitle')} description={t(language, 'regionalIntro')} icon="landscape" />
    {status !== 'ready' ? <RegionalRecovery status={status} language={language} retry={retry} /> : state && <>
      <View style={styles.heading}>
        <ThemedText type="cardHeading">{t(language, 'homeRegionContext', { region: getRegionName(language, state) })}</ThemedText>
      </View>
      {language !== 'en' && <ThemedText>{t(language, 'regionalEnglish')}</ThemedText>}
      <ReadScreenButton language={language} text={[
        t(language, 'homeRegionTitle'), t(language, 'homeRegionContext', { region: getRegionName(language, state) }),
        t(language, 'regionalIntro'), ...items.map(item => language === 'en' ? `${item.title}. ${item.shortDescription}` : t(language, regionalCategoryKeys[item.category])),
      ].join(' ')} />
      {state === 'assam' && <Image source={require('../../assets/images/stitch-brahmaputra.png')}
        accessible={false} contentFit="cover" transition={0}
        style={{ width: '100%', aspectRatio: 1.8, borderRadius: Radius.card }} />}
      {items.map(item => <SmaranCard key={item.id} style={styles.group}>
        <RegionalImage item={item} language={language} />
        <ThemedText type="cardHeading" accessibilityRole="header" accessibilityLanguage="en">{item.title}</ThemedText>
        <ThemedText type="secondary">{t(language, regionalCategoryKeys[item.category])}</ThemedText>
        <ThemedText accessibilityLanguage="en">{item.shortDescription}</ThemedText>
        <SmaranButton label={t(language, 'memoryOpen')} variant="outline"
          accessibilityLabel={`${item.title}. ${getRegionName(language, item.state)}. ${t(language, regionalCategoryKeys[item.category])}. ${t(language, 'memoryOpen')}.`}
          onPress={() => router.push({ pathname: '/patient/my-home-memory', params: { id: item.id } })} />
      </SmaranCard>)}
    </>}
  </View></ScreenWrapper>;
}
