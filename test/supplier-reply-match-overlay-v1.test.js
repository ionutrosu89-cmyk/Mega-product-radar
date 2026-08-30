import test from 'node:test';
import assert from 'node:assert/strict';
import {applySupplierReplyMatchOverlay,SupplierReplyMatchOverlayTruthPolicy} from '../supplier-reply-match-overlay-v1.js';
const reply={schemaVersion:'MPR_SUPPLIER_DIRECT_REPLY_EVIDENCE_V1',evidenceClass:'SUPPLIER_DIRECT_REPLY_EVIDENCE',externalId:'1600756221959',model:'KY230224022',sourceRef:'supplier-chat',receivedAt:'2026-08-30T14:00:00Z',directIdentityEvidenceUsable:true,productDimensions:{lengthCm:35,widthCm:30.5,heightCm:27.9},netWeightGrams:1800,quote:{currency:'USD',unitPrice:10,moq:100},sampleOrTrial:{available:true,quantity:1}};
test('overlays only dimensions and weight for exact externalId',()=>{
 const out=applySupplierReplyMatchOverlay({externalId:'1600756221959',dimensions:null,unitWeightGrams:null,technicalSpecs:{tiers:5,penHolders:2},sourceTitle:'exact title'},reply);
 assert.deepEqual(out.dimensions,reply.productDimensions);
 assert.equal(out.unitWeightGrams,1800);
 assert.deepEqual(out.technicalSpecs,{tiers:5,penHolders:2});
 assert.equal(out.sourceTitle,'exact title');
 assert.equal(out.replyOverlay.applied,true);
});
test('does not transfer reply evidence to a different supplier listing',()=>{
 const out=applySupplierReplyMatchOverlay({externalId:'other',dimensions:null},reply);
 assert.equal(out.dimensions,null);
 assert.equal(out.replyOverlay,null);
});
test('rejects incomplete direct reply evidence',()=>{
 const out=applySupplierReplyMatchOverlay({externalId:'1600756221959',dimensions:null},{...reply,directIdentityEvidenceUsable:false});
 assert.equal(out.dimensions,null);
 assert.equal(out.replyOverlay,null);
 assert.equal(SupplierReplyMatchOverlayTruthPolicy.replyCannotRelaxMatchingThreshold,true);
 assert.equal(SupplierReplyMatchOverlayTruthPolicy.purchaseAuthorized,false);
});
