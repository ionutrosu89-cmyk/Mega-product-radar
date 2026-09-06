import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {categoryPreferenceScore,DEFAULT_SELLER_PREFERENCES} from '../seller-preferences.js';

test('seller preference matching boosts preferred categories only',()=>{
  assert.equal(categoryPreferenceScore({name:'Desk headphone hanger',cat:'Office'},{categories:['office']}),15);
  assert.equal(categoryPreferenceScore({name:'Desk headphone hanger',cat:'Office'},{categories:['pet']}),0);
  assert.equal(DEFAULT_SELLER_PREFERENCES.risk_profile,'BALANCED');
  assert.equal(DEFAULT_SELLER_PREFERENCES.import_vat_treatment,'UNKNOWN');
});

test('onboarding persists business profile behind workspace RLS',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260820_seller_preferences.sql',import.meta.url),'utf8');
  assert.match(sql,/seller_preferences/);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/is_workspace_member\(workspace_id\)/);
  for(const field of ['monthly_budget_ron','categories','marketplaces','risk_profile','goal','onboarding_completed'])assert.match(sql,new RegExp(field));
});

test('Launch personalization never bypasses commercial money gates',async()=>{
  const js=await fs.readFile(new URL('../commercial-launch.js',import.meta.url),'utf8');
  assert.match(js,/\['TEST','BUY'\]\.includes\(d\.commercialAction\)/);
  assert.match(js,/d\.landedCostConfirmed/);
  assert.match(js,/d\.testBudget/);
  assert.match(js,/categoryPreferenceScore/);
  assert.doesNotMatch(js,/commercialAction\s*=\s*['"]TEST/);
});


test('seller import VAT treatment is explicit and defaults fail-closed',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260906_seller_import_vat_treatment.sql',import.meta.url),'utf8');
  const prefs=await fs.readFile(new URL('../seller-preferences.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../onboarding.html',import.meta.url),'utf8');
  assert.match(sql,/import_vat_treatment/);
  assert.match(sql,/UNKNOWN/);
  assert.match(sql,/RECOVERABLE/);
  assert.match(sql,/NON_RECOVERABLE/);
  assert.match(prefs,/import_vat_treatment:'UNKNOWN'/);
  assert.match(html,/id="importVatTreatment"/);
});
