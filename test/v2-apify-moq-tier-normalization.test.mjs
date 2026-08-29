import assert from 'node:assert/strict';
import test from 'node:test';
import {adaptStructuredSupplierProviderRow} from '../structured-supplier-provider-adapter-v1.js';

test('Apify quantityMin/quantityMax tiers and text minOrder are preserved',()=>{
  const out=adaptStructuredSupplierProviderRow({
    productId:'1601524138330',
    productUrl:'https://www.alibaba.com/product-detail/example_1601524138330.html',
    title:'Metal desk organizer',
    price:'US $1.80-$2.00',
    minOrder:'1000 pieces',
    unit:'piece',
    category:'Storage Holders & Racks',
    quantityPrices:[
      {price:2,quantityMin:1000,quantityMax:9999,unit:'pieces'},
      {price:1.8,quantityMin:10000,quantityMax:null,unit:'pieces'}
    ]
  },{provider:'APIFY_MEMO23_ALIBABA_SCRAPER',platform:'ALIBABA',observedAt:'2026-08-29T19:00:40.581Z'});
  assert.equal(out.valid,true);
  assert.equal(out.normalizedObservation.moq,1000);
  assert.equal(out.normalizedObservation.category,'Storage Holders & Racks');
  assert.deepEqual(out.normalizedObservation.priceTiers,[
    {minQuantity:1000,maxQuantity:9999,price:2},
    {minQuantity:10000,maxQuantity:null,price:1.8}
  ]);
  assert.equal(out.normalizedObservation.publicPriceMin,1.8);
  assert.equal(out.normalizedObservation.publicPriceMax,2);
});
