import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareSandboxBundle,SANDBOX_HANDLERS} from '../scripts/prepare-sandbox-bundle.mjs';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mpr-sandbox-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const write=async(name,content)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),content);};
 for(const n of SANDBOX_HANDLERS)await write('netlify/functions/'+n+'.mjs',"import '../../saas-config.js'; export default ()=>{};");
 await write('saas-config.js',"export const SAAS_CONFIG={supabaseUrl:'https://production.supabase.co',supabaseAnonKey:'eyJabc.def.ghi'};");
 await write('netlify/edge-functions/sandbox-perimeter.js',"import '../../sandbox-perimeter-policy.mjs';export default ()=>{};");
 await write('sandbox-perimeter-policy.mjs','export const policy=true;');
 await write('package.json','{"type":"module"}');await write('package-lock.json','{}');
 await write('netlify/functions/scan-schedule.mjs','secret scheduler');
 await write('.env','secret');await write('products.json','private products');await write('index.html','UI');
 return {root,write};
}
test('packages only billing entrypoints, dependencies and active perimeter; strips production defaults',async t=>{
 const {root}=await fixture(t),target=path.join(root,'bundle');
 const m=await prepareSandboxBundle(root,target);
 assert.equal(m.activated,false);
 assert.deepEqual(await fs.readdir(path.join(target,'netlify/functions')),SANDBOX_HANDLERS.map(x=>x+'.mjs').sort());
 for(const f of ['.env','products.json','index.html'])await assert.rejects(fs.access(path.join(target,f)));
 const c=await fs.readFile(path.join(target,'saas-config.js'),'utf8');
 assert.ok(!c.includes('production.supabase.co'));assert.ok(!c.includes('eyJabc'));
 assert.match(await fs.readFile(path.join(target,'netlify.toml'),'utf8'),/path = "\/\*"/);
 assert.deepEqual(await fs.readdir(path.join(target,'public')),['robots.txt']);
 await assert.rejects(prepareSandboxBundle(root,target),{code:'EEXIST'});
});
test('refuses outputs outside workspace and imports escaping source root',async t=>{
 const {root,write}=await fixture(t);
 await assert.rejects(prepareSandboxBundle(root,path.dirname(root)),/OUTSIDE_WORKSPACE/);
 await write('netlify/functions/billing-webhook.mjs',"import '../../../outside.mjs';");
 await assert.rejects(prepareSandboxBundle(root,path.join(root,'bundle')),/IMPORT_OUTSIDE_WORKSPACE/);
});
test('refuses unresolved dynamic imports instead of silently omitting dependencies',async t=>{
 const {root,write}=await fixture(t);
 await write('netlify/functions/billing-webhook.mjs','const module=import(variable);');
 await assert.rejects(prepareSandboxBundle(root,path.join(root,'bundle')),/DYNAMIC_IMPORT_REVIEW_REQUIRED/);
});
