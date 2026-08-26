import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptRomaniaManualEvidenceV2} from '../romania-manual-evidence-adapter-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const evidence=JSON.parse(fs.readFileSync(new URL('../data/romania-binder-manual-exact-evidence-b00inkvs82-v1.json',import.meta.url),'utf8'));

test('existing binder evidence remains REVIEW because eMAG exact count is unresolved',()=>{
  const r=adaptRomaniaManualEvidenceV2(evidence,{canonicalProductId:A,localDemandEvidence:{score:75,evidenceClass:'DIRECT_OBSERVED'}});
  assert.equal(r.overallGateStatus,'REVIEW');
  assert.ok(r.reasons.includes('AT_LEAST_ONE_ROMANIA_SURFACE_UNRESOLVED'));
  assert.equal(r.exactRomaniaGapConfirmed,false);
  assert.equal(r.promotionEligible,false);
});

test('Trendyol zero comparable evidence stays platform-surface scoped',()=>{
  const r=adaptRomaniaManualEvidenceV2(evidence,{canonicalProductId:A,localDemandEvidence:{score:75,evidenceClass:'DIRECT_OBSERVED'}});
  const t=r.analyses.find(x=>x.platform==='TRENDYOL');
  assert.ok(t);
  assert.equal(t.comparableListingCount,0);
  assert.equal(t.coverageClass,'EXHAUSTIVE_QUERY');
  assert.equal(t.marketWideClaimAllowed,false);
});

test('eMAG unresolved count maps to ESTIMATED rather than fake zero',()=>{
  const r=adaptRomaniaManualEvidenceV2(evidence,{canonicalProductId:A,localDemandEvidence:{score:75,evidenceClass:'DIRECT_OBSERVED'}});
  const e=r.analyses.find(x=>x.platform==='EMAG');
  assert.ok(e);
  assert.equal(e.coverageClass,'ESTIMATED');
  assert.equal(e.comparableListingCount,0);
  assert.equal(e.gateStatus,'REVIEW');
  assert.ok(e.reasons.includes('ESTIMATED_COVERAGE_CANNOT_PROVE_GAP'));
});

test('without canonical identity the manual evidence cannot become decision eligible',()=>{
  const r=adaptRomaniaManualEvidenceV2(evidence,{canonicalProductId:null,localDemandEvidence:{score:75,evidenceClass:'DIRECT_OBSERVED'}});
  assert.equal(r.overallGateStatus,'UNKNOWN');
  assert.equal(r.purchaseAuthorized,false);
});
