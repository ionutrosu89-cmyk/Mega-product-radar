import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

test('beta journey routes login through profile-aware home and plan recommendation',async()=>{
  const login=await fs.readFile(new URL('../login.js',import.meta.url),'utf8');
  const home=await fs.readFile(new URL('../home.js',import.meta.url),'utf8');
  const onboarding=await fs.readFile(new URL('../onboarding.js',import.meta.url),'utf8');
  assert.match(login,/home\.html/);
  assert.match(home,/onboarding_completed/);
  assert.match(home,/resolveCommercialAccess/);
  assert.match(home,/FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3/);
  assert.match(onboarding,/ONBOARDING_COMPLETED/);
  assert.match(onboarding,/PLAN_RECOMMENDED/);
  assert.match(onboarding,/pricing\.html\?recommended=/);
  assert.match(onboarding,/href=\"home\.html\"/);
});

test('journey tracking is workspace scoped and protected by RLS',async()=>{
  const migration=await fs.readFile(new URL('../supabase/migrations/20260820_beta_journey_events.sql',import.meta.url),'utf8');
  const tracking=await fs.readFile(new URL('../journey-events.js',import.meta.url),'utf8');
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/workspace_members/);
  assert.match(migration,/user_id = auth\.uid\(\)/);
  assert.match(tracking,/ensurePersonalWorkspace/);
  assert.match(tracking,/journey_events/);
});

test('home paid-plan interest prompts respect plan rank and do not alter decision gates',async()=>{
  const home=await fs.readFile(new URL('../home.js',import.meta.url),'utf8');
  assert.match(home,/pricing\.html\?interest=RADAR/);
  assert.match(home,/pricing\.html\?interest=LAUNCH/);
  assert.match(home,/Marchează interesul/);
  assert.doesNotMatch(home,/startSubscriptionCheckout/);
  assert.doesNotMatch(home,/testBuyDecision\s*=|commercialAction\s*=|gates\s*=/);
});
