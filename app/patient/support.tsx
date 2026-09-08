import { useLocalSearchParams } from 'expo-router';
import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { ThemedText } from '@components/themed-text';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { t } from '@i18n/index';
export default function SupportScreen() {
  const patient = useMyDayPatient();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const about = section === 'about';
  const title = t(patient.language, about ? 'about' : 'help');
  const body = t(patient.language, about ? 'aboutBody' : 'helpBody');
  return <PatientPage {...patient} title={title}>
    <ThemedText>{body}</ThemedText>
    <ReadScreenButton language={patient.language} text={`${title}. ${body}`} />
  </PatientPage>;
}
