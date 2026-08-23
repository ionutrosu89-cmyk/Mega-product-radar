import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('Launch Academy ships as a Launch-only customer journey',()=>{
  const html=read('academy.html');
  const js=read('academy.js');
  const launch=read('commercial-launch.html');
  assert.match(html,/Launch Academy/);
  for(let i=1;i<=10;i++) assert.match(html,new RegExp(`MODUL ${i}`));
  assert.match(js,/LAUNCH_PLAN/);
  assert.match(js,/resolveCommercialAccess/);
  assert.match(launch,/href="academy\.html"/);
  assert.match(launch,/Launch Academy · inclusă/);
});

test('Netlify build explicitly includes Academy assets',()=>{
  const build=read('scripts/build-site.mjs');
  assert.match(build,/'academy\.html'/);
  assert.match(build,/'academy\.js'/);
});

test('V3 growth policy is staged and never auto-promotes large candidate targets',()=>{
  const sql=read('supabase/migrations/20260823_data_platform_v3_growth_policy.sql');
  for(const target of ['100','1000','5000','10000']) assert.match(sql,new RegExp(`\\(${target=== '100'?'0':target==='1000'?'1':target==='5000'?'2':'3'},${target},`));
  assert.match(sql,/requires_manual_promotion boolean not null default true/);
  assert.match(sql,/\(0,100,10,50,0\.50,true,true/);
  assert.match(sql,/\(1,1000,25,60,0\.35,true,false/);
  assert.match(sql,/\(2,5000,50,65,0\.25,true,false/);
  assert.match(sql,/\(3,10000,80,70,0\.20,true,false/);
});