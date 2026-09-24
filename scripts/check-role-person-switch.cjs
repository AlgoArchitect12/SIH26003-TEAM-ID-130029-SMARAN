const assert=require('node:assert/strict');
const {load}=require('./check-elderly-ux.cjs');
const {screen,nodes}=require('./check-privacy-recovery.cjs');
const {t}=load('src/i18n/index.ts');
const tick=()=>new Promise(setImmediate);
async function main(){
  const session=load('src/stores/patient-session.store.ts');
  const current=session.capturePatientRequest();
  session.setWorkspace('caregiver');session.setWorkspace('patient');
  assert.equal(current(),false,'patient→caregiver→patient invalidates old work');
  for(const role of ['owner','family',null]){
    let authorized=role,generation=0;const routes=[];
    const render=screen('app/account.tsx',{
      'react-native':{Platform:{OS:'android'},View:'View'},'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:r=>routes.push(r),push:r=>routes.push(r)})},
      '@/src/stores/onboarding.store':{useOnboardingStore:fn=>fn({language:'en'})},
      '@/src/cloud/config':{cloudConfig:{},AccountError:Error},
      '@/src/cloud/auth':{useAuthStore:()=>({ownerId:'A',revision:0,status:'signed-in',busy:false}),initializeAuth:async()=>{}},
      '@/src/cloud/sync':{useSyncStore:()=>({status:'current',pending:0}),refreshSyncStatus:async()=>{}},
      '@/src/services/admin.service':{useAdminStore:()=>({mode:'caregiver'})},
      '@/src/services/active-patient.service':{resolveActivePatient:async()=>({status:'ready',profile:{id:'person',preferredName:'Synthetic'}})},
      '@/src/services/profile-switching.service':{leavePatientForSelection:()=>{}},
      '@/src/services/pairing.service':{pairingService:{access:async()=>{if(!authorized)throw Error('forbidden');return authorized;}}},
      '@/src/stores/patient-session.store':{usePatientSessionStore:fn=>fn({workspace:'patient',revision:generation}),setWorkspace:()=>{},capturePatientRequest:()=>{const old=generation;return()=>old===generation;}},
    });
    render();await tick();let tree=nodes(render());
    const patient=tree.find(n=>n.props?.label===t('en','rolePatientView'));
    const care=tree.find(n=>n.props?.label===t('en','roleCaregiverView'));
    assert.equal(!!patient,role==='owner');assert.equal(!!care,!!role);
    if(care){
      care.props.onPress();await tick();assert.equal(routes.at(-1),role==='owner'?'/caregiver/home':'/caregiver/pairing');
      render();const before=routes.length;authorized=null;
      care.props.onPress();await tick();assert.equal(routes.length,before,'revocation checked again on press');
      authorized=role;render();care.props.onPress();generation+=2;await tick();
      assert.equal(routes.length,before,'A→B→A during permission check cannot navigate');
    }
    render.unmount();
  }
  console.log('PASS roles: server-owned vs granted vs denied options, membership view routing, revocation on press and stale A→B→A navigation; actual workspace revision guards.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
