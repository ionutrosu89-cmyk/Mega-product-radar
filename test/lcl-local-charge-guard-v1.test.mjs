import test from 'node:test';
import assert from 'node:assert/strict';
import {localChargeScopeGuardV1,lclScreeningRangeV1} from '../lcl-local-charge-guard-v1.js';

test('FCL per-container charges are blocked from direct LCL allocation',()=>{
 const r=localChargeScopeGuardV1({shipmentMode:'SEA_LCL',chargeScope:'CONTAINER_FCL_CONTEXT_ONLY',unit:'per container'});
 assert.equal(r.status,'BLOCKED_SCOPE_MISMATCH');
 assert.equal(r.usable,false);
});

test('explicit LCL allocation evidence can clear scope guard',()=>{
 const r=localChargeScopeGuardV1({shipmentMode:'SEA_LCL',chargeScope:'FCL_CONTAINER',unit:'container',explicitLclAllocation:true});
 assert.equal(r.status,'SCOPE_COMPATIBLE');
});

test('LCL public range preserves sea-only vs all-in distinction',()=>{
 const r=lclScreeningRangeV1({usdRon:4.52,sources:[
  {lclSeaFreightUsdPerCbmMin:40,lclSeaFreightUsdPerCbmMax:95},
  {totalBeforeDutyVatUsd:215}
 ]});
 assert.equal(r.status,'SCREENING_RANGE_READY');
 assert.equal(r.seaFreightUsdPerCbmMin,40);
 assert.equal(r.seaFreightUsdPerCbmMax,95);
 assert.equal(r.historicalAllInBeforeDutyVatRonMin,971.8);
});
