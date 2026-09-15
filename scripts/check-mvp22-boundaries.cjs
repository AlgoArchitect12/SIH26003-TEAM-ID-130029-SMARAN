const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const baseline = file => execFileSync('git',['show','58e7938:'+file],{encoding:'utf8'});
const authorized = new Set([
  // MVP-23 explicitly adds these patient-scoped entities and their source contracts.
  'src/db/migrations/010_care_circle_reports.ts','src/db/repositories/care-circle.repository.ts',
  'src/caregiver/care-circle.ts','src/caregiver/reports.ts','src/caregiver/report-presentation.ts',
  'src/cloud/care-sync-columns.ts','src/i18n/care-circle-strings.ts',
  'src/services/care-circle.service.ts','src/services/reports.service.ts','src/services/report-pdf.service.ts',
  'src/db/migrations/009_extra_cognitive_games.ts', // Explicit forward-migration authorization for the two extra games.
  'package.json','package-lock.json','src/db/migrations/index.ts','src/db/migrations/008_auth_sync.ts',
  'src/db/repositories/sync.repository.ts','src/services/secure-storage.service.ts',
  'src/i18n/account-strings.ts','src/i18n/strings.ts','src/i18n/regional-strings.ts','src/i18n/ux-strings.ts',
  'src/cloud/auth.ts','src/cloud/auth-storage.ts','src/cloud/config.ts','src/cloud/native-crypto.ts',
  'src/cloud/sync.ts','src/cloud/sync-contract.ts','src/cloud/online-ai.ts','app/patient/menu.tsx',
]);
function checkMvp22Boundaries() {
  const additions={'@supabase/supabase-js':'2.116.0','react-native-url-polyfill':'4.0.0','expo-crypto':'~15.0.9','expo-print':'~15.0.8','expo-sharing':'~14.0.8'};
  const before=JSON.parse(baseline('package.json')),after=JSON.parse(fs.readFileSync('package.json','utf8'));
  for(const [key,version] of Object.entries(additions)){assert.equal(after.dependencies[key],version);delete after.dependencies[key];}
  assert.deepEqual(after,before,'only the minimum verified auth dependencies change');
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
  for(const file of ['app.json','eas.json','plugins/with-private-backup.cjs','src/db/client.web.ts']){
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),baseline(file).replace(/\r\n/g,'\n'),file+' unchanged');
  }
}
module.exports={authorized,checkMvp22Boundaries};
