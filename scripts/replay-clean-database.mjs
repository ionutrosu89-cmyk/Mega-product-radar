import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// Fixed local Docker target: deliberately accepts no remote database URL.
const container='supabase_db_mpr-clean-replay';
const sql=text=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:text,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
const report={startedAt:new Date().toISOString(),target:'EPHEMERAL_LOCAL_SUPABASE',productionContact:false,files:[],tests:[],status:'RUNNING'};
await fs.mkdir('artifacts',{recursive:true});
try{
 if(sql("select to_regclass('public.workspaces') is null;").trim()!=='t')throw new Error('DATABASE_NOT_CLEAN');
 const files=(await fs.readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort();
 // Legacy migrations share day-only prefixes: apply the inbox before its guard.
 // Otherwise the base RPC would overwrite the stricter comparability RPC.
 const guard='20260831_romania_comparability_guard_v2.sql';
 const inbox='20260831_romania_evidence_inbox.sql';
 if(files.indexOf(guard)<files.indexOf(inbox)){
  files.splice(files.indexOf(guard),1);
  files.splice(files.indexOf(inbox)+1,0,guard);
 }
 for(const name of files){
  const text=await fs.readFile(`supabase/migrations/${name}`,'utf8');
  const row={name,sha256:createHash('sha256').update(text).digest('hex'),status:'RUNNING'};report.files.push(row);
  try{sql(text);row.status='PASS';console.log(`PASS ${name}`);}catch(e){row.status='FAIL';row.error=String(e.stderr||e.message).slice(-8000);throw e;}
 }
 for(const name of (await fs.readdir('supabase/tests')).filter(x=>x.endsWith('.sql')).sort()){
  const row={name,status:'RUNNING'};report.tests.push(row);
  try{sql(await fs.readFile(`supabase/tests/${name}`,'utf8'));row.status='PASS';console.log(`PASS ${name}`);}catch(e){row.status='FAIL';row.error=String(e.stderr||e.message).slice(-8000);throw e;}
 }
 report.status='PASS';
 report.migrationCount=files.length;
}catch(e){report.status='FAIL';report.error=String(e.stderr||e.message).slice(-8000);process.exitCode=1;console.error(report.error);}
finally{report.finishedAt=new Date().toISOString();await fs.writeFile('artifacts/clean-database-replay.json',JSON.stringify(report,null,2)+'\n');}
