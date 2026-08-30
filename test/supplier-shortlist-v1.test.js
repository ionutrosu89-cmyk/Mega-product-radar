import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSupplierShortlist,SupplierShortlistTruthPolicy} from '../supplier-shortlist-v1.js';
const base={funnelState:'VALIDATE',canPromoteToMatch:false,purchaseAuthorized:false,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE'};
test('ranks a commercially usable exact-config candidate ahead of a cheaper identity-incomplete row',()=>{
 const koyo={...base,externalId:'koyo',supplierName:'Koyo',publicPrice:{max:9},moq:{value:1000},blockers:['DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']};
 const cheap={...base,externalId:'cheap',supplierName:'Cheap',publicPrice:{max:7},moq:{value:1},blockers:['TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']};
 const out=buildSupplierShortlist([cheap,koyo]);
 assert.equal(out[0].externalId,'koyo');
 assert.equal(out[0].economicsAllowed,false);
});
test('keeps all shortlist rows validation-only',()=>{
 const [x]=buildSupplierShortlist([{...base,externalId:'x',publicPrice:null,moq:null,blockers:['DRAWER_EVIDENCE_REQUIRED']}]);
 assert.equal(x.shortlistStatus,'VALIDATE_ONLY_NOT_MATCHED');
 assert.equal(x.economicsAllowed,false);
 assert.equal(SupplierShortlistTruthPolicy.shortlistIsMarketplaceMatch,false);
 assert.equal(SupplierShortlistTruthPolicy.unknownEqualsZero,false);
});
test('drops rows already promoted or with purchase authority',()=>{
 assert.deepEqual(buildSupplierShortlist([{...base,externalId:'bad',canPromoteToMatch:true},{...base,externalId:'bad2',purchaseAuthorized:true}]),[]);
});
