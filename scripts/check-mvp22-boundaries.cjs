const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const baseline = file => execFileSync('git',['show','58e7938:'+file],{encoding:'utf8'});
const authorized = new Set([
  'app.json', // Exact reviewed plugin changes are checked below, not exempted.
  'src/db/migrations/014_patient_location.ts', // Frozen historical migration, not active GPS functionality.
  'src/db/migrations/013_report_delivery.ts', // MVP-28: forward migration for report delivery
  'src/db/migrations/012_three_cognitive_games.ts', // MVP-25: extend only cognitive game constraints.
  'src/db/migrations/011_sync_consent.ts', // MVP-24: explicit, pausable backup consent; historical migrations stay frozen.
  // MVP-23 explicitly adds these patient-scoped entities and their source contracts.
  'src/db/migrations/010_care_circle_reports.ts','src/db/repositories/care-circle.repository.ts',
  'src/caregiver/care-circle.ts','src/caregiver/reports.ts','src/caregiver/report-presentation.ts',
  'src/cloud/care-sync-columns.ts','src/i18n/care-circle-strings.ts',
  'src/cloud/sync-status.ts', // Pure Sync Status state derivation; no network access.
  'src/cloud/location-sync-columns.ts', // Historical sync schema retained after active GPS removal.
  'src/services/care-circle.service.ts','src/services/reports.service.ts','src/services/report-pdf.service.ts',
  'src/db/migrations/009_extra_cognitive_games.ts', // Explicit forward-migration authorization for the two extra games.
  'package.json','package-lock.json','src/db/migrations/index.ts','src/db/migrations/008_auth_sync.ts',
  'src/db/repositories/sync.repository.ts','src/services/secure-storage.service.ts',
  'src/i18n/account-strings.ts','src/i18n/strings.ts','src/i18n/regional-strings.ts','src/i18n/ux-strings.ts',
  'src/cloud/auth.ts','src/cloud/auth-storage.ts','src/cloud/config.ts','src/cloud/native-crypto.ts',
  'src/cloud/sync.ts','src/cloud/sync-contract.ts','src/cloud/online-ai.ts','app/patient/menu.tsx',
  'app/onboarding/accessibility.tsx', 'app/onboarding/complete.tsx', 'app/onboarding/language.tsx',
  'app/onboarding/profile.tsx', 'app/onboarding/region.tsx', 'app/onboarding/role.tsx',
  'components/onboarding/finish-onboarding.tsx', 'components/onboarding/onboarding-screen.tsx',
  'src/ai/adaptive-engine.ts', 'src/games/routine-recall.ts', 'src/i18n/index.ts',
  'src/my-day/types.ts', 'src/my-home/content.ts', 'src/services/profile-switching.service.ts',
  'src/stores/onboarding.store.ts', 'src/stores/patient-session.store.ts',
  'app/onboarding/caregiver.tsx', 'src/i18n/routine-strings.ts', 'src/i18n/stabilization-strings.ts',
  'src/services/onboarding-recovery.service.ts'
]);
function checkMvp22Boundaries() {
  // Report email and connectivity-driven sync are permanent, separately exercised product paths.
  const additions={'@supabase/supabase-js':'2.116.0','react-native-url-polyfill':'4.0.0','expo-crypto':'~15.0.9','expo-print':'~15.0.8','expo-sharing':'~14.0.8',
    'expo-mail-composer':'~15.0.8','expo-network':'~8.0.8'};
  const before=JSON.parse(baseline('package.json')),after=JSON.parse(fs.readFileSync('package.json','utf8'));
  for(const [key,version] of Object.entries(additions)){assert.equal(after.dependencies[key],version);delete after.dependencies[key];}
  assert.deepEqual(after,before,'only explicitly verified auth, report and sync dependencies change');
  const oldLock=JSON.parse(baseline('package-lock.json')),lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  for(const [key,value] of Object.entries(oldLock.packages)){
    if(key===''){
      const current=structuredClone(lock.packages['']);for(const key of Object.keys(additions))delete current.dependencies[key];
      assert.deepEqual(current,value,'lock root preserves previous contract');
    }else assert.deepEqual(lock.packages[key],value,'no unrelated lock upgrade: '+key);
  }
  for(const file of fs.readdirSync('src/db/migrations').filter(file=>/^00[1-7]_/.test(file))){
    const name='src/db/migrations/'+file;
    assert.equal(fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n'),baseline(name).replace(/\r\n/g,'\n'),name+' unchanged');
  }
  for(const file of fs.readdirSync('src/db/migrations').filter(file=>/^\d{3}_/.test(file))){
    const name='src/db/migrations/'+file;
    const released=execFileSync('git',['show','1dfccf1:'+name],{encoding:'utf8'});
    assert.equal(fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n'),released.replace(/\r\n/g,'\n'),name+' preserves release history');
  }
  const expectedConfig=JSON.parse(baseline('app.json'));
  expectedConfig.expo.plugins=expectedConfig.expo.plugins.map(plugin=>plugin==='expo-notifications'
    ? ['expo-notifications',{sounds:['./assets/sounds/smaran-alarm.wav']}] : plugin);
  expectedConfig.expo.plugins.push('expo-mail-composer');
  assert.deepEqual(JSON.parse(fs.readFileSync('app.json','utf8')),expectedConfig,'only bundled reminder sound and report email plugins change');
  for(const file of ['eas.json','plugins/with-private-backup.cjs','src/db/client.web.ts']){
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),baseline(file).replace(/\r\n/g,'\n'),file+' unchanged');
  }
}
module.exports={authorized,checkMvp22Boundaries};
