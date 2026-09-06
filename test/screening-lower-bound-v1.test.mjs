import test from 'node:test';
import assert from 'node:assert/strict';
import {screeningLowerBoundV1} from '../screening-lower-bound-v1.js';

test('negative profit even at cost floor safely rejects transport method',()=>{
 const r=screeningLowerBoundV1({quantity:30,publicUnitPriceForeign:.75,fxToRon:4.5199,freightKnownFloorRon:703.66,sellPriceGrossRon:39});
 assert.equal(r.status,'CALCULATED_LOWER_BOUND');
 assert.equal(r.decision,'REJECT_TRANSPORT_METHOD_AT_CURRENT_PRICE');
 assert.ok(r.profitUpperBoundPerUnitRon<0);
 assert.equal(r.purchaseAuthorized,false);
});

test('positive lower-bound profit remains only potentially feasible',()=>{
 const r=screeningLowerBoundV1({quantity:30,publicUnitPriceForeign:.75,fxToRon:4.5199,freightKnownFloorRon:100,sellPriceGrossRon:60});
 assert.equal(r.decision,'POTENTIALLY_FEASIBLE_MORE_COSTS_REQUIRED');
 assert.ok(r.profitUpperBoundPerUnitRon>0);
});
