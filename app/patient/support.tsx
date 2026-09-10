import { useLocalSearchParams } from 'expo-router';
import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { SmaranBrand } from '@components/ui/smaran-brand';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { t } from '@i18n/index';
export default function SupportScreen() {
  const patient = useMyDayPatient();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const about = section === 'about';
  const title = t(patient.language, about ? 'about' : 'help');
  const body = t(patient.language, about ? 'aboutBody' : 'helpBody');
  const privacy = ['privacyLocal', 'privacyLoss', 'privacySharing'] as const;
  return <PatientPage {...patient} title={title}>
    {about && <>
      <SmaranBrand />
      <ThemedText>{t(patient.language, 'appTagline')}</ThemedText>
    </>}
    <ThemedText>{body}</ThemedText>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(patient.language, 'privacyTitle')}</ThemedText>
    {privacy.map(key => <ThemedText key={key}>{t(patient.language, key)}</ThemedText>)}
    <ReadScreenButton language={patient.language} text={[title, body, t(patient.language, 'privacyTitle'), ...privacy.map(key => t(patient.language, key))].join('. ')} />
  </PatientPage>;
}
