import assert from 'node:assert/strict';
import test from 'node:test';
import {MARKETPLACE_SOURCE_EXPANSION,sourceExpansionReadiness,buildSourceExpansionPlan,classifySourceObservation} from '../marketplace-source-expansion.js';

test('source registry separates ranking seeds from catalogue discovery',()=>{
  const r=sourceExpansionReadiness();
  assert.ok(r.rankingSeeds.some(x=>x.key==='AMAZON_PUBLIC_RANKINGS'));
  assert.ok(r.rankingSeeds.some(x=>x.key==='EBAY_BEST_SELLING'));
  assert.ok(r.catalogueDiscovery.some(x=>x.key==='ETSY_OPEN_API'));
  assert.ok(r.catalogueDiscovery.some(x=>x.key==='WALMART_CATALOG_SEARCH'));
  assert.equal(r.automaticExecutionAllowed,false);
  assert.equal(r.paidCallsTriggered,0);
});

test('AliExpress and Temu remain research-only until route is confirmed',()=>{
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.ALIEXPRESS_RESEARCH.status,'RESEARCH_REQUIRED');
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.TEMU_RESEARCH.status,'RESEARCH_REQUIRED');
  assert.equal(MARKETPLACE_SOURCE_EXPANSION.ALIEXPRESS_RESEARCH.autoExecute,false);
});

test('catalogue discovery cannot masquerade as ranking evidence',()=>{
  assert.equal(classifySourceObservation({sourceKey:'WALMART_CATALOG_SEARCH',hasExplicitRank:true}).ok,false);
  const x=classifySourceObservation({sourceKey:'ETSY_OPEN_API'});
  assert.equal(x.ok,true);
  assert.equal(x.evidenceClass,'CATALOGUE_DISCOVERY_OBSERVATION');
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('default source mix keeps ranking data primary but grows breadth',()=>{
  const p=buildSourceExpansionPlan({});
  assert.equal(p.allocation.rankingSeedPct,70);
  assert.equal(p.allocation.catalogueDiscoveryPct,30);
  assert.ok(p.rankingSources.length>=3);
  assert.ok(p.catalogueSources.length>=2);
  assert.equal(p.executeAutomatically,false);
  assert.equal(p.purchaseAuthorized,false);
});
