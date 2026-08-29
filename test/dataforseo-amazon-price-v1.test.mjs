import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDataForSeoAmazonPriceObservations,DataForSeoAmazonPriceTruthPolicy} from '../dataforseo-amazon-price-v1.js';

const response={tasks:[{result:[{datetime:'2026-08-29 17:00:00 +00:00',check_url:'https://amazon.com/s?k=desk+organizer',items:[{type:'amazon_serp',data_asin:'B012345678',title:'Desk Organizer',url:'https://www.amazon.com/dp/B012345678',price_from:19.99,price_to:24.99,currency:'USD',bought_past_month:300,rating:{value:4.6,votes_count:1234}},{type:'related_searches',title:'ignore me'}]}]}]};

test('extracts structured public Amazon price conservatively from range',()=>{
  const rows=extractDataForSeoAmazonPriceObservations(response);
  assert.equal(rows.length,1);
  assert.equal(rows[0].externalProductId,'B012345678');
  assert.equal(rows[0].price,24.99);
  assert.equal(rows[0].priceFrom,19.99);
  assert.equal(rows[0].priceTo,24.99);
  assert.equal(rows[0].currency,'USD');
  assert.equal(rows[0].reviewCount,1234);
});

test('bought past month stays provider/Amazon displayed signal, never verified sales',()=>{
  const row=extractDataForSeoAmazonPriceObservations(response)[0];
  assert.equal(row.provenance.amazonDisplayedBoughtPastMonth,300);
  assert.equal(row.provenance.boughtPastMonthEvidenceClass,'AMAZON_DISPLAYED_SIGNAL_NOT_VERIFIED_SALES');
  assert.equal(row.verifiedSales,false);
  assert.equal(DataForSeoAmazonPriceTruthPolicy.amazonDisplayedBoughtPastMonthIsVerifiedSales,false);
});

test('missing price is not converted to zero or price evidence',()=>{
  const bad=structuredClone(response);
  bad.tasks[0].result[0].items[0].price_from=null;
  bad.tasks[0].result[0].items[0].price_to=null;
  assert.equal(extractDataForSeoAmazonPriceObservations(bad).length,0);
});

test('non-product elements are ignored',()=>{
  const bad=structuredClone(response);
  bad.tasks[0].result[0].items[0].type='editorial_recommendations';
  assert.equal(extractDataForSeoAmazonPriceObservations(bad).length,0);
});
