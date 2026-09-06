import test from 'node:test';
import assert from 'node:assert/strict';
import {finalistTestGateV1} from '../finalist-test-gate-v1.js';

test('FINALIST remains blocked while customs and full landed cost are unknown',()=>{
 const r=finalistTestGateV1({
  stage:'FINALIST',romaniaDemandReady:true,salesStatus:'ESTIMATED_HIGH_CONFIDENCE',salesConfidence:82,
  supplierPageReady:true,complianceReady:true
 });
 assert.equal(r.status,'TEST_BLOCKED');
 assert.ok(r.blockers.includes('EXACT_CN_TARIC_CLASSIFICATION_REQUIRED'));
 assert.ok(r.blockers.includes('FULLY_LOADED_FREIGHT_REQUIRED'));
 assert.equal(r.purchaseAuthorized,false);
});

test('fully evidenced healthy FINALIST becomes TEST_READY but still needs user approval',()=>{
 const r=finalistTestGateV1({
  stage:'FINALIST',romaniaDemandReady:true,salesStatus:'ESTIMATED_HIGH_CONFIDENCE',salesConfidence:82,
  supplierPageReady:true,cnCode:'12345678',taricStatus:'VERIFIED',customsDutyRateVerified:true,
  freightFullyLoaded:true,freightTotalRon:100,importCostsReady:true,landedCostConfirmed:true,landedCostPerUnitRon:10,
  marginPct:25,roiPct:60,profitPerUnitRon:8,complianceReady:true
 });
 assert.equal(r.status,'TEST_READY');
 assert.equal(r.sampleOrOrderApprovalRequired,true);
 assert.equal(r.purchaseAuthorized,false);
});
