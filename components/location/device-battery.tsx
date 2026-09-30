import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { readBatteryPercent } from '@services/device-status.service';
import { withTimeout } from '@/src/utils/with-timeout';

export function DeviceBattery({ language }: { language: Language }) {
  const focused = useIsFocused(), generation = useRef(0), lock = useRef(false);
  const [percent, setPercent] = useState<number | null | undefined>(), [busy, setBusy] = useState(false);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    invalidate(); setPercent(undefined);
    const app = AppState.addEventListener('change', () => { invalidate(); setPercent(undefined); });
    return () => { invalidate(); app.remove(); };
  }, [focused, invalidate]);
  const read = async () => {
    if (!focused || lock.current) return;
    lock.current = true; setBusy(true);
    const request = generation.current;
    const value = await withTimeout(readBatteryPercent()).catch(() => null);
    if (request === generation.current) setPercent(value);
    lock.current = false; setBusy(false);
  };
  return <View style={{ gap: 12 }}>
    <SmaranButton variant="outline" label={t(language, 'deviceBatteryRead')} accessibilityLabel={t(language, 'deviceBatteryRead')} disabled={busy} onPress={() => void read()} />
    {percent !== undefined && <ThemedText accessibilityLiveRegion="polite">{percent === null ? t(language, 'deviceBatteryUnknown') : t(language, 'deviceBattery', { percent: String(percent) })}</ThemedText>}
  </View>;
}
