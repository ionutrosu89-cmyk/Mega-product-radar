import assert from 'node:assert/strict';
import test from 'node:test';
import {MARKETPLACE_SOURCE_EXPANSION,sourceExpansionReadiness,buildSourceExpansionPlan,classifySourceObservation} from '../marketplace-source-expansion.js';

test('source registry separates demand ranking from catalogue and supply discovery',()=>{
  const r=sourceExpansionReadiness();
  assert.ok(r.rankingSeeds.some(x=>x.key==='AMAZON_PUBLIC_RANKINGS'));
  assert.ok(r.rankingSeeds.some(x=>x.key==='EBAY_BEST_SELLING'));
  assert.ok(!r.rankingSeeds.some(x=>x.key==='ALIBABA_TOP_RANKING'));
  assert.ok(r.supplySources.some(x=>x.key==='ALIBABA_TOP_RANKING'));
  assert.ok(r.catalogueDiscovery.some(x=>x.key==='EMAG_MARKETPLACE_SELLER_API'));
  assert.ok(r.catalogueDiscovery.some(x=>x.key==='SHOPIFY_STOREFRONT'));
  assert.equal(r.automaticExecutionAllowed,false);
  assert.equal(r.paidCallsTriggered,0);
});

test('requested ecosystems have explicit evidence scope',()=>{
  for(const key of ['EBAY_BEST_SELLING','EMAG_MARKETPLACE_SELLER_API','EMAG_PUBLIC_MARKET','ALIEXPRESS_OFFICIAL_API','ALIBABA_TOP_RANKING','SHOPIFY_STOREFRONT']) assert.ok(MARKETPLACE_SOURCE_EXPANSION[key]);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.EMAG_MARKETPLACE_SELLER_API.sellerScoped,true);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.EMAG_MARKETPLACE_SELLER_API.marketWideEvidence,false);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.SHOPIFY_STOREFRONT.storeScoped,true);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.SHOPIFY_STOREFRONT.marketWideEvidence,false);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.ALIBABA_TOP_RANKING.demandEvidence,false);
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.ALIBABA_TOP_RANKING.supplyEvidence,true);
});

test('scoped and supply sources cannot masquerade as ranking or market-wide evidence',()=>{
  assert.equal(classifySourceObservation({sourceKey:'ALIBABA_TOP_RANKING',hasExplicitRank:true}).ok,false);
  assert.equal(classifySourceObservation({sourceKey:'SHOPIFY_STOREFRONT',claimMarketWide:true}).ok,false);
  assert.equal(classifySourceObservation({sourceKey:'EMAG_MARKETPLACE_SELLER_API',claimMarketWide:true}).ok,false);
  const x=classifySourceObservation({sourceKey:'ALIEXPRESS_OFFICIAL_API'});
  assert.equal(x.ok,true);
  assert.equal(x.evidenceClass,'CATALOGUE_DISCOVERY_OBSERVATION');
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('default source mix keeps real ranking data primary but preserves scoped roles',()=>{
  const p=buildSourceExpansionPlan({});
  assert.equal(p.allocation.rankingSeedPct,70);
  assert.equal(p.allocation.catalogueDiscoveryPct,30);
  assert.ok(p.rankingSources.includes('AMAZON_PUBLIC_RANKINGS'));
  assert.ok(p.rankingSources.includes('EBAY_BEST_SELLING'));
  assert.ok(!p.rankingSources.includes('ALIBABA_TOP_RANKING'));
  assert.ok(p.supplySources.includes('ALIBABA_TOP_RANKING'));
  assert.ok(p.scopedSources.includes('SHOPIFY_STOREFRONT'));
  assert.equal(p.executeAutomatically,false);
  assert.equal(p.purchaseAuthorized,false);
});
