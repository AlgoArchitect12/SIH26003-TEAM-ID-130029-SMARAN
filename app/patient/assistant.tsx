import { AiAssistant } from '@components/ai-assistant';
import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { t } from '@i18n/index';
export default function AssistantScreen() {
  const data = useMyDayPatient();
  return <PatientPage {...data} title={t(data.language,'aiPatientTitle')}>
    {data.patientId && <AiAssistant key={data.patientId} patientId={data.patientId} language={data.language} patient />}
  </PatientPage>;
}
