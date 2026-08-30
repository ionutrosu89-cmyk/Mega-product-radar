import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSupplierDirectReplyEvidence,supplierReplyToFingerprintPatch} from '../supplier-direct-reply-evidence-v1.js';

test('accepts exact listing-bound supplier reply with complete direct dimensions',()=>{
  const e=normalizeSupplierDirectReplyEvidence({externalId:'1600756221959',supplierName:'Ningbo Koyo Imp & Exp Co., Ltd',model:'KY230224022',sourceRef:'issue-428-reply-1',listingBound:true,modelBound:true,exactConfigurationConfirmed:true,productDimensions:{lengthCm:35,widthCm:30,heightCm:28},netWeightKg:1.8,packedUnitDimensions:{lengthCm:37,widthCm:32,heightCm:8},grossPackedUnitWeightKg:2.1,masterCarton:{units:6,lengthCm:50,widthCm:40,heightCm:35,grossWeightKg:13.2},quote:{currency:'USD',unitPrice:10.2,moq:100,incoterm:'EXW'}});
  assert.equal(e.provenance.valid,true);
  assert.equal(e.directIdentityEvidenceUsable,true);
  assert.deepEqual(e.blockers,[]);
  assert.equal(e.netWeightGrams,1800);
  assert.equal(e.canAuthorizeEconomics,false);
  assert.equal(e.purchaseAuthorized,false);
  const patch=supplierReplyToFingerprintPatch(e);
  assert.equal(patch.dimensions.lengthCm,35);
  assert.equal(patch.provenance.externalId,'1600756221959');
});

test('fails closed when provenance is not exact even if dimensions are present',()=>{
  const e=normalizeSupplierDirectReplyEvidence({externalId:'1600756221959',supplierName:'Ningbo Koyo Imp & Exp Co., Ltd',sourceRef:'copied-from-similar-product',listingBound:false,modelBound:false,exactConfigurationConfirmed:true,productDimensions:{lengthCm:35,widthCm:30,heightCm:28}});
  assert.equal(e.provenance.valid,false);
  assert.equal(e.directIdentityEvidenceUsable,false);
  assert.ok(e.blockers.includes('EXACT_SUPPLIER_PROVENANCE_REQUIRED'));
  assert.equal(supplierReplyToFingerprintPatch(e),null);
});

test('missing dimensions remain unknown and cannot be promoted',()=>{
  const e=normalizeSupplierDirectReplyEvidence({externalId:'1600756221959',supplierName:'Ningbo Koyo Imp & Exp Co., Ltd',model:'KY230224022',sourceRef:'issue-428-reply-2',listingBound:true,modelBound:true,exactConfigurationConfirmed:true});
  assert.equal(e.productDimensions,null);
  assert.equal(e.directIdentityEvidenceUsable,false);
  assert.ok(e.blockers.includes('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'));
  assert.equal(e.truthPolicy.unknownEqualsZero,false);
});

test('configuration must be explicitly confirmed',()=>{
  const e=normalizeSupplierDirectReplyEvidence({externalId:'1600756221959',supplierName:'Ningbo Koyo Imp & Exp Co., Ltd',model:'KY230224022',sourceRef:'issue-428-reply-3',listingBound:true,modelBound:true,productDimensions:{lengthCm:35,widthCm:30,heightCm:28}});
  assert.equal(e.directIdentityEvidenceUsable,false);
  assert.ok(e.blockers.includes('EXACT_CONFIGURATION_CONFIRMATION_REQUIRED'));
});
