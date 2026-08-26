import assert from 'node:assert/strict';
import test from 'node:test';
import {fromPublicSnapshot,marketObservationIdentity,normalizeMarketObservation,observationDecisionHandoff,MARKET_OBSERVATION_POLICY} from '../market-observation-v1.js';

const A='11111111-1111-4111-8111-111111111111';

test('canonical market observation keeps missing numeric values null and title display-only',()=>{
  const a=normalizeMarketObservation({canonicalProductId:A,platform:'amazon',externalId:'B00ABC1234',observedAt:'2026-08-26T10:00:00Z',title:'Old title',price:'',reviewCount:null});
  const b=normalizeMarketObservation({canonicalProductId:A,platform:'amazon',externalId:'B00ABC1234',observedAt:'2026-08-27T10:00:00Z',title:'New title'});
  assert.equal(a.ok,true);assert.equal(a.observation.price,null);assert.equal(a.observation.reviewCount,null);assert.equal(a.observation.decisionEligible,true);
  assert.equal(b.observation.canonicalProductId,a.observation.canonicalProductId);
  assert.notEqual(marketObservationIdentity(a.observation),marketObservationIdentity(b.observation));
});

test('unbound public observation stays usable as source evidence but cannot enter decision handoff',()=>{
  const n=normalizeMarketObservation({platform:'EBAY',externalId:'item-1',observedAt:'2026-08-26T10:00:00Z',sourceRank:3,reviewCount:10,price:20});
  assert.equal(n.ok,true);assert.equal(n.observation.identityStatus,'UNBOUND_SOURCE_OBSERVATION');assert.equal(n.observation.salesEvidenceClass,'NOT_VERIFIED_SALES');
  const handoff=observationDecisionHandoff(n.observation);assert.equal(handoff.ok,false);assert.deepEqual(handoff.errors,['CANONICAL_PRODUCT_ID_REQUIRED_FOR_DECISION_HANDOFF']);
});

test('public rank review and price cannot be relabeled verified sales or authorize purchase',()=>{
  const sales=normalizeMarketObservation({canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234',observedAt:'2026-08-26T10:00:00Z',reviewCount:10,sourceRank:2,salesEvidenceClass:'VERIFIED_SALES'});
  assert.equal(sales.ok,false);assert.ok(sales.errors.includes('VERIFIED_SALES_CANNOT_BE_INFERRED_FROM_MARKET_OBSERVATION'));
  const purchase=normalizeMarketObservation({canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234',observedAt:'2026-08-26T10:00:00Z',purchaseAuthorized:true});
  assert.equal(purchase.ok,false);assert.ok(purchase.errors.includes('PURCHASE_AUTHORITY_FORBIDDEN'));
  assert.match(MARKET_OBSERVATION_POLICY.sales,/NEVER_EQUAL_VERIFIED_SALES/);
});

test('invalid rank reviews rating and price fail closed instead of coercing to safe-looking zeros',()=>{
  const n=normalizeMarketObservation({platform:'AMAZON',externalId:'B00ABC1234',observedAt:'2026-08-26T10:00:00Z',sourceRank:0,reviewCount:-1,rating:6,price:-2});
  assert.equal(n.ok,false);assert.ok(n.errors.includes('SOURCE_RANK_INVALID'));assert.ok(n.errors.includes('REVIEW_COUNT_INVALID'));assert.ok(n.errors.includes('RATING_INVALID'));assert.ok(n.errors.includes('PRICE_INVALID'));
});

test('public collection snapshot bridges into unified contract without becoming canonical or sales evidence',()=>{
  const n=fromPublicSnapshot({identity:'AMAZON:B00ABC1234',platform:'AMAZON',sourceKey:'AMAZON_BEST_SELLERS',observedAt:'2026-08-26T10:00:00Z',sourceRank:5,reviewCount:100,evidenceClass:'PUBLIC_MARKET_SNAPSHOT'});
  assert.equal(n.ok,true);assert.equal(n.observation.externalId,'B00ABC1234');assert.equal(n.observation.evidenceClass,'DIRECT_OBSERVED');assert.equal(n.observation.decisionEligible,false);assert.equal(n.observation.verifiedSales,null);
});

test('same title across different external identities never auto merges',()=>{
  const a=normalizeMarketObservation({platform:'AMAZON',externalId:'A1',observedAt:'2026-08-26T10:00:00Z',title:'Same'}).observation;
  const b=normalizeMarketObservation({platform:'EBAY',externalId:'E1',observedAt:'2026-08-26T10:00:00Z',title:'Same'}).observation;
  assert.notEqual(marketObservationIdentity(a),marketObservationIdentity(b));
  assert.match(MARKET_OBSERVATION_POLICY.identity,/TITLE_NEVER_AUTO_MERGES/);
});
