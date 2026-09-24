import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { captureAccount, getCloudClient, sessionExpired, useAuthStore } from '../cloud/auth';
import { capturePatientRequest, usePatientSessionStore } from '../stores/patient-session.store';
import { locationRepository as repo, type LocationDevice } from '../db/repositories/location.repository';
import { newerSnapshot, validPoint, validZone, type LocationPoint, type LocationSnapshot, type SafeZone } from '../location/live';

export type GpsStatus = 'gpsUnavailable' | 'gpsCurrent' | 'gpsDenied' | 'gpsDisabled' | 'gpsOffline' | 'gpsPaused' | 'gpsSignIn' | 'gpsFailed';
export const useLocationStore = create<{ patientId: string | null; status: GpsStatus; point: LocationPoint | null }>(()=>({patientId:null,status:'gpsPaused',point:null}));
export async function locationCall(method: string, args: Record<string,unknown>) {
  const account=captureAccount();
  if (!account.current()) throw new Error('gpsSignIn');
  const result=await getCloudClient().rpc(method,args).abortSignal(account.signal);
  if (!account.current()) throw new Error('gpsSignIn');
  if(result.status===401) { sessionExpired(); throw new Error('gpsSignIn'); }
  if(result.error) throw new Error(result.status===0?'gpsOffline':'gpsFailed');
  if(result.data?.ok!==true) throw new Error(result.data?.error==='consent'?'gpsConsentRequired':'gpsForbidden');
  return result.data;
}
export async function locationSnapshot(patient: string): Promise<LocationSnapshot> {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(patient)) throw new Error('gpsForbidden');
  return parseSnapshot(await locationCall('location_snapshot',{p_patient:patient}));
}
function parseSnapshot(data: LocationSnapshot) {
  if(typeof data.owner!=='boolean'||typeof data.consent!=='boolean'||typeof data.enabled!=='boolean'||
    typeof data.epoch!=='string'||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.history)||data.history.length>288||
    data.history.some((p:LocationPoint)=>!validPoint(p))||(data.point&&!validPoint(data.point))||(data.zone&&!validZone(data.zone))||
    (data.enabled&&(!data.consent||! /^[0-9a-f-]{36}$/i.test(data.epoch)))||
    (data.event&&(!['entry','exit'].includes(data.event.kind)||!Number.isFinite(Date.parse(data.event.at))))) throw new Error('gpsFailed');
  return data;
}
let watcher: Location.LocationSubscription | null=null;
let generation=0;
export function stopLocationCapture() { generation++; watcher?.remove(); watcher=null; }

export async function setLocationSharing(patient: string, action:'consent'|'resume'|'pause'|'revoke'|'zone', zone:SafeZone|null=null, device=false) {
  const account=captureAccount(), patientCurrent=capturePatientRequest();
  const current=()=>account.current()&&patientCurrent();
  if(!current()) throw new Error('gpsSignIn');
  if(zone&&!validZone(zone)) throw new Error('gpsInvalidZone');
  if(device&&(action==='pause'||action==='revoke')) {
    stopLocationCapture(); useLocationStore.setState({patientId:patient,status:'gpsPaused',point:null});
    await repo.stop(patient,account.ownerId!,action,current);
  }
  if(device&&action==='consent') {
    const status=await devicePermission(true);
    if(status!=='gpsCurrent') { useLocationStore.setState({patientId:patient,status}); throw new Error(status); }
  }
  const data=parseSnapshot(await locationCall('location_control',{p_patient:patient,p_action:action,p_zone:zone}));
  if(!current()) throw new Error('gpsSignIn');
  if(device) await repo.configure(patient,account.ownerId!,data.epoch,data.enabled,current);
  return data;
}
export async function devicePermission(request=false):Promise<GpsStatus> {
  if(Platform.OS==='web') return 'gpsUnavailable';
  if(!await Location.hasServicesEnabledAsync()) return 'gpsDisabled';
  const permission=request?await Location.requestForegroundPermissionsAsync():await Location.getForegroundPermissionsAsync();
  return permission.granted?'gpsCurrent':'gpsDenied';
}

// Foreground only: leaving the app immediately removes the native watch.
export function startLocationLifecycle() {
  if(Platform.OS==='web') return ()=>{};
  let alive=true, running=false, activeDevice:LocationDevice|null=null;
  const stop=()=>{stopLocationCapture();activeDevice=null;useLocationStore.setState({patientId:null,status:'gpsPaused',point:null});};
  const tick=async()=>{
    if(running||!alive) return;
    running=true;
    const account=captureAccount(), person=capturePatientRequest(), before=generation;
    const state=usePatientSessionStore.getState();
    const accountCurrent=()=>alive&&account.current()&&AppState.currentState==='active';
    const current=()=>accountCurrent()&&person()&&state.workspace==='patient'&&generation===before;
    try {
      if(!accountCurrent()){stop();return;}
      const online=await Network.getNetworkStateAsync();
      if(!accountCurrent()) return;
      const connected=online.isConnected===true&&online.isInternetReachable!==false;
      if(connected) {
        // Privacy stops must sync even after switching person or caregiver workspace.
        for(const pending of await repo.controls(account.ownerId!)) {
          if(!accountCurrent()) return;
          const snapshot=await locationCall('location_control',{p_patient:pending.patient_id,p_action:pending.pending_control});
          if(accountCurrent()) await repo.configure(pending.patient_id,pending.owner_id,snapshot.epoch,false,accountCurrent);
        }
      }
      if(!current()||!state.patientId) {stop();return;}
      const device=await repo.device(state.patientId,account.ownerId!);
      if(!current()) return;
      if(!device) {stop();return;}
      if(device.pending_control)return;
      if(connected) {
        const snapshot=await locationSnapshot(device.patient_id);
        if(!current()) return;
        // A remotely changed epoch invalidates ALL offline points before resume.
        if(snapshot.epoch!==device.epoch||snapshot.enabled!==!!device.enabled) {
          await repo.configure(device.patient_id,device.owner_id,snapshot.epoch,snapshot.enabled&&snapshot.consent,current);
          stop(); return;
        }
      }
      if(!device.enabled) {stop();return;}
      const permission=await devicePermission();
      if(!current()) return;
      const recent=useLocationStore.getState();
      useLocationStore.setState({patientId:device.patient_id,status:!connected?'gpsOffline':permission==='gpsCurrent'&&
        (!recent.point||recent.patientId!==device.patient_id)?'gpsUnavailable':permission});
      if(permission!=='gpsCurrent') {watcher?.remove();watcher=null;}
      if(connected) {
        const points=await repo.pending(device);
        if(!current()) return;
        await locationCall('location_publish',{p_patient:device.patient_id,p_epoch:device.epoch,p_points:points,
          p_status:permission==='gpsDenied'?'denied':permission==='gpsDisabled'?'disabled':permission==='gpsCurrent'?'active':'unavailable'});
        if(current()) await repo.acknowledge(device,points);
      }
      if(!current()||permission!=='gpsCurrent'||watcher) return;
      activeDevice=device;
      const watched=device;
      let lastAt=0;
      const sub=await Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:30000,distanceInterval:20},fix=>{
        if(!current()||activeDevice!==watched||fix.timestamp-lastAt<30000) return;
        const point:LocationPoint={id:randomUUID(),latitude:fix.coords.latitude,longitude:fix.coords.longitude,
          accuracy:fix.coords.accuracy,recorded_at:new Date(fix.timestamp).toISOString()};
        if(!validPoint(point)) return;
        lastAt=fix.timestamp;
        void repo.enqueue(watched,point,current).then(()=>{
          if(current()) useLocationStore.setState(s=>({patientId:watched.patient_id,point,status:s.status==='gpsOffline'?'gpsOffline':'gpsCurrent'}));
        }).catch(()=>{if(current())useLocationStore.setState({status:'gpsFailed'});});
      },()=>{if(current())useLocationStore.setState({status:'gpsUnavailable'});});
      if(current()) watcher=sub; else sub.remove();
    } catch(error) {
      if(current()) {
        const message=error instanceof Error?error.message:'';
        useLocationStore.setState({status:message==='gpsForbidden'?'gpsPaused':message==='gpsSignIn'?'gpsSignIn':'gpsOffline'});
        if(message==='gpsForbidden'||message==='gpsSignIn') stop();
      }
    } finally {running=false;}
  };
  const auth=useAuthStore.subscribe(()=>{if(!captureAccount().current()){stop();} void tick();});
  const person=usePatientSessionStore.subscribe(()=>{stop();void tick();});
  const app=AppState.addEventListener('change',state=>{if(state!=='active')stop();else void tick();});
  const network=Network.addNetworkStateListener(()=>void tick());
  const timer=setInterval(()=>void tick(),15000); void tick();
  return ()=>{alive=false;stop();auth();person();app.remove();network.remove();clearInterval(timer);};
}

export type LiveLocationState = { snapshot:LocationSnapshot|null; status:'gpsLoading'|'gpsConnected'|'gpsReconnecting'|'gpsOffline'|'gpsForbidden'|'gpsSignIn'|'gpsFailed' };
export function watchPatientLocation(patient: string, receive:(state:LiveLocationState)=>void) {
  const account=captureAccount(), cloud=getCloudClient();
  let alive=true, serial=0, cached:LocationSnapshot|null=null, busy=false, connected=false, rerun=false;
  let expiry:ReturnType<typeof setTimeout>|undefined;
  const current=()=>alive&&account.current()&&AppState.currentState==='active';
  const channel=cloud.channel('location:'+patient+':'+randomUUID());
  const emit=(status:LiveLocationState['status'])=>{if(alive)receive({snapshot:cached,status});};
  const close=()=>{if(!alive)return;cached=null;emit('gpsSignIn');alive=false;serial++;clearTimeout(expiry);void cloud.removeChannel(channel);};
  const refresh=async()=>{
    if(!current())return;
    if(busy){rerun=true;return;}
    busy=true;const request=++serial;
    try {
      const result=await locationSnapshot(patient);
      if(current()&&request===serial){cached=newerSnapshot(cached,result);emit(connected?'gpsConnected':'gpsReconnecting');}
    } catch(error) {
      if(current()&&request===serial){
        const key=error instanceof Error?error.message:'';
        if(!['gpsForbidden','gpsSignIn','gpsFailed'].includes(key)) emit('gpsOffline');
        else {cached=null;emit(key as LiveLocationState['status']);}
      }
    } finally {busy=false;if(rerun){rerun=false;void refresh();}}
  };
  const armExpiry=async()=>{
    try {
      const {data,error}=await cloud.auth.getSession();
      if(!current())return;
      clearTimeout(expiry);
      if(error||!data.session?.expires_at){close();return;}
      const ms=data.session.expires_at*1000-Date.now();
      if(ms<=0){close();return;}
      expiry=setTimeout(close,ms);
    } catch {close();}
  };
  channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'location_signals',filter:`recipient=eq.${account.ownerId}`},()=>{
    serial++;cached=null;emit('gpsLoading');void refresh();
  }).on('postgres_changes',{event:'UPDATE',schema:'public',table:'location_signals',filter:`recipient=eq.${account.ownerId}`},()=>{
    serial++;cached=null;emit('gpsLoading');void refresh();
  }).subscribe(status=>{if(!current())return;connected=status==='SUBSCRIBED';emit(connected?'gpsConnected':'gpsReconnecting');void refresh();});
  const auth=useAuthStore.subscribe(()=>{if(!account.current())close();else void armExpiry();});
  const app=AppState.addEventListener('change',state=>{if(state!=='active')close();});
  const network=Network.addNetworkStateListener(()=>void refresh());
  const timer=setInterval(()=>void refresh(),15000);
  emit('gpsLoading');void armExpiry();void refresh();
  return ()=>{close();auth();app.remove();network.remove();clearInterval(timer);};
}
