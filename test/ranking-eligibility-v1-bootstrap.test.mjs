import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRankingEligibility} from '../ranking-eligibility-v1.js';

const trusted={policyDecision:'ACCEPT',evidenceClass:'VERIFIED_COMPETITOR_OBSERVATION',analysisAllowed:true,exactIdentity:true,hasProvenance:true,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0};

test('valid non-bootstrap analysis evidence can remain ranking eligible',()=>{
  const result=evaluateRankingEligibility({...trusted,sourceKey:'REVIEWED_COMPETITOR_SOURCE',surface:'LIVE_OBSERVATION'});
  assert.equal(result.trustedEligible,true);
});

test('bootstrap source cannot become ranking signal even if evidence class is spoofed as ranking-capable',()=>{
  const result=evaluateRankingEligibility({...trusted,sourceKey:'AMAZON_OPEN_DATASET_BOOTSTRAP',surface:'CATALOGUE_BOOTSTRAP'});
  assert.equal(result.trustedEligible,false);
  assert.ok(result.reasons.includes('BOOTSTRAP_SURFACE_NOT_RANKING_SIGNAL'));
});

test('unsupported verified sales claim is rejected at ranking boundary',()=>{
  const result=evaluateRankingEligibility({...trusted,salesEvidenceClass:'VERIFIED_SALES',verifiedSalesRows:0});
  assert.equal(result.trustedEligible,false);
  assert.ok(result.reasons.includes('UNSUPPORTED_VERIFIED_SALES_CLAIM'));
});
