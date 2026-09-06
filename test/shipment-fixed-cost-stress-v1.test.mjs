import test from 'node:test';
import assert from 'node:assert/strict';
import {shipmentFixedCostStressV1} from '../shipment-fixed-cost-stress-v1.js';

test('larger quantity tolerates larger fixed shipment cost',()=>{
 const r=shipmentFixedCostStressV1({
   quantities:[30,300],
   sellPricesRon:[49.99],
   goodsCostPerUnitRon:3.3899,
   screeningFreightPerUnitRon:0.0724,
   variableUnknownImportCostPerUnitRon:.5,
   fixedShipmentCostScenariosRon:[50,100,200,300,500]
 });
 const a=r.maxFixedPassingByQuantityPrice['30']['49.99'];
 const b=r.maxFixedPassingByQuantityPrice['300']['49.99'];
 assert.ok(b&&(!a||b.maxFixedShipmentCostScenarioRon>a.maxFixedShipmentCostScenarioRon));
 assert.equal(r.purchaseAuthorized,false);
});

test('fixed stress rows are never confirmed landed cost',()=>{
 const r=shipmentFixedCostStressV1({quantities:[30],sellPricesRon:[49.99],goodsCostPerUnitRon:3.4,screeningFreightPerUnitRon:.1});
 assert.ok(r.rows.every(x=>x.truth==='HYPOTHETICAL_FIXED_SHIPMENT_COST_STRESS'));
});
