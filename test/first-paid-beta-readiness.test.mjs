import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('free beta landing states the demand-validation positioning and non-guarantee',async()=>{
  const html=await readFile('beta.html','utf8');
  assert.match(html,/Beta gratuită de validare/);
  assert.match(html,/fără card/i);
  assert.match(html,/nu reprezintă garanții de vânzări ori profit/i);
  assert.match(html,/intenția de plată/i);
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

test('legal beta pages publish the confirmed operator and keep real payments blocked',async()=>{
  const terms=await readFile('terms.html','utf8');
  const privacy=await readFile('privacy.html','utf8');
  for(const page of [terms,privacy]){
    assert.match(page,/RED COMMERCE S\.R\.L\./);
    assert.match(page,/46520923/);
    assert.match(page,/office\.redcommerce@gmail\.com/);
  }
  assert.match(terms,/nu există checkout activ/i);
  assert.match(privacy,/Nu solicităm date de card/i);
});

test('beta launch checklist preserves commercial evidence gates',async()=>{
  const checklist=await readFile('BETA_LAUNCH_CHECKLIST.md','utf8');
  assert.match(checklist,/Do not alter TEST\/HOLD gates to improve conversion metrics/);
  assert.match(checklist,/Do not advertise estimated sales as verified sales/);
  assert.match(checklist,/No billing entitlement incidents/);
});
