import { PatientPage } from '@components/patient/patient-page';
import { useMyDayPatient } from '@components/my-day/shared';
import { LocationPanel } from '@components/location/location-panel';
import { t } from '@i18n/index';
export default function PatientLocationScreen() {
  const data=useMyDayPatient();
  return <PatientPage {...data} title={t(data.language,'gpsPatientTitle')}>
    {data.patientId&&<LocationPanel key={data.patientId} patientId={data.patientId} language={data.language} device/>}
  </PatientPage>;
}
