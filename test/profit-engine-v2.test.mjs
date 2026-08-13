import assert from 'node:assert/strict';
import test from 'node:test';
import {profitEngineV2} from '../profit-engine-v2.js';

test('Profit Engine V2 subtracts VAT and commercial reserves',()=>{
  const e=profitEngineV2({sell:200,landed:50});
  assert.equal(e.priceComplete,true);
  assert.ok(e.netRevenue<200);
  assert.ok(e.costs.marketplace>0);
  assert.ok(e.costs.ads>0);
  assert.ok(e.costs.returnsReserve>0);
  assert.ok(e.breakEvenSell>50);
});

test('higher landed cost lowers profit and ROI',()=>{
  const low=profitEngineV2({sell:220,landed:45});
  const high=profitEngineV2({sell:220,landed:100});
  assert.ok(low.profit>high.profit);
  assert.ok(low.roi>high.roi);
});

test('missing price data stays incomplete instead of fabricating profit',()=>{
  const e=profitEngineV2({sell:0,landed:50});
  assert.equal(e.priceComplete,false);
  assert.equal(e.profit,0);
});
