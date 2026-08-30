import test from 'node:test';
import assert from 'node:assert/strict';
import {amazonCatalogNiche,amazonEngagementSignal,buildAmazonLiveCatalogBridge} from '../amazon-live-catalog-bridge-v1.js';

const bootstrap={fields:['asin','title','brand','categoryLabel','price','currency','rating','reviewCount','observedAt','sourceUrlIdentityMatch'],products:[['B000TEST01','Old title','Brand X','["Home & Kitchen","Storage & Organization","Desk Supplies"]',99,'USD',1,1,'2024-01-01',true]]};
const live={fields:['asin','title','price','currency','rating','reviewCount','observedAt','statusCode','htmlBytes'],products:[['B000TEST01','Current title',25,'USD',4.8,1500,'2026-08-30T00:00:00Z',200,12345]],policy:{freshnessClass:'LIVE_PUBLIC_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,trendAuthorized:false}};

test('uses exact source hierarchy and never bootstrap metrics',()=>{
  const out=buildAmazonLiveCatalogBridge({bootstrap,live});
  assert.equal(out.stats.eligibleProducts,1);
  assert.equal(out.products[0].externalId,'B000TEST01');
  assert.equal(out.products[0].name,'Current title');
  assert.equal(out.products[0].category,'Home & Kitchen › Storage & Organization');
  assert.equal(out.products[0].price,25);
  assert.equal(out.products[0].rating,4.8);
  assert.equal(out.products[0].reviewCount,1500);
  assert.equal(out.products[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.truthPolicy.bootstrapMetricsNotUsed,true);
  assert.equal(out.truthPolicy.engagementSignalIsNotSales,true);
  assert.equal(out.truthPolicy.purchaseAuthorized,false);
});

test('fails closed when ASIN is absent or policy is unsafe',()=>{
  const missing=structuredClone(live);missing.products[0][0]='B000OTHER1';
  const out=buildAmazonLiveCatalogBridge({bootstrap,liveCompact:missing});
  assert.equal(out.stats.eligibleProducts,0);
  assert.equal(out.stats.missingBootstrapAsin,1);
  const unsafe=structuredClone(live);unsafe.policy.providerSpendEur=1;
  assert.throws(()=>buildAmazonLiveCatalogBridge({bootstrap,liveCompact:unsafe}),/AMAZON_LIVE_POLICY_INVALID/);
});

test('niche depth and engagement score are deterministic',()=>{
  assert.equal(amazonCatalogNiche('["A","B","C"]',2).label,'A › B');
  assert.equal(amazonEngagementSignal(5,9999),100);
  assert.equal(amazonEngagementSignal(null,100),null);
});
