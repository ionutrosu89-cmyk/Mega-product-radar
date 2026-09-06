import test from 'node:test';
import assert from 'node:assert/strict';
import {conservativeLandedEnvelopeV1} from '../conservative-landed-envelope-v1.js';

test('conservative envelope keeps VAT recoverability and duty sensitivity separate',()=>{
 const r=conservativeLandedEnvelopeV1({
  quantity:300,unitGoodsCostRon:3.3899,skuChargeableMeasure:.021,consolidatedTotalMeasure:1.000902,
  shipmentLogisticsBeforeDutyVatRon:971.78,dutyRateScenariosPct:[3,6.5,10],importVatRatePct:21,
  sellPricesRon:[44.74,49.99]
 });
 assert.equal(r.status,'CALCULATED_SCREENING');
 assert.ok(r.allocatedLogisticsRon>20&&r.allocatedLogisticsRon<21);
 const rec=r.rows.find(x=>x.dutyRateScenarioPct===6.5&&x.vatTreatment==='RECOVERABLE'&&x.sellPriceGrossRon===49.99);
 const non=r.rows.find(x=>x.dutyRateScenarioPct===6.5&&x.vatTreatment==='NON_RECOVERABLE'&&x.sellPriceGrossRon===49.99);
 assert.ok(rec.economicLandedPerUnitRon<non.economicLandedPerUnitRon);
 assert.ok(rec.cashLandedPerUnitRon===non.cashLandedPerUnitRon);
 assert.equal(r.purchaseAuthorized,false);
});

test('screening envelope never labels result confirmed landed cost',()=>{
 const r=conservativeLandedEnvelopeV1({
  quantity:300,unitGoodsCostRon:3.4,skuChargeableMeasure:.021,consolidatedTotalMeasure:1,
  shipmentLogisticsBeforeDutyVatRon:972,sellPricesRon:[49.99]
 });
 assert.ok(r.rows.every(x=>x.truth.includes('NOT_CONFIRMED_LANDED_COST')));
});
