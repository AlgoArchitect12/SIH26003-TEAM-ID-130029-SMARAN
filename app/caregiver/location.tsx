import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { CareWorkspace } from '@components/caregiver/care-workspace';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import type { ActiveCare } from '@/src/services/care-circle.service';
import { locationRepository as repo } from '@/src/db/repositories/location.repository';
import { refreshTracking, setPatientTracking, useLocationStore } from '@/src/services/location.service';
import type { PatientLocation, TrackingState } from '@/src/location/types';

function LocationPanel({ data }: { data: ActiveCare }) {
  const language = data.settings.language, revision = useLocationStore(s => s.revision);
  const [state, setState] = useState<TrackingState | null>(null), [points, setPoints] = useState<PatientLocation[]>([]);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    const load = () => void Promise.all([repo.state(data.patient.id), repo.recent(data.patient.id)]).then(([value, rows]) => {
      if (live && data.current()) { setState(value); setPoints(rows); }
    }).catch(() => { if (live) setFailed(true); });
    load(); const app = AppState.addEventListener('change', value => { if (value === 'active') load(); });
    return () => { live = false; app.remove(); };
  }, [data, revision]);
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current || !data.current()) return;
    lock.current = true; setBusy(true); setFailed(false);
    try { await action(); } catch { if (data.current()) setFailed(true); }
    finally { lock.current = false; if (data.current()) setBusy(false); }
  };
  return <>
    <ThemedText>{t(language, 'locationConsent')}</ThemedText>
    <ThemedText>{t(language, 'circleLocalNotice')}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite" type="cardHeading">{state?.status ?? 'PAUSED'}</ThemedText>
    <ThemedText>{t(language, state?.status === 'LOCATION_DISABLED' ? 'locationDisabled' : state?.status === 'PERMISSION_REQUIRED' ? 'locationPermission' : state?.status === 'ERROR' ? 'locationError' : 'locationLimits')}</ThemedText>
    {data.settings.voiceGuidance && <ReadScreenButton language={language} text={t(language, 'locationConsent') + ' ' + t(language, 'locationPermission')} />}
    {!state?.enabled && <SmaranButton label={t(language, 'reportConsent')} accessibilityLabel={t(language, 'locationConsent')} variant="outline" disabled={busy}
      accessibilityState={{ selected: consent }} onPress={() => setConsent(value => !value)} />}
    <SmaranButton label={t(language, state?.enabled ? 'gamePause' : 'locationEnable')} accessibilityLabel={t(language, state?.enabled ? 'gamePause' : 'locationEnable')}
      disabled={busy || (!state?.enabled && !consent)} loading={busy} onPress={() => void run(() => setPatientTracking(data.patient.id, !state?.enabled))} />
    <SmaranButton label={t(language, 'locationSettings')} accessibilityLabel={t(language, 'locationSettings')} variant="outline" disabled={busy} onPress={() => void run(() => Linking.openSettings())} />
    <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} variant="outline" disabled={busy} onPress={() => void run(refreshTracking)} />
    {failed && <ThemedText accessibilityRole="alert">{t(language, 'locationError')}</ThemedText>}
    <ThemedText type="cardHeading">{t(language, 'locationLatest')}</ThemedText>
    {!points.length && <ThemedText>{t(language, 'locationEmpty')}</ThemedText>}
    {points.map((point, index) => <View key={point.id} style={PageLayout.group}>
      <ThemedText type={index === 0 ? 'cardHeading' : 'default'}>{new Date(point.recorded_at).toLocaleString(language)}</ThemedText>
      <ThemedText>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}{point.accuracy === null ? '' : ` (± ${Math.round(point.accuracy)} m)`}</ThemedText>
      {point.source === 'last_known' && <ThemedText type="secondary">{t(language, 'locationFallback')}</ThemedText>}
    </View>)}
  </>;
}
export default function LocationScreen() {
  return <CareWorkspace title="locationTitle">{data => <LocationPanel data={data} />}</CareWorkspace>;
}
