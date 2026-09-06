import test from 'node:test';
import assert from 'node:assert/strict';
import {getCarrierProfile,resolveCarrierDivisor} from '../carrier-profiles-v1.js';

test('Romania carrier profiles expose official dimensional divisor references',()=>{
  for(const code of ['DHL_EXPRESS','UPS','FEDEX']){
    const p=getCarrierProfile(code);
    assert.ok(p);
    assert.equal(p.market,'RO');
    assert.equal(p.volumetricDivisorCm3PerKg,5000);
    assert.equal(p.sourceClass,'OFFICIAL_CARRIER');
    assert.match(p.sourceUrl,/^https:\/\//);
  }
});

test('explicit carrier divisor override wins and unknown carrier stays unknown',()=>{
  assert.equal(resolveCarrierDivisor('UPS',6000).divisor,6000);
  assert.equal(resolveCarrierDivisor('UPS').source,'OFFICIAL_CARRIER_PROFILE');
  assert.equal(resolveCarrierDivisor('UNKNOWN').divisor,null);
});
