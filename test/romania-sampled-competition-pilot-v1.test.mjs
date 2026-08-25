import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveRomaniaSampledCompetition} from '../romania-sampled-competition-v1.js';

const pilot=JSON.parse(fs.readFileSync(new URL('../data/romania-sampled-competition-pilot-v1.json',import.meta.url),'utf8'));

test('real pilot produces only single-platform preliminary estimates',()=>{
  assert.equal(pilot.rows.length,2);
  for(const row of pilot.rows){
    const out=deriveRomaniaSampledCompetition(row);
    assert.equal(out.eligibleForSampledSignal,true);
    assert.equal(out.exactComparableCount,false);
    assert.equal(out.romaniaGapExactGateSatisfied,false);
    assert.deepEqual(out.allowedFunnelUse,['DISCOVERED','PROMISING']);
    assert.ok(out.forbiddenFunnelUse.includes('FINALIST'));
  }
});

test('real trunk and packing samples preserve observed purities',()=>{
  const trunk=deriveRomaniaSampledCompetition(pilot.rows.find(x=>x.nicheKey==='automotive:trunk-organization'));
  const packing=deriveRomaniaSampledCompetition(pilot.rows.find(x=>x.nicheKey==='travel:packing-cubes'));
  assert.equal(trunk.samplePurity,0.25);
  assert.equal(trunk.canonicalListingEstimate,128);
  assert.equal(packing.samplePurity,0.6);
  assert.equal(packing.canonicalListingEstimate,394);
  assert.equal(pilot.paidCallsTriggered,0);
  assert.equal(pilot.purchaseAuthorized,false);
});
