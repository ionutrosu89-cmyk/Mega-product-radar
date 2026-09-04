import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateFreightPerUnit} from '../freight-estimator-v1.js';

test('air freight uses chargeable weight and volumetric weight when dimensions are known',()=>{
  const r=estimateFreightPerUnit({unitWeightGrams:500,packedDimensions:{lengthCm:40,widthCm:30,heightCm:20},mode:'AIR'});
  assert.equal(r.status,'ESTIMATED');
  assert.ok(r.volumetricWeightKg>r.actualWeightKg);
  assert.ok(r.freightPerUnitRon>0);
  assert.equal(r.rule,'AIR_CHARGEABLE_WEIGHT');
  assert.equal(r.confidence,'HIGH');
});

test('missing dimensions and weight use a conservative non-zero profile floor',()=>{
  const r=estimateFreightPerUnit({mode:'AIR'});
  assert.equal(r.status,'ESTIMATED');
  assert.ok(r.freightPerUnitRon>0);
  assert.equal(r.rule,'AIR_CATEGORY_PROFILE_FLOOR');
  assert.equal(r.confidence,'LOW');
  assert.equal(r.truthPolicy.unknownEqualsZero,false);
});

test('sea freight can use unit volume',()=>{
  const r=estimateFreightPerUnit({packedDimensions:{lengthCm:50,widthCm:40,heightCm:30},mode:'SEA'});
  assert.equal(r.status,'ESTIMATED');
  assert.equal(r.rule,'SEA_UNIT_VOLUME');
  assert.ok(r.freightPerUnitRon>0);
});

test('unsupported freight mode fails closed',()=>{
  const r=estimateFreightPerUnit({mode:'RAIL'});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.freightPerUnitRon,null);
  assert.ok(r.blockers.includes('UNSUPPORTED_FREIGHT_MODE'));
});
