import { View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { useAuthStore } from '@/src/cloud/auth';
import { syncNow, useSyncStore } from '@/src/cloud/sync';
import { initialSyncState } from '@/src/cloud/sync-status';
import type { Language } from '@/src/db/schema.types';
import { syncRepository } from '@/src/db/repositories/sync.repository';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';

export function SyncStatus({ language, patientId }: { language: Language; patientId: string | null }) {
  const auth = useAuthStore();
  const stored = useSyncStore();
  const patient = usePatientSessionStore();
  const router = useRouter();
  const [scope, setScope] = useState<{ ownerId: string; patientId: string; revision: number; patientRevision: number; included: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    setScope(null);
    const ownerId = auth.ownerId;
    if (ownerId && patientId) void syncRepository.includesPatient(ownerId, patientId).then(included => {
      if (live) setScope({ ownerId, patientId, revision: auth.revision, patientRevision: patient.revision, included });
    }).catch(() => {});
    return () => { live = false; };
  }, [auth.ownerId, auth.revision, patient.revision, patientId, stored.linked, stored.unlinked]);
  // Never render a previous owner's metadata, even between auth notifications.
  const sync = auth.ownerId && auth.ownerId === stored.ownerId &&
    scope?.ownerId === auth.ownerId && scope.patientId === patientId && scope.included &&
    scope.revision === auth.revision && scope.patientRevision === patient.revision && !patient.switching &&
    (!patient.patientId || patient.patientId === patientId) &&
    ['signed-in', 'offline', 'unavailable'].includes(auth.status) ? stored : initialSyncState;
  const key: TranslationKey = auth.status === 'storage-error' ? 'accountStorage'
    : auth.status === 'expired' ? 'accountSessionExpired'
    : auth.status === 'restoring' ? 'accountRestoring'
    : ({ local: 'accountLocalStatus', paused: 'accountPaused', 'signed-in': 'syncOnline',
      offline: sync.pending ? 'syncOfflinePending' : 'accountOffline', syncing: 'accountSyncing',
      current: 'accountCurrent', waiting: 'accountPending', attention: 'syncIssue' } as const)[sync.status];
  const label = t(language, key, { count: new Intl.NumberFormat(language).format(sync.pending) });
  const offlineHelp = sync.status === 'offline' && sync.linked ? t(language, 'syncOfflineHelp') : '';
  const last = sync.linked && sync.lastSuccess ? t(language, 'accountLast', {
    time: new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sync.lastSuccess)),
  }) : '';
  const canSync = sync.linked && sync.connected !== false && ['signed-in', 'offline', 'unavailable'].includes(auth.status);
  const action = t(language, sync.status === 'attention' || sync.error ? 'retry' : 'accountSyncNow');
  return <View style={{ gap: Spacing.sm }}>
    <View accessible accessibilityLiveRegion="polite"
      accessibilityLabel={[t(language, 'syncScope'), label, offlineHelp, last].filter(Boolean).join('. ')}>
      <ThemedText type="secondary">{t(language, 'syncScope')}</ThemedText>
      <ThemedText type="action">{label}</ThemedText>
      {!!offlineHelp && <ThemedText type="secondary">{offlineHelp}</ThemedText>}
      {!!last && <ThemedText type="secondary">{last}</ThemedText>}
    </View>
    {canSync && <SmaranButton variant="outline" label={action} accessibilityLabel={`${action}. ${label}`}
      disabled={auth.busy || sync.active} loading={sync.active} onPress={() => { void syncNow(true).catch(() => {}); }} />}
    {['expired', 'storage-error'].includes(auth.status) && <SmaranButton variant="outline"
      label={t(language, 'accountTitle')} accessibilityLabel={t(language, 'accountTitle')} onPress={() => router.push('/account')} />}
  </View>;
}
