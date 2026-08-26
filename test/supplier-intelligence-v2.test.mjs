import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSupplierIntelligenceV2,normalizeSupplierDossierV2} from '../supplier-intelligence-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const quote=(overrides={})=>({unitPrice:4.5,currency:'USD',moq:200,observedAt:'2026-08-20T10:00:00Z',source:'SUPPLIER_QUOTE_SCREENSHOT',evidenceClass:'MANUALLY_VERIFIED',...overrides});
const dossier=(id,state='MANUALLY_VERIFIED',overrides={})=>({canonicalProductId:A,supplierId:id,supplierName:`Supplier ${id}`,platform:'ALIBABA',state,quote:quote(),...overrides});

test('discovery-only supplier is not verified supplier evidence',()=>{
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,dossiers:[dossier('s1','DISCOVERED',{quote:null})],now:'2026-08-26T10:00:00Z'});
 assert.equal(r.supplierGatePassed,false);assert.ok(r.blockers.includes('DOCUMENTED_QUOTE_REQUIRED'));
});

test('one documented quote alone does not satisfy three-dossier and corroboration requirements',()=>{
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,dossiers:[dossier('s1','MANUALLY_VERIFIED')],now:'2026-08-26T10:00:00Z'});
 assert.equal(r.status,'REVIEW');assert.ok(r.blockers.includes('INSUFFICIENT_SUPPLIER_DOSSIERS'));assert.ok(r.blockers.includes('SUPPLIER_CORROBORATION_REQUIRED'));
});

test('three dossiers with two current quotes and one manually verified documented quote can pass',()=>{
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,now:'2026-08-26T10:00:00Z',dossiers:[
  dossier('s1','MANUALLY_VERIFIED'),
  dossier('s2','DOCUMENTED'),
  dossier('s3','LISTING_OBSERVED',{quote:null})
 ]});
 assert.equal(r.status,'PASS');assert.equal(r.supplierGatePassed,true);assert.equal(r.metrics.uniqueSuppliers,3);assert.equal(r.metrics.quotedSuppliers,2);assert.equal(r.economicsEligible,true);assert.equal(r.purchaseAuthorized,false);
});

test('cross-product evidence is rejected and cannot be borrowed',()=>{
 const wrong=dossier('s2','MANUALLY_VERIFIED',{canonicalProductId:B});
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,now:'2026-08-26T10:00:00Z',dossiers:[dossier('s1'),wrong,dossier('s3','LISTING_OBSERVED',{quote:null})]});
 assert.equal(r.supplierGatePassed,false);assert.equal(r.metrics.rejectedCrossProduct,1);assert.ok(r.blockers.includes('CROSS_PRODUCT_EVIDENCE_PRESENT'));
});

test('documented quote with heuristic evidence cannot satisfy documented gate',()=>{
 const weak=dossier('s1','DOCUMENTED',{quote:quote({evidenceClass:'HEURISTIC'})});
 const n=normalizeSupplierDossierV2(weak,A,{now:'2026-08-26T10:00:00Z'});
 assert.ok(n.reasons.includes('DOCUMENTED_QUOTE_REQUIRES_STRONG_EVIDENCE'));
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,now:'2026-08-26T10:00:00Z',dossiers:[weak,dossier('s2','QUOTE_RECEIVED'),dossier('s3','LISTING_OBSERVED',{quote:null})]});
 assert.ok(r.blockers.includes('DOCUMENTED_QUOTE_REQUIRED'));
});

test('stale quote cannot satisfy current supplier gate',()=>{
 const stale=dossier('s1','MANUALLY_VERIFIED',{quote:quote({observedAt:'2025-01-01T00:00:00Z'})});
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,now:'2026-08-26T10:00:00Z',dossiers:[stale,dossier('s2','QUOTE_RECEIVED'),dossier('s3','LISTING_OBSERVED',{quote:null})]});
 assert.ok(r.blockers.includes('STALE_QUOTES_PRESENT'));assert.equal(r.supplierGatePassed,false);
});

test('duplicate dossiers for same supplier do not inflate corroboration',()=>{
 const r=analyzeSupplierIntelligenceV2({canonicalProductId:A,now:'2026-08-26T10:00:00Z',dossiers:[dossier('s1'),dossier('s1','DOCUMENTED'),dossier('s2','LISTING_OBSERVED',{quote:null})]});
 assert.equal(r.metrics.uniqueSuppliers,2);assert.equal(r.supplierGatePassed,false);
});

test('missing canonical identity fails closed',()=>{
 const r=analyzeSupplierIntelligenceV2({dossiers:[dossier('s1')],now:'2026-08-26T10:00:00Z'});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.blockers.includes('CANONICAL_PRODUCT_ID_REQUIRED'));
});
