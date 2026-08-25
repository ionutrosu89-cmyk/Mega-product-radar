import assert from 'node:assert/strict';
import test from 'node:test';
import {buildEbayBestSellingDescriptor,buildEmagSellerDescriptor,buildEmagPublicReviewDescriptor,buildAliExpressDescriptor,buildAlibabaSupplyDescriptor,buildShopifyStorefrontDescriptor,multiMarketplaceReadiness} from '../multi-marketplace-acquisition-v1.js';

test('credentialed official APIs fail closed when secrets are absent',()=>{
  for(const x of [
    buildEbayBestSellingDescriptor({categoryId:'67858'}),
    buildEmagSellerDescriptor({}),
    buildAliExpressDescriptor({query:'cable organizer'}),
    buildShopifyStorefrontDescriptor({shopDomain:'example.myshopify.com'})
  ]){
    assert.equal(x.ok,false);
    assert.equal(x.error,'CREDENTIALS_REQUIRED');
    assert.equal(x.paidCallsTriggered,0);
    assert.equal(x.approvedSpendEur,0);
    assert.equal(x.purchaseAuthorized,false);
  }
});

test('eBay descriptor is official BEST_SELLING and capped at 100',()=>{
  const x=buildEbayBestSellingDescriptor({categoryId:'67858',limit:999,env:{EBAY_OAUTH_TOKEN:'secret-present'}});
  assert.equal(x.ok,true);
  assert.equal(x.query.metric_name,'BEST_SELLING');
  assert.equal(x.query.limit,100);
  assert.equal(x.headers.authorizationSecretEnv,'EBAY_OAUTH_TOKEN');
  assert.equal(x.rankingEvidence,true);
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('eMAG seller API never authorizes whole-market claims',()=>{
  const x=buildEmagSellerDescriptor({env:{EMAG_API_USERNAME:'u',EMAG_API_PASSWORD:'p'}});
  assert.equal(x.ok,true);
  assert.equal(x.sellerScoped,true);
  assert.equal(x.marketWideEvidence,false);
  assert.equal(x.scope,'AUTHORIZED_SELLER_ACCOUNT_ONLY');
  const pub=buildEmagPublicReviewDescriptor({url:'https://www.emag.ro/search/cable%20management'});
  assert.equal(pub.ok,true);
  assert.equal(pub.requiresManualReview,true);
  assert.equal(pub.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('AliExpress official mode is hybrid but not ranking or verified sales',()=>{
  const x=buildAliExpressDescriptor({query:'desk organizer',env:{ALIEXPRESS_APP_KEY:'k',ALIEXPRESS_APP_SECRET:'s'}});
  assert.equal(x.ok,true);
  assert.equal(x.signalRole,'DEMAND_SUPPLY_HYBRID');
  assert.equal(x.rankingEvidence,false);
  assert.equal(x.volumeEvidenceClass,'PLATFORM_STATED_SIGNAL_NOT_VERIFIED_SALES');
});

test('Alibaba is supply-only and Shopify is one-store-only',()=>{
  const ali=buildAlibabaSupplyDescriptor({categorySlug:'cable-management'});
  assert.equal(ali.ok,true);
  assert.equal(ali.supplyEvidence,true);
  assert.equal(ali.demandEvidence,false);
  assert.equal(ali.rankingEvidence,false);
  const shop=buildShopifyStorefrontDescriptor({shopDomain:'brand.myshopify.com',env:{SHOPIFY_STOREFRONT_TOKEN:'t'}});
  assert.equal(shop.ok,true);
  assert.equal(shop.storeScoped,true);
  assert.equal(shop.marketWideEvidence,false);
  assert.equal(shop.scope,'ONE_EXPLICIT_SHOP_ONLY');
});

test('readiness performs zero calls and zero spend',()=>{
  const r=multiMarketplaceReadiness({});
  assert.ok(r.ready.includes('ALIBABA'));
  assert.ok(r.blocked.some(x=>x.platform==='EBAY'&&x.error==='CREDENTIALS_REQUIRED'));
  assert.ok(r.blocked.some(x=>x.platform==='EMAG'&&x.error==='CREDENTIALS_REQUIRED'));
  assert.ok(r.blocked.some(x=>x.platform==='ALIEXPRESS'&&x.error==='CREDENTIALS_REQUIRED'));
  assert.ok(r.blocked.some(x=>x.platform==='SHOPIFY'&&x.error==='CREDENTIALS_REQUIRED'));
  assert.equal(r.executeAutomatically,false);
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.approvedSpendEur,0);
  assert.equal(r.purchaseAuthorized,false);
});
