import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptOpenFactsRecord} from '../catalog-source-adapters-v1.js';
import {runBulkCatalogIngestion} from '../bulk-catalog-ingestion-v1.js';
import {buildCatalogPersistenceBundle,verifyCatalogPersistenceReplay} from '../catalog-persistence-v1.js';

test('invalid GTIN checksum is never promoted to strong identity',()=>{
  const c=adaptOpenFactsRecord({code:'4006381333932',product_name:'Invalid GTIN Product',brands:'Acme'},{observedAt:'2026-08-27T17:00:00Z'});
  assert.equal(c.gtin,null);
  assert.equal(c.invalidGtin,'04006381333932');
  assert.equal(c.identityStrength,'FALLBACK');
  assert.equal(c.identityKeys.some(x=>x.namespace==='GTIN'),false);
});

test('valid GTIN remains strong identity',()=>{
  const c=adaptOpenFactsRecord({code:'4006381333931',product_name:'Valid GTIN Product',brands:'Acme'},{observedAt:'2026-08-27T17:00:00Z'});
  assert.equal(c.gtin,'04006381333931');
  assert.equal(c.invalidGtin,null);
  assert.equal(c.identityStrength,'STRONG_GTIN');
});

test('persistence bundle targets canonical catalog tables and remains write-disabled',()=>{
  const ingestion=runBulkCatalogIngestion({sourceKey:'OPEN_FOOD_FACTS',records:[{code:'4006381333931',product_name:'Valid Product',brands:'Acme',categories:'Food'}],retrievedAt:'2026-08-27T17:00:00Z'});
  const bundle=buildCatalogPersistenceBundle(ingestion);
  assert.equal(bundle.target.canonicalTable,'canonical_products');
  assert.equal(bundle.counts.products,1);
  assert.equal(bundle.counts.identities,1);
  assert.equal(bundle.writeAuthorized,false);
  assert.equal(bundle.products[0].status,'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY');
  assert.equal(bundle.policy.providerDataSpendEur,0);
  assert.equal(bundle.policy.purchaseAuthorized,false);
});

test('identical ingestion produces deterministic persistence replay',()=>{
  const input={sourceKey:'OPEN_FOOD_FACTS',records:[{code:'4006381333931',product_name:'Valid Product',brands:'Acme'}],retrievedAt:'2026-08-27T17:00:00Z'};
  const a=buildCatalogPersistenceBundle(runBulkCatalogIngestion(input));
  const b=buildCatalogPersistenceBundle(runBulkCatalogIngestion(input));
  const replay=verifyCatalogPersistenceReplay(a,b);
  assert.equal(replay.replayDeterministic,true);
  assert.equal(replay.decision,'REPLAY_VERIFIED');
});
