import assert from 'node:assert/strict';
import test from 'node:test';
import {summarize,REQUIRED_CHECKS,createLaunchReadinessHandler} from '../netlify/functions/launch-readiness.mjs';
import {readFile} from 'node:fs/promises';

test('missing manual launch checks remain BLOCKED',()=>{
  const s=summarize([]);assert.equal(s.total,REQUIRED_CHECKS.length);assert.equal(s.passed,0);assert.equal(s.allManualPassed,false);assert.ok(s.checks.every(x=>x.status==='BLOCKED'));
});

test('all manual launch checks require explicit PASS rows',()=>{
  const rows=REQUIRED_CHECKS.map(check_code=>({check_code,status:'PASS',evidence_note:'verified evidence'}));const s=summarize(rows);assert.equal(s.passed,REQUIRED_CHECKS.length);assert.equal(s.allManualPassed,true);
});

test('launch readiness admin endpoint rejects anonymous access',async()=>{
  const handler=createLaunchReadinessHandler({env:{},fetch:async()=>new Response(null,{status:500})});const response=await handler(new Request('https://radar.example/api/internal/launch-readiness'));assert.equal(response.status,401);
});

test('manual PASS requires an evidence note and registry remains service-role only',async()=>{
  const source=await readFile(new URL('../netlify/functions/launch-readiness.mjs',import.meta.url),'utf8');const sql=await readFile(new URL('../supabase/migrations/20260822_launch_readiness_checks.sql',import.meta.url),'utf8');assert.match(source,/Evidence note required before PASS/);assert.match(sql,/enable row level security/i);assert.doesNotMatch(sql,/create policy/i);
});

test('public launch UI requires both live billing and all manual gates',async()=>{
  const js=await readFile(new URL('../launch-readiness.js',import.meta.url),'utf8');assert.match(js,/manual\.allManualPassed&&billing\.publicLaunchBillingReady/);assert.match(js,/PUBLIC LAUNCH BLOCKED/);
});
