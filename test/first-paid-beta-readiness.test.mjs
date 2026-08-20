import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('paid beta landing states the decision positioning and non-guarantee',async()=>{
  const html=await readFile('beta.html','utf8');
  assert.match(html,/Ce merită să testezi în România/);
  assert.match(html,/VERIFIED \/ ESTIMATED \/ DERIVED/);
  assert.match(html,/nu garantează vânzări, profit sau succes comercial/i);
});

test('pricing links terms privacy and beta feedback',async()=>{
  const html=await readFile('pricing.html','utf8');
  assert.match(html,/href="terms\.html"/);
  assert.match(html,/href="privacy\.html"/);
  assert.match(html,/href="beta-feedback\.html"/);
});

test('beta feedback is workspace scoped and protected with RLS',async()=>{
  const migration=await readFile('supabase/migrations/20260820_beta_feedback.sql','utf8');
  const client=await readFile('beta-feedback.js','utf8');
  assert.match(migration,/alter table public\.beta_feedback enable row level security/i);
  assert.match(migration,/workspace_members/);
  assert.match(migration,/user_id = auth\.uid\(\)/);
  assert.match(client,/ensurePersonalWorkspace/);
  assert.match(client,/from\('beta_feedback'\)\.insert/);
});

test('legal beta pages expose explicit pre-public-launch blockers instead of pretending final compliance',async()=>{
  const terms=await readFile('terms.html','utf8');
  const privacy=await readFile('privacy.html','utf8');
  assert.match(terms,/datele juridice complete ale operatorului/i);
  assert.match(terms,/nu reprezintă consultanță juridică/i);
  assert.match(privacy,/identitatea și datele de contact ale operatorului/i);
  assert.match(privacy,/nu reprezintă consultanță juridică/i);
});

test('beta launch checklist preserves commercial evidence gates',async()=>{
  const checklist=await readFile('BETA_LAUNCH_CHECKLIST.md','utf8');
  assert.match(checklist,/Do not alter TEST\/HOLD gates to improve conversion metrics/);
  assert.match(checklist,/Do not advertise estimated sales as verified sales/);
  assert.match(checklist,/No billing entitlement incidents/);
});
