import { create } from 'zustand';

// Transient invalidation only. SQLite and SecureStore remain the source of truth.
export const usePatientSessionStore = create<{
  revision: number;
  switching: boolean;
  patientId: string | null;
  workspace: 'patient' | 'caregiver';
  workspaceRevision: number;
}>()(() => ({ revision: 0, switching: false, patientId: null, workspace: 'patient', workspaceRevision: 0 }));

export function setWorkspace(workspace: 'patient' | 'caregiver') {
  usePatientSessionStore.setState(state => state.workspace === workspace ? state :
    { workspace, workspaceRevision: state.workspaceRevision + 1, revision: state.revision + 1 });
}

export function captureReminderManagement() {
  const state = usePatientSessionStore.getState();
  const current = capturePatientRequest();
  return () => current() && state.workspace === 'caregiver' &&
    usePatientSessionStore.getState().workspace === 'caregiver' &&
    state.workspaceRevision === usePatientSessionStore.getState().workspaceRevision;
}

export function capturePatientRequest() {
  const { revision, switching } = usePatientSessionStore.getState();
  return () => {
    const current = usePatientSessionStore.getState();
    return !switching && !current.switching && current.revision === revision;
  };
}
