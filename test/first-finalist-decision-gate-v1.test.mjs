import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFirstFinalistDecision} from '../first-finalist-decision-gate-v1.js';

const trend=confirmed=>({rows:[{externalId:'B00INKVS82',status:confirmed?'CONFIRMED_ACCELERATION':'RANK_FLAT',confirmedAcceleration:confirmed}]});
const romania=confirmed=>({candidateAsin:'B00INKVS82',promotion:{exactRomaniaGapConfirmed:confirmed,promotionEligible:confirmed}});
const importability=(status='IMPORTABILITY_PASS',asin='B00INKVS82')=>({candidateAsin:asin,status,importabilityPassed:status==='IMPORTABILITY_PASS',supplierSourcingEligible:['IMPORTABILITY_PASS','IMPORTABILITY_REVIEW'].includes(status)});
const supplierFor=(asin,verified=true)=>({packets:[{candidateAsin:asin,manuallyVerified:verified}]});
const economicsFor=(asin,confirmed=true)=>({products:[{candidateAsin:asin,landedEconomicsConfirmed:confirmed}]});

test('blocks current candidate when Romania gap is unresolved',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(false),importabilityEvidence:importability(),supplierEvidence:{},economicsEvidence:{}});
  assert.equal(r.status,'BLOCKED_BEFORE_VALIDATE');
  assert.equal(r.validateEligible,false);
  assert.equal(r.finalistEvidenceReady,false);
  assert.equal(r.purchaseAuthorized,false);
  assert.deepEqual(r.blockers,['EXACT_ROMANIA_GAP_MISSING','CANDIDATE_MANUALLY_VERIFIED_SUPPLIER_MISSING','CANDIDATE_CONFIRMED_LANDED_ECONOMICS_MISSING']);
});

test('validate can be reached but supplier sourcing stays blocked when importability is unknown',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),importabilityEvidence:importability('UNKNOWN_FAIL_CLOSED'),supplierEvidence:{},economicsEvidence:{}});
  assert.equal(r.status,'VALIDATE_READY_IMPORTABILITY_BLOCKED');
  assert.equal(r.validateEligible,true);
  assert.equal(r.supplierSourcingEligible,false);
  assert.equal(r.finalistEvidenceReady,false);
  assert.ok(r.blockers.includes('CANDIDATE_IMPORTABILITY_PASS_MISSING'));
});

test('importability review may allow supplier reconnaissance but not FINALIST',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),importabilityEvidence:importability('IMPORTABILITY_REVIEW'),supplierEvidence:supplierFor('B00INKVS82'),economicsEvidence:economicsFor('B00INKVS82')});
  assert.equal(r.supplierSourcingEligible,true);
  assert.equal(r.gates.importabilityPassed,false);
  assert.equal(r.finalistEvidenceReady,false);
});

test('finalist evidence requires strict importability pass plus candidate-specific supplier and landed economics',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),importabilityEvidence:importability(),supplierEvidence:supplierFor('B00INKVS82'),economicsEvidence:economicsFor('B00INKVS82')});
  assert.equal(r.status,'FINALIST_EVIDENCE_READY');
  assert.equal(r.finalistEvidenceReady,true);
  assert.equal(r.gatesTotal,5);
  assert.equal(r.testReady,false);
  assert.equal(r.purchaseAuthorized,false);
});

test('global supplier and economics counts cannot satisfy candidate gates',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),importabilityEvidence:importability(),supplierEvidence:{productsWithManuallyVerifiedSupplier:5},economicsEvidence:{productsWithConfirmedLandedEconomics:5}});
  assert.equal(r.gates.supplierVerified,false); assert.equal(r.gates.economicsConfirmed,false); assert.equal(r.finalistEvidenceReady,false);
});

test('supplier, economics or importability from another product cannot validate candidate',()=>{
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:romania(true),importabilityEvidence:importability('IMPORTABILITY_PASS','OTHER'),supplierEvidence:supplierFor('OTHER'),economicsEvidence:economicsFor('OTHER')});
  assert.equal(r.gates.importabilityPassed,false); assert.equal(r.gates.supplierVerified,false); assert.equal(r.gates.economicsConfirmed,false); assert.equal(r.finalistEvidenceReady,false);
});

test('same ASIN is required for Romania evidence',()=>{
  const wrong={candidateAsin:'OTHER',promotion:{exactRomaniaGapConfirmed:true,promotionEligible:true}};
  const r=buildFirstFinalistDecision({candidateAsin:'B00INKVS82',trendFusion:trend(true),romaniaEvidence:wrong,importabilityEvidence:importability(),supplierEvidence:supplierFor('B00INKVS82'),economicsEvidence:economicsFor('B00INKVS82')});
  assert.equal(r.gates.romaniaGapConfirmed,false); assert.equal(r.finalistEvidenceReady,false);
});
