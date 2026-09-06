import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMarketProfile,getMarketProfile} from '../market-profiles-v1.js';

test('Romania is the only active launch market and VAT remains configuration',()=>{
  const ro=activeMarketProfile();
  assert.equal(ro.code,'RO');
  assert.equal(ro.active,true);
  assert.equal(ro.importVatRatePct,21);
  assert.equal(ro.sellVatRatePct,21);
  assert.match(ro.vatSourceUrl,/anaf\.ro/);
  assert.match(ro.customsTaricUrl,/taxation-customs\.ec\.europa\.eu/);
  assert.equal(ro.vatSourceStatus,'OFFICIAL_SOURCE_VERIFIED');
});

test('future market shells cannot silently invent tax rates',()=>{
  assert.equal(getMarketProfile('DE').active,false);
  assert.equal(getMarketProfile('DE').importVatRatePct,null);
  assert.equal(getMarketProfile('XX'),null);
});
