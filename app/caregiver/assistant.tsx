import { AiAssistant } from '@components/ai-assistant';
import { CareWorkspace } from '@components/caregiver/care-workspace';
export default function AssistantScreen() {
  return <CareWorkspace title="aiTitle">{data => <AiAssistant patientId={data.patient.id} language={data.settings.language} />}</CareWorkspace>;
}
