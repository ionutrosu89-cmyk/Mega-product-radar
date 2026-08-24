import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLIC_RANKING_SOURCES,publicSourceReadiness,normalizeRankingObservation,sourceIdentity,crossPlatformMatchHint,buildPublicAcquisitionPlan} from '../public-rankings-acquisition.js';

test('official/public source registry separates ready, credentialed and research-only sources',()=>{
  const r=publicSourceReadiness();
  assert.ok(r.readyPublic.some(x=>x.key==='AMAZON_BEST_SELLERS'));
  assert.ok(r.readyPublic.some(x=>x.key==='ALIBABA_TOP_RANKING'));
  assert.ok(r.freeApi.some(x=>x.key==='EBAY_BEST_SELLING'));
  assert.ok(r.research.some(x=>x.key==='ALIEXPRESS_RANKINGS'));
  assert.equal(r.paidCallsTriggered,0);
  for(const v of Object.values(PUBLIC_RANKING_SOURCES))assert.equal(v.autoExecute,false);
});

test('public rank observation never becomes verified sales',()=>{
  const x=normalizeRankingObservation({sourceKey:'AMAZON_BEST_SELLERS',externalId:'B000TEST',title:'Desk Headphone Holder',sourceRank:4,price:19.99,currency:'USD',reviewCount:1200,observedAt:'2026-08-24T17:00:00Z'});
  assert.equal(x.ok,true);
  assert.equal(x.record.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.record.evidenceClass,'PUBLIC_RANKING_OBSERVATION');
  assert.equal(x.record.purchaseAuthorized,false);
});

test('missing numeric values remain null and invalid ranks fail closed',()=>{
  const a=normalizeRankingObservation({sourceKey:'ALIBABA_TOP_RANKING',url:'https://www.alibaba.com/product-detail/example',title:'Magnetic Sunglasses Holder',sourceRank:null,price:''});
  assert.equal(a.ok,true);
  assert.equal(a.record.sourceRank,null);
  assert.equal(a.record.price,null);
  const b=normalizeRankingObservation({sourceKey:'ALIBABA_TOP_RANKING',url:'https://www.alibaba.com/product-detail/example',title:'X',sourceRank:0});
  assert.equal(b.ok,false);
});

test('source identity dedupes only exact platform identity',()=>{
  assert.equal(sourceIdentity({platform:'AMAZON',externalId:'B001'}),'AMAZON:ID:B001');
  assert.equal(sourceIdentity({platform:'EBAY',url:'https://www.ebay.com/itm/123'}),'EBAY:URL:https://www.ebay.com/itm/123');
});

test('cross-platform similarity is only a manual canonicalization hint',()=>{
  const h=crossPlatformMatchHint({platform:'AMAZON',title:'Magnetic Car Sun Visor Sunglasses Holder',brand:'Acme'},{platform:'EBAY',title:'Acme Magnetic Car Sun Visor Sunglasses Holder',brand:'Acme'});
  assert.equal(h.candidate,true);
  assert.equal(h.autoMerge,false);
  assert.equal(h.reason,'MANUAL_CANONICAL_REVIEW_REQUIRED');
});

test('acquisition plan is breadth-first and never executes automatically',()=>{
  const p=buildPublicAcquisitionPlan({categoryKeys:['home-kitchen','automotive'],perSurfaceTarget:100});
  assert.ok(p.taskCount>=6);
  assert.ok(p.tasks.every(x=>x.executeAutomatically===false));
  assert.ok(p.researchQueue.includes('ALIEXPRESS_RANKINGS'));
  assert.equal(p.paidCallsTriggered,0);
  assert.equal(p.purchaseAuthorized,false);
});
