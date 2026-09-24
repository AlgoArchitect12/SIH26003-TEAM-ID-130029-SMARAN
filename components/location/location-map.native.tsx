import { useRef } from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { t } from '@i18n/index';
import type { Language } from '@/src/db/schema.types';
import type { LocationPoint, SafeZone } from '@/src/location/live';
export function LocationMap({point,zone,language}: {point:LocationPoint;zone:SafeZone|null;language:Language}) {
  const map=useRef<MapView>(null);
  if(!Constants.expoConfig?.extra?.mapsConfigured?.[Platform.OS]) return <ThemedText>{t(language,'gpsMapUnavailable')}</ThemedText>;
  const region={latitude:point.latitude,longitude:point.longitude,latitudeDelta:0.015,longitudeDelta:0.015};
  return <View style={{gap:12}}>
    <MapView ref={map} provider={PROVIDER_GOOGLE} initialRegion={region} style={{height:300,width:'100%'}}
      showsUserLocation={false} showsMyLocationButton={false} toolbarEnabled={false}
      accessibilityLabel={t(language,'gpsTitle')}>
      <Marker coordinate={point} title={t(language,'gpsPatientTitle')} />
      {zone && <Circle center={zone} radius={zone.radius} strokeColor="#14665E" fillColor="rgba(20,102,94,0.15)" />}
    </MapView>
    <SmaranButton label={t(language,'gpsRecenter')} accessibilityLabel={t(language,'gpsRecenter')}
      variant="outline" onPress={()=>map.current?.animateToRegion(region,0)} />
  </View>;
}
