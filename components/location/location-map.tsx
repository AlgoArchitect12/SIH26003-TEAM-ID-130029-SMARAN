import { ThemedText } from '@components/themed-text';
import { t } from '@i18n/index';
import type { Language } from '@/src/db/schema.types';
import type { LocationPoint, SafeZone } from '@/src/location/live';
export function LocationMap({language}: {point:LocationPoint;zone:SafeZone|null;language:Language}) {
  return <ThemedText>{t(language,'gpsMapUnavailable')}</ThemedText>;
}
