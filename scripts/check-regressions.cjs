// Every standalone regression, sequentially; keeps local database servers isolated.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const files=fs.readdirSync(__dirname).filter(f=>/^check-.*\.cjs$/.test(f)&&f!==path.basename(__filename)).sort();
const results=[];
fs.mkdirSync(path.join(__dirname,'../.expo/regressions'),{recursive:true});
for(const file of files){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(__dirname,'../.expo/regressions',file+'.log'),(result.stdout||'')+(result.stderr||'')+(result.error?String(result.error):''));
  const passed=result.status===0;results.push({file,passed});
  console.log(`${passed?'PASS':'FAIL'} ${file}`);
  if(!passed)console.log(((result.stdout||'')+(result.stderr||'')).slice(-3500));
}
fs.writeFileSync(path.join(__dirname,'../.expo/regressions/results.json'),JSON.stringify(results,null,2));
console.log(`${results.filter(r=>r.passed).length}/${results.length} regression scripts passed`);
process.exitCode=results.every(r=>r.passed)?0:1;
