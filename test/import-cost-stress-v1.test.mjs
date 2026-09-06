import test from 'node:test';
import assert from 'node:assert/strict';
import {importCostStressV1} from '../import-cost-stress-v1.js';

test('stress engine distinguishes tight observed price from stronger stretch scenario',()=>{
 const r=importCostStressV1({
   quantities:[300],
   sellPricesRon:[44.74,49.99],
   goodsCostPerUnitRon:3.3899,
   screeningFreightPerUnitRon:0.0724,
   unknownImportCostPerUnitScenariosRon:[0.1,0.5,1,2,3]
 });
 assert.equal(r.status,'CALCULATED_SCREENING');
 const p44=r.maxPassingStressByQuantityPrice['300']['44.74'];
 const p49=r.maxPassingStressByQuantityPrice['300']['49.99'];
 assert.ok(p44===null||p44.maxStressReservePerUnitRon<=0.5);
 assert.ok(p49&&p49.maxStressReservePerUnitRon>=1);
});

test('stress scenarios never authorize purchase',()=>{
 const r=importCostStressV1({quantities:[30],sellPricesRon:[49.99],goodsCostPerUnitRon:3.4,screeningFreightPerUnitRon:.1});
 assert.equal(r.purchaseAuthorized,false);
 assert.ok(r.rows.every(x=>x.truth==='STRESS_SCENARIO_NOT_CONFIRMED_LANDED_COST'));
});
