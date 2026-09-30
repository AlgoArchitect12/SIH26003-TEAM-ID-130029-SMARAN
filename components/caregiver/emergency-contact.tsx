import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { t, type TranslationKey } from '@i18n/index';
import type { Language } from '@db/schema.types';
import { openEmergencyDialer, readEmergencyContact } from '@services/emergency.service';
import { capturePatientRequest } from '@/src/stores/patient-session.store';

export function EmergencyContact({ patientId, language }: { patientId: string; language: Language }) {
  const focused = useIsFocused();
  const [contact, setContact] = useState<Awaited<ReturnType<typeof readEmergencyContact>>>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    invalidate(); setContact(null); setMessage(null);
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') { invalidate(); setContact(null); }
    });
    return () => { invalidate(); app.remove(); };
  }, [focused, patientId, invalidate]);
  const run = async (dial: boolean) => {
    if (lock.current || !focused) return;
    const current = capturePatientRequest(), request = generation.current;
    const valid = () => current() && request === generation.current;
    lock.current = true; setBusy(true); setMessage(null);
    try {
      if (dial && contact) { await openEmergencyDialer(patientId, contact.phone, valid); if (valid()) setContact(null); }
      else { const value = await readEmergencyContact(patientId); if (valid()) { setContact(value); if (!value) setMessage('emergencyMissing'); } }
    } catch { if (valid()) setMessage('emergencyFailed'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}>
    {contact && focused ? <>
      <ThemedText>{t(language, 'emergencyConfirm', contact)}</ThemedText>
      <SmaranButton label={t(language, 'emergencyOpen')} accessibilityLabel={t(language, 'emergencyOpen')} disabled={busy} onPress={() => void run(true)} />
      <SmaranButton label={t(language, 'circleCancel')} accessibilityLabel={t(language, 'circleCancel')} disabled={busy} variant="outline" onPress={() => setContact(null)} />
    </> : <SmaranButton label={t(language, 'emergencyDial')} accessibilityLabel={t(language, 'emergencyDial')} disabled={busy} variant="outline" onPress={() => void run(false)} />}
    {message && <ThemedText accessibilityRole="alert">{t(language, message)}</ThemedText>}
  </View>;
}
