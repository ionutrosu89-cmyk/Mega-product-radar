import test from 'node:test';
import assert from 'node:assert/strict';
import {finalistScreeningVerdictV1} from '../finalist-screening-verdict-v1.js';

test('positive but sub-1 RON local-cost buffer is promising yet tight',()=>{
 const r=finalistScreeningVerdictV1({
  stage:'FINALIST',quantity:300,screeningPriceRon:49.99,
  residualLocalCostCeilingPerUnitRon:.61,conservativeWorstCasePass:true,
  priceInsideObservedMarketRange:true,salesReady:true,supplierPageReady:true
 });
 assert.equal(r.verdict,'PROMISING_BUT_LOCAL_COST_BUFFER_TIGHT');
 assert.equal(r.economicallyPromising,true);
 assert.equal(r.testReady,false);
 assert.equal(r.purchaseAuthorized,false);
});

test('market-unsupported price does not become robust recommendation',()=>{
 const r=finalistScreeningVerdictV1({
  stage:'FINALIST',quantity:300,screeningPriceRon:59.99,
  residualLocalCostCeilingPerUnitRon:2,conservativeWorstCasePass:true,
  priceInsideObservedMarketRange:false,salesReady:true,supplierPageReady:true
 });
 assert.equal(r.verdict,'PROMISING_PRICE_NOT_MARKET_SUPPORTED');
});
