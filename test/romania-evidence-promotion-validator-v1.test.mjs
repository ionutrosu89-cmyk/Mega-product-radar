import assert from 'node:assert/strict';
import test from 'node:test';
import {validateRomaniaEvidencePromotion,validateRomaniaEvidenceBatch} from '../romania-evidence-promotion-validator-v1.js';

const q={nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET'};
const at='2026-08-25T06:00:00Z';
const base=(platform,count)=>({platform,comparabilityKey:'PACKING_CUBES_SET',scope:'MARKET_WIDE',listingCount:count,listingCountLowerBound:null,observedAt:at,manualReviewed:true,comparableScopeConfirmed:true,salesEvidenceClass:'NOT_VERIFIED_SALES'});

test('exact comparable eMAG + Trendyol evidence is promotable',()=>{
  const x=validateRomaniaEvidencePromotion({queueItem:q,emagProbe:base('EMAG',42),trendyolEvidence:base('TRENDYOL',58)});
  assert.equal(x.promotable,true);
  assert.equal(x.status,'PROMOTABLE_TO_COMPARABLE_LOCAL_EVIDENCE');
  assert.deepEqual(x.exactCompetition,{EMAG:42,TRENDYOL:58});
  assert.equal(x.purchaseAuthorized,false);
});

test('Trendyol 656+ lower bound is never promoted as exact competition',()=>{
  const trendyol={...base('TRENDYOL',null),listingCountLowerBound:656};
  const x=validateRomaniaEvidencePromotion({queueItem:q,emagProbe:base('EMAG',40),trendyolEvidence:trendyol});
  assert.equal(x.promotable,false);
  assert.ok(x.blockers.includes('TRENDYOL_LOWER_BOUND_NOT_EXACT'));
});

test('scope mismatch or missing comparability confirmation fails closed',()=>{
  const emag={...base('EMAG',40),comparabilityKey:'BROAD_TRAVEL_ORGANIZERS'};
  const trendyol={...base('TRENDYOL',58),comparableScopeConfirmed:false};
  const x=validateRomaniaEvidencePromotion({queueItem:q,emagProbe:emag,trendyolEvidence:trendyol});
  assert.equal(x.promotable,false);
  assert.ok(x.blockers.includes('EMAG_COMPARABILITY_KEY_MISMATCH'));
  assert.ok(x.blockers.includes('TRENDYOL_SCOPE_NOT_CONFIRMED'));
});

test('seller-scoped evidence is rejected even with exact counts',()=>{
  const emag={...base('EMAG',40),scope:'AUTHORIZED_SELLER_ACCOUNT_ONLY',sellerScoped:true};
  const x=validateRomaniaEvidencePromotion({queueItem:q,emagProbe:emag,trendyolEvidence:base('TRENDYOL',58)});
  assert.equal(x.promotable,false);
  assert.ok(x.blockers.includes('EMAG_NOT_MARKET_WIDE'));
  assert.ok(x.blockers.includes('EMAG_SCOPED_DATA_REJECTED'));
});

test('batch summary remains decision-only and zero-spend',()=>{
  const x=validateRomaniaEvidenceBatch({queueItems:[q],evidenceByNiche:{'travel:packing-cubes':{EMAG:base('EMAG',40),TRENDYOL:base('TRENDYOL',58)}}});
  assert.equal(x.promotable,1);
  assert.equal(x.blocked,0);
  assert.equal(x.paidCallsTriggered,0);
  assert.equal(x.purchaseAuthorized,false);
});
