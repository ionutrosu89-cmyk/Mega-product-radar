import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFirstFinalistDecision} from '../first-finalist-decision-gate-v1.js';

const trend=confirmed=>({rows:[{externalId:'B00INKVS82',status:confirmed?'CONFIRMED_ACCELERATION':'RANK_FLAT',confirmedAcceleration:confirmed}]});
const romania=confirmed=>({candidateAsin:'B00INKVS82',promotion:{exactRomaniaGapConfirmed:confirmed,promotionEligible:confirmed}});

test('blocks current candidate when Romania gap is unresolved',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(false),supplierEvidence:{productsWithManuallyVerifiedSupplier:0},economicsEvidence:{productsWithConfirmedLandedEconomics:0}});
  assert.equal(r.status,'BLOCKED_BEFORE_VALIDATE');
  assert.equal(r.validateEligible,false);
  assert.equal(r.finalistEvidenceReady,false);
  assert.equal(r.purchaseAuthorized,false);
  assert.deepEqual(r.blockers,['EXACT_ROMANIA_GAP_MISSING','MANUALLY_VERIFIED_SUPPLIER_MISSING','CONFIRMED_LANDED_ECONOMICS_MISSING']);
});

test('allows validate support only after trend and exact Romania gap both pass',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),supplierEvidence:{productsWithManuallyVerifiedSupplier:0},economicsEvidence:{productsWithConfirmedLandedEconomics:0}});
  assert.equal(r.status,'VALIDATE_SUPPORT_READY');
  assert.equal(r.validateEligible,true);
  assert.equal(r.finalistEvidenceReady,false);
  assert.equal(r.testReady,false);
});

test('finalist evidence requires supplier and landed economics but never authorizes purchase',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),supplierEvidence:{productsWithManuallyVerifiedSupplier:1},economicsEvidence:{productsWithConfirmedLandedEconomics:1}});
  assert.equal(r.status,'FINALIST_EVIDENCE_READY');
  assert.equal(r.finalistEvidenceReady,true);
  assert.equal(r.testReady,false);
  assert.equal(r.purchaseAuthorized,false);
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('same ASIN is required for Romania evidence',()=>{
  const wrong={candidateAsin:'OTHER',promotion:{exactRomaniaGapConfirmed:true,promotionEligible:true}};
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:wrong,supplierEvidence:{productsWithManuallyVerifiedSupplier:1},economicsEvidence:{productsWithConfirmedLandedEconomics:1}});
  assert.equal(r.gates.romaniaGapConfirmed,false);
  assert.equal(r.finalistEvidenceReady,false);
});
