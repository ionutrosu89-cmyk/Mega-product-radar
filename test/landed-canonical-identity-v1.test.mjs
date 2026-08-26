import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('landed economics uses canonical commercial identity and blocks legacy confirmation',async()=>{
  const js=await fs.readFile(new URL('../landed-cost.js',import.meta.url),'utf8');
  assert.match(js,/commercial-identity-v1\.js/);
  assert.match(js,/readCommercialRecord/);
  assert.match(js,/writeCanonicalCommercialRecord/);
  assert.match(js,/canonicalProductId/);
  assert.match(js,/decisionEligible/);
  assert.match(js,/IDENTITY_BLOCKED/);
  assert.match(js,/Economics Gate este blocat până când produsul are canonicalProductId/);
  assert.doesNotMatch(js,/all\[keyOf\(name\)\]=clean/);
});

test('confirmed landed economics requires both canonical identity and complete evidence',async()=>{
  const js=await fs.readFile(new URL('../landed-cost.js',import.meta.url),'utf8');
  assert.match(js,/confirmed:base\.decisionEligible===true&&base\.confirmationRequested&&evidence\.readyForManualConfirmation===true/);
  assert.match(js,/clean\.confirmed=clean\.decisionEligible&&clean\.confirmationRequested&&clean\.evidence\?\.readyForManualConfirmation===true/);
  assert.match(js,/document\.querySelector\('#lcConfirmed'\)\.disabled=!r\.decisionEligible/);
});

test('legacy landed records remain compatibility-only and non decision eligible',async()=>{
  const js=await fs.readFile(new URL('../landed-cost.js',import.meta.url),'utf8');
  assert.match(js,/LEGACY_LABEL_ONLY/);
  assert.match(js,/clean\.confirmed=false/);
  assert.match(js,/clean\.decisionEligible=false/);
  assert.match(js,/attachCanonicalCommercialIdentity\(clean,identity\)/);
});
