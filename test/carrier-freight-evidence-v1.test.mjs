import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCarrierFreightEvidence} from '../carrier-freight-evidence-v1.js';

test('official base list rate remains partial when current surcharges are unknown',()=>{
  const r=buildCarrierFreightEvidence({carrier:'FedEx',service:'International Economy',chargeableWeightKg:1.7,baseRateRon:691.66,baseRateEvidenceClass:'OFFICIAL_PUBLISHED',baseRateEvidenceRef:'fedex-2026-import-guide',processingFeeRon:12});
  assert.equal(r.status,'PARTIAL_BENCHMARK_ONLY');
  assert.equal(r.decisionUsable,false);
  assert.equal(r.fullyLoadedFreightRon,null);
  assert.ok(r.blockers.includes('CURRENT_FUEL_SURCHARGE_REQUIRED'));
});

test('complete evidence computes fully loaded freight',()=>{
  const r=buildCarrierFreightEvidence({carrier:'FedEx',service:'International Economy',chargeableWeightKg:1.7,baseRateRon:691.66,baseRateEvidenceClass:'OFFICIAL_PUBLISHED',baseRateEvidenceRef:'fedex-2026-import-guide',fuelSurchargePct:30,processingFeeRon:12,otherSurchargesRon:0,surchargeEvidenceRef:'fedex-current-surcharges'});
  assert.equal(r.status,'COMPLETE_VERIFIED_FREIGHT');
  assert.equal(r.decisionUsable,true);
  assert.equal(r.fullyLoadedFreightRon,911.16);
});
