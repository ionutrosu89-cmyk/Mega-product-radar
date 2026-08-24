import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLIC_COLLECTOR_POLICY,amazonSurfaceUrl,normalizeAmazonRows,alibabaTopRankingUrl,normalizeAlibabaRows,ebayBestSellingRequest,normalizeEbayBestSelling,collectorHealth} from '../public-marketplace-collectors.js';

test('collectors are free-first and never auto execute',()=>{
  assert.equal(PUBLIC_COLLECTOR_POLICY.AMAZON.paid,false);
  assert.equal(PUBLIC_COLLECTOR_POLICY.ALIBABA.paid,false);
  assert.equal(PUBLIC_COLLECTOR_POLICY.EBAY.paid,false);
  assert.notEqual(PUBLIC_COLLECTOR_POLICY.AMAZON.execution,'AUTO');
});

test('Amazon surfaces build only approved HTTPS marketplace URLs',()=>{
  assert.equal(amazonSurfaceUrl({market:'DE',surface:'BEST_SELLERS'}),'https://www.amazon.de/gp/bestsellers');
  assert.equal(amazonSurfaceUrl({market:'US',surface:'NEW_RELEASES',categoryPath:'home-garden'}),'https://www.amazon.com/gp/new-releases/home-garden');
  assert.equal(amazonSurfaceUrl({market:'XX',surface:'BEST_SELLERS'}),null);
});

test('Amazon observations preserve public rank and never claim verified sales',()=>{
  const out=normalizeAmazonRows([{asin:'B001',title:'Desk organizer',rank:3,price:'19.99',currency:'EUR',rating:'4.7',reviewCount:'1200',url:'https://www.amazon.de/dp/B001'}],{market:'DE',surface:'BEST_SELLERS',categoryLabel:'Desk',observedAt:'2026-08-24T17:00:00Z'});
  assert.equal(out.records.length,1);
  assert.equal(out.records[0].sourceRank,3);
  assert.equal(out.records[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.records[0].purchaseAuthorized,false);
});

test('Alibaba Top Ranking normalizes supplier context without promoting it to a quote',()=>{
  assert.match(alibabaTopRankingUrl({categorySlug:'car-accessories'}),/^https:\/\/www\.alibaba\.com\//);
  const out=normalizeAlibabaRows([{productId:'A1',title:'Magnetic holder',rank:2,price:'0.80',currency:'USD',supplier:'Factory A',url:'https://www.alibaba.com/product-detail/example'}],{categoryLabel:'Car accessories'});
  assert.equal(out.records.length,1);
  assert.equal(out.records[0].seller,'Factory A');
  assert.equal(out.records[0].evidenceClass,'PUBLIC_RANKING_OBSERVATION');
});

test('eBay uses official API request spec with server-only bearer placeholder',()=>{
  const req=ebayBestSellingRequest({categoryId:'9355',marketplaceId:'EBAY_US',limit:500});
  assert.equal(req.ok,true);
  assert.equal(req.query.metric_name,'BEST_SELLING');
  assert.equal(req.query.limit,100);
  assert.equal(req.serverSecretRequired,'EBAY_OAUTH_TOKEN');
  assert.equal(req.executeAutomatically,false);
  assert.match(req.headers.authorization,/\$\{EBAY_OAUTH_TOKEN\}/);
});

test('eBay payload normalization never interprets array position as sales count',()=>{
  const out=normalizeEbayBestSelling({merchandisedProducts:[{epid:'E1',title:'USB stand',price:{value:'12.5',currency:'USD'},image:{imageUrl:'https://i.ebayimg.com/example.jpg'}}]},{sourceCategoryId:'9355',marketplaceId:'EBAY_US'});
  assert.equal(out.records.length,1);
  assert.equal(out.records[0].sourceRank,1);
  assert.equal(out.records[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('collector health reports rejected rows instead of silently accepting malformed data',()=>{
  const out=normalizeAmazonRows([{asin:'B1',title:'Good',rank:1},{title:'',rank:2}],{surface:'BEST_SELLERS'});
  const health=collectorHealth(out);
  assert.equal(health.accepted,1);
  assert.equal(health.rejected,1);
  assert.equal(health.purchaseAuthorized,false);
});
