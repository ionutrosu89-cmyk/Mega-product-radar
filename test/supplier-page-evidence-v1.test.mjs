import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSupplierPageEvidence} from '../supplier-page-evidence-v1.js';

test('direct product page with public price MOQ and high match is screening-ready without supplier contact',()=>{
 const r=evaluateSupplierPageEvidence({sourceUrl:'https://example.com/product/1',supplierUrl:'https://example.com/supplier',supplierName:'Supplier',productTitle:'Magnetic holder',priceMin:.64,priceMax:.75,currency:'USD',moq:10,productMatch:'HIGH',supplierYears:19,supplierRating:4.4});
 assert.equal(r.status,'PAGE_BACKED_SCREENING_READY');
 assert.equal(r.screeningReady,true);
 assert.equal(r.screeningUnitPrice,.75);
 assert.equal(r.supplierContactRequired,false);
 assert.equal(r.commercialQuoteVerified,false);
});

test('missing dimensions do not block supplier page screening',()=>{
 const r=evaluateSupplierPageEvidence({sourceUrl:'https://example.com/product/1',supplierName:'Supplier',productTitle:'Product',priceMax:1,currency:'USD',moq:2,productMatch:'HIGH'});
 assert.equal(r.screeningReady,true);
 assert.equal(r.standardFields.productDimensions,null);
});

test('missing public price or direct page fails closed',()=>{
 const r=evaluateSupplierPageEvidence({sourceUrl:'search results',supplierName:'Supplier',productTitle:'Product',moq:2,productMatch:'HIGH'});
 assert.equal(r.screeningReady,false);
 assert.ok(r.blockers.includes('DIRECT_PRODUCT_PAGE_REQUIRED'));
 assert.ok(r.blockers.includes('PUBLIC_PRICE_REQUIRED'));
});
