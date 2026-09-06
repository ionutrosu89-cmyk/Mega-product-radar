import test from 'node:test';
import assert from 'node:assert/strict';
import {cartonVolume,volumetricWeightKg,chargeableWeightKg,calculateFreightCost} from '../freight-chargeable-v1.js';

test('calculates carton volume and volumetric weight without guessing divisor',()=>{
  const volume=cartonVolume({lengthCm:30,widthCm:20,heightCm:10,cartons:1});
  assert.equal(volume.volumeCm3,6000);
  assert.equal(volume.volumeM3,0.006);
  assert.equal(volumetricWeightKg({lengthCm:30,widthCm:20,heightCm:10,cartons:1,divisor:5000}).kg,1.2);
  assert.equal(volumetricWeightKg({lengthCm:30,widthCm:20,heightCm:10,cartons:1}).known,false);
});

test('chargeable weight is the greater of actual and volumetric weight',()=>{
  const actualWins=chargeableWeightKg({lengthCm:30,widthCm:20,heightCm:10,cartons:1,divisor:5000,actualGrossWeightKg:1.7});
  assert.equal(actualWins.chargeableKg,1.7);
  assert.equal(actualWins.basis,'ACTUAL_WEIGHT');
  const volumetricWins=chargeableWeightKg({lengthCm:50,widthCm:40,heightCm:40,cartons:1,divisor:5000,actualGrossWeightKg:7});
  assert.equal(volumetricWins.chargeableKg,16);
  assert.equal(volumetricWins.basis,'VOLUMETRIC_WEIGHT');
});

test('express freight requires verified divisor and rate',()=>{
  const missing=calculateFreightCost({mode:'EXPRESS_AIR',lengthCm:50,widthCm:40,heightCm:40,actualGrossWeightKg:7});
  assert.equal(missing.status,'UNKNOWN');
  assert.ok(missing.blockers.includes('VOLUMETRIC_DIVISOR_REQUIRED'));
  assert.ok(missing.blockers.includes('RATE_PER_CHARGEABLE_KG_REQUIRED'));
  const calculated=calculateFreightCost({mode:'EXPRESS_AIR',lengthCm:50,widthCm:40,heightCm:40,actualGrossWeightKg:7,divisor:5000,rateRonPerChargeableKg:20});
  assert.equal(calculated.costRon,320);
  assert.equal(calculated.basis,'VOLUMETRIC_WEIGHT');
});

test('sea freight uses CBM rather than volumetric divisor',()=>{
  const r=calculateFreightCost({mode:'SEA_CBM',lengthCm:100,widthCm:100,heightCm:100,cartons:2,rateRonPerCbm:500});
  assert.equal(r.volume.volumeM3,2);
  assert.equal(r.costRon,1000);
});
