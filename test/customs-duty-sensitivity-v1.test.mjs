import test from 'node:test';
import assert from 'node:assert/strict';
import {customsDutySensitivityV1} from '../customs-duty-sensitivity-v1.js';

test('49.99 remains near threshold across plausible research duty scenarios',()=>{
 const r=customsDutySensitivityV1({
  quantity:300,sellPriceGrossRon:49.99,goodsCostPerUnitRon:3.3899,freightPerUnitRon:.0724,
  variableImportCostPerUnitRon:.5,fixedShipmentCostRon:300,dutyRateScenariosPct:[3,6.5,10]
 });
 assert.equal(r.status,'CALCULATED_SCREENING');
 assert.equal(r.rows.find(x=>x.dutyRateScenarioPct===3).passesTargets,true);
 assert.equal(r.rows.find(x=>x.dutyRateScenarioPct===6.5).passesTargets,true);
 assert.equal(r.rows.find(x=>x.dutyRateScenarioPct===10).passesTargets,false);
 assert.equal(r.purchaseAuthorized,false);
});

test('sensitivity rows never become applicable duty',()=>{
 const r=customsDutySensitivityV1({quantity:30,sellPriceGrossRon:49.99,goodsCostPerUnitRon:3.4,freightPerUnitRon:.1,dutyRateScenariosPct:[3]});
 assert.equal(r.rows[0].truth,'CLASSIFICATION_SENSITIVITY_SCENARIO_NOT_APPLICABLE_DUTY');
});
