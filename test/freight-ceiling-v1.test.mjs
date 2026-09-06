import test from 'node:test';
import assert from 'node:assert/strict';
import {freightCeilingV1} from '../freight-ceiling-v1.js';

test('39 RON is too low for the car holder before freight at conservative public supplier price',()=>{
 const r=freightCeilingV1({quantity:30,goodsCostPerUnitRon:.75*4.5199,sellPriceGrossRon:39,minMarginPct:20,minRoiPct:45});
 assert.equal(r.decision,'CURRENT_PRICE_TOO_LOW_BEFORE_FREIGHT');
 assert.equal(r.currentPriceEligibleBeforeFreight,false);
 assert.ok(r.minimumSellPriceGrossAtGoodsOnlyRon>39);
});

test('higher selling price creates positive freight headroom',()=>{
 const r=freightCeilingV1({quantity:30,goodsCostPerUnitRon:.75*4.5199,sellPriceGrossRon:49.99,minMarginPct:20,minRoiPct:45});
 assert.equal(r.decision,'FREIGHT_CEILING_AVAILABLE');
 assert.ok(r.maxEligibleFreightTotalRon>0);
});
