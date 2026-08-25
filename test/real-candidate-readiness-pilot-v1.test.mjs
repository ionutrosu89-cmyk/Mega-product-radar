import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateOpportunityV4,buildOpportunityShortlistV4} from '../opportunity-engine-v4.js';

const pilot=JSON.parse(fs.readFileSync(new URL('../data/real-candidate-readiness-pilot-v1.json',import.meta.url),'utf8'));

test('current real candidates remain DISCOVERED without longitudinal trend and exact Romania evidence',()=>{
  assert.equal(pilot.candidates.length,2);
  for(const candidate of pilot.candidates){
    const out=calculateOpportunityV4(candidate);
    assert.equal(out.funnelStage,'DISCOVERED');
    assert.equal(out.status,'INCOMPLETE');
    assert.equal(out.marketOpportunityScore,null);
    assert.ok(out.blockers.includes('TREND_MISSING'));
    assert.ok(out.blockers.includes('TREND_CONFIDENCE_LOW'));
    assert.ok(out.blockers.includes('ROMANIA_GAP_INCOMPLETE'));
    assert.ok(out.blockers.includes('ROMANIA_SAMPLED_EVIDENCE_PRELIMINARY_ONLY'));
    assert.equal(out.romaniaEvidence.sampledEligible,true);
    assert.equal(out.romaniaEvidence.exactReady,false);
    assert.equal(out.purchaseAuthorized,false);
  }
});

test('sampled Romania estimate never compensates for missing trend evidence',()=>{
  const packing=calculateOpportunityV4(pilot.candidates.find(x=>x.productKey==='romania-pilot:packing-cubes-6-piece'));
  assert.equal(packing.romaniaSampledCompetition,undefined);
  assert.equal(packing.marketOpportunityScore,null);
  assert.equal(packing.funnelStage,'DISCOVERED');
});

test('current pilot shortlist has zero promising, validate, finalist or test-ready candidates',()=>{
  const out=buildOpportunityShortlistV4(pilot.candidates);
  assert.equal(out.total,2);
  assert.equal(out.promising,0);
  assert.equal(out.validate,0);
  assert.equal(out.finalists,0);
  assert.ok(out.rows.every(x=>x.funnelStage==='DISCOVERED'));
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.purchaseAuthorized,false);
});

test('pilot preserves no-sales/no-spend/no-buy policy',()=>{
  assert.equal(pilot.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(pilot.paidCallsTriggered,0);
  assert.equal(pilot.approvedSpendEur,0);
  assert.equal(pilot.purchaseAuthorized,false);
});
