import test from 'node:test';
import assert from 'node:assert/strict';
import {residualLocalCostCeilingV1} from '../residual-local-cost-ceiling-v1.js';

test('residual local charge ceiling is positive for robust 49.99 scenario',()=>{
 const r=residualLocalCostCeilingV1({quantity:300,baseEconomicLandedPerUnitRon:4.6024,sellPriceGrossRon:49.99});
 assert.equal(r.status,'CALCULATED_SCREENING');
 assert.ok(r.maxAdditionalLocalImportCostPerUnitRon>0);
 assert.ok(r.maxAdditionalLocalImportCostTotalRon>0);
 assert.equal(r.purchaseAuthorized,false);
});

test('tight price can have near-zero residual local headroom',()=>{
 const r=residualLocalCostCeilingV1({quantity:300,baseEconomicLandedPerUnitRon:3.8037,sellPriceGrossRon:44.74});
 assert.ok(r.maxAdditionalLocalImportCostPerUnitRon<0.2);
});
