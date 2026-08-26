import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductUniverse} from '../product-universe-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('builds canonical universe and coverage without title-based joins',()=>{
  const out=buildProductUniverse({
    products:[{canonicalProductId:A,title:'Binder',category:'Office'},{canonicalProductId:B,title:'Binder'}],
    aliases:[{canonicalProductId:A,platform:'amazon_us',externalId:'B00AAA'},{canonicalProductId:B,platform:'EMAG_RO',externalId:'123'}],
    observations:[
      {canonicalProductId:A,observedAt:'2026-08-20T00:00:00Z',price:10,reviewCount:100},
      {canonicalProductId:A,observedAt:'2026-08-21T00:00:00Z',price:11,reviewCount:101},
      {canonicalProductId:B,observedAt:'2026-08-21T00:00:00Z',price:null,reviewCount:null}
    ]
  });
  assert.equal(out.metrics.canonicalProducts,2);
  assert.equal(out.metrics.aliases,2);
  assert.equal(out.metrics.sourceIdentityCoveragePct,100);
  assert.equal(out.metrics.twoPlusObservationsPct,50);
  assert.equal(out.products.find(x=>x.canonicalProductId===A).observationCount,2);
  assert.equal(out.products.find(x=>x.canonicalProductId===B).observationCount,1);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.providerSpendEur,0);
});

test('fails closed on duplicate canonical product ids',()=>{
  assert.throws(()=>buildProductUniverse({products:[{canonicalProductId:A},{canonicalProductId:A}]}),e=>e.code==='DUPLICATE_CANONICAL_PRODUCT_ID');
});

test('fails closed when one source alias points to two products',()=>{
  assert.throws(()=>buildProductUniverse({
    products:[{canonicalProductId:A},{canonicalProductId:B}],
    aliases:[{canonicalProductId:A,platform:'AMAZON_US',externalId:'X'},{canonicalProductId:B,platform:'AMAZON_US',externalId:'X'}]
  }),e=>e.code==='SOURCE_ALIAS_COLLISION');
});

test('never uses matching title to bind unbound observations',()=>{
  const out=buildProductUniverse({
    products:[{canonicalProductId:A,title:'Same title'}],
    aliases:[{canonicalProductId:A,platform:'AMAZON_US',externalId:'X'}],
    observations:[{title:'Same title',observedAt:'2026-08-21T00:00:00Z',price:12}]
  });
  assert.equal(out.metrics.boundObservations,0);
  assert.equal(out.metrics.unboundObservations,1);
  assert.equal(out.products[0].observationCount,0);
});

test('requires aliases to reference an existing canonical product',()=>{
  assert.throws(()=>buildProductUniverse({products:[{canonicalProductId:A}],aliases:[{canonicalProductId:B,platform:'EMAG_RO',externalId:'1'}]}),e=>e.code==='ALIAS_CANONICAL_PRODUCT_NOT_FOUND');
});
