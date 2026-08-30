import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSupplierValidationQueue,SupplierValidationQueueTruthPolicy} from '../supplier-validation-queue-v1.js';

const partial={
  platform:'ALIBABA',externalId:'1601019174460',title:'5-Tier Paper Letter Tray Organizer with File Holder - Desk Organizer with Drawer and Pen Holders Metal Mesh Desk Organizer',
  signals:{fiveTier:true,drawer:true,twoPenHolders:false,penHolder:true,organizer:true,mesh:true},
  exactDistinctiveConfiguration:false,partialDistinctiveConfiguration:true,
  publicPriceCandidate:{currency:'USD',min:7,max:7},moqCandidate:{value:1},dimensions:null,detailEvidence:false,
  truthPolicy:{indexCardAloneIsMarketplaceMatch:false,unknownEqualsZero:false,purchaseAuthorized:false}
};

test('queues near-complete supplier evidence without promoting it to a match',()=>{
  const [x]=buildSupplierValidationQueue([partial]);
  assert.equal(x.externalId,'1601019174460');
  assert.equal(x.funnelState,'VALIDATE');
  assert.equal(x.canPromoteToMatch,false);
  assert.deepEqual(x.missingDistinctiveEvidence,['explicit-two-pen-holders']);
  assert.ok(x.validationBlockers.includes('TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED'));
  assert.ok(x.validationBlockers.includes('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'));
  assert.equal(x.truthPolicy.validationQueueIsMatchEvidence,false);
  assert.equal(x.truthPolicy.validationQueueCanAuthorizeEconomics,false);
});

test('does not queue generic or already exact candidates',()=>{
  const generic={...partial,externalId:'generic',partialDistinctiveConfiguration:false};
  const exact={...partial,externalId:'exact',exactDistinctiveConfiguration:true,signals:{...partial.signals,twoPenHolders:true}};
  assert.deepEqual(buildSupplierValidationQueue([generic,exact]),[]);
});

test('truth policy keeps missing evidence unknown and threshold unchanged',()=>{
  assert.equal(SupplierValidationQueueTruthPolicy.explicitMissingEvidenceRemainsUnknown,true);
  assert.equal(SupplierValidationQueueTruthPolicy.matchingThresholdRelaxed,false);
  assert.equal(SupplierValidationQueueTruthPolicy.unknownEqualsZero,false);
  assert.equal(SupplierValidationQueueTruthPolicy.validationQueueCanAuthorizePurchase,false);
});
