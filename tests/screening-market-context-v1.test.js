import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScreeningMarketContext} from '../screening-market-context-v1.js';

test('blocks US sell evidence from being screened as Romania sell evidence',()=>{
  const r=validateScreeningMarketContext({marketplaceMarket:'US',targetSellMarket:'RO',taxJurisdiction:'RO',marketplaceFeeMarket:'RO'});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('SELL_PRICE_MARKET_MISMATCH'));
  assert.ok(r.blockers.includes('MARKETPLACE_FEE_MARKET_MISMATCH'));
});

test('accepts a coherent single-market screening context',()=>{
  const r=validateScreeningMarketContext({marketplaceMarket:'US',targetSellMarket:'US',taxJurisdiction:'US',marketplaceFeeMarket:'US'});
  assert.equal(r.status,'COHERENT');
  assert.deepEqual(r.blockers,[]);
});

test('unknown market fields fail closed',()=>{
  const r=validateScreeningMarketContext({});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('MARKETPLACE_MARKET_REQUIRED'));
  assert.ok(r.blockers.includes('TARGET_SELL_MARKET_REQUIRED'));
});
