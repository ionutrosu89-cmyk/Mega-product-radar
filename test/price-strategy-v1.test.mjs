import test from 'node:test';
import assert from 'node:assert/strict';
import {priceStrategyV1} from '../price-strategy-v1.js';

test('prefers highest viable observed market price over invented stretch price',()=>{
 const r=priceStrategyV1({quantity:300,goodsCostPerUnitRon:3.3899,observedPricesRon:[10.5,39,44.74],allocatedFreightTotalRon:21.71,stretchPricesRon:[49.99]});
 assert.equal(r.status,'SCREENING_PRICE_AVAILABLE');
 assert.equal(r.primaryPrice.sellPriceGrossRon,44.74);
 assert.equal(r.primaryPrice.observedMarketPrice,true);
 assert.ok(r.primaryPrice.remainingImportCostAllowanceRon>0);
});

test('price that fails before freight is rejected',()=>{
 const r=priceStrategyV1({quantity:300,goodsCostPerUnitRon:3.3899,observedPricesRon:[39],allocatedFreightTotalRon:0});
 assert.equal(r.scenarios[0].status,'REJECT_PRICE_BEFORE_FREIGHT');
});
