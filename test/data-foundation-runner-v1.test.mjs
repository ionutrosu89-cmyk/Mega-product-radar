import assert from 'node:assert/strict';
import test from 'node:test';
import {runDataFoundationV1} from '../data-foundation-runner-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const products=[{canonicalProductId:A,title:'Binder',category:'Office Products'}];
const aliases=[{canonicalProductId:A,platform:'AMAZON',externalId:'B00INKVS82'}];

test('runner adapts real public ranking data into one canonical pipeline',()=>{
  const r=runDataFoundationV1({products,aliases,now:'2026-08-27T10:00:00Z',datasets:[{type:'AMAZON_PUBLIC_RANKING',dataset:{generatedAt:'2026-08-26T10:00:00Z',categoryKey:'amazon:office-products:best-sellers',categoryLabel:'Office Products',rankPairs:[[7,'B00INKVS82']]}}]});
  assert.equal(r.history.length,1);assert.equal(r.history[0].canonicalProductId,A);assert.equal(r.universe.metrics.boundObservations,1);assert.equal(r.schedule.dueCount,1);assert.equal(r.quality.status,'HOLD_SCALE');
  assert.equal(r.automaticPaidExpansionAllowed,false);assert.equal(r.paidCallsTriggered,0);assert.equal(r.purchaseAuthorized,false);
});

test('runner preserves unbound data as non-decision evidence',()=>{
  const r=runDataFoundationV1({products,aliases:[],now:'2026-08-27T10:00:00Z',datasets:[{type:'AMAZON_PUBLIC_RANKING',dataset:{generatedAt:'2026-08-26T10:00:00Z',rankPairs:[[1,'B00INKVS82']]}}]});
  assert.equal(r.history[0].canonicalProductId,null);assert.equal(r.universe.metrics.unboundObservations,1);assert.equal(r.schedule.dueItems[0].decisionEligible,false);
});

test('unsupported datasets fail closed instead of being silently interpreted',()=>{
  const r=runDataFoundationV1({products,aliases,datasets:[{type:'REVIEW_DELTA_FEED',dataset:{}}],now:'2026-08-26T10:00:00Z'});
  assert.equal(r.history.length,0);assert.deepEqual(r.adapterRejected[0].errors,['DATASET_ADAPTER_NOT_SUPPORTED']);
});

test('runner does not mutate frozen dataset descriptors',()=>{
  const item=Object.freeze({type:'AMAZON_PUBLIC_RANKING',dataset:Object.freeze({generatedAt:'2026-08-26T10:00:00Z',rankPairs:Object.freeze([[1,'B00INKVS82']])})});
  const r=runDataFoundationV1({products,aliases,datasets:[item],now:'2026-08-26T11:00:00Z'});
  assert.equal(r.history.length,1);assert.equal(Object.hasOwn(item,'__observations'),false);
});
