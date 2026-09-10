import { create } from 'zustand';

// Transient invalidation only. SQLite and SecureStore remain the source of truth.
export const usePatientSessionStore = create<{
  revision: number;
  switching: boolean;
  patientId: string | null;
}>()(() => ({ revision: 0, switching: false, patientId: null }));

export function capturePatientRequest() {
  const { revision, switching } = usePatientSessionStore.getState();
  return () => {
    const current = usePatientSessionStore.getState();
    return !switching && !current.switching && current.revision === revision;
  };
}
