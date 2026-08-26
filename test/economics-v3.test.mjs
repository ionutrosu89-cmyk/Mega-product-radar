import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEconomicsV3,ECONOMICS_COST_KEYS_V3} from '../economics-v3.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ev=value=>({value,evidenceClass:'MANUALLY_VERIFIED',observedAt:'2026-08-26T10:00:00Z',source:'MANUAL_COST_EVIDENCE'});
const costs=()=>({supplierUnitCost:ev(20),internationalFreightPerUnit:ev(4),customsPerUnit:ev(1),brokerPerUnit:ev(0.5),vatPerUnit:ev(0),domesticLogisticsPerUnit:ev(1.5),packagingPerUnit:ev(1),marketplaceFeePct:ev(12),fulfillmentPerUnit:ev(3),returnsPct:ev(4),adsPct:ev(8),paymentFeePct:ev(2),warrantyPct:ev(1)});
const quote={quoteId:'q1',canonicalProductId:A,unitPrice:20,evidenceClass:'MANUALLY_VERIFIED',observedAt:'2026-08-26T10:00:00Z',source:'QUOTE'};

test('complete strong evidence calculates best base worst and can pass margin gate',()=>{
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:costs(),sellPrice:80});
 assert.equal(r.status,'PASS');assert.equal(r.scenarios.length,3);assert.ok(r.scenarios.every(x=>x.status==='CALCULATED'));assert.ok(r.breakEvenSupplierUnitCost>0);assert.equal(r.purchaseAuthorized,false);
});

test('unknown critical cost fails closed instead of assuming zero',()=>{
 const c=costs();delete c.customsPerUnit;
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:c,sellPrice:80});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.unknownCosts.includes('customsPerUnit'));assert.ok(r.blockers.includes('CRITICAL_COSTS_UNKNOWN'));
});

test('heuristic critical cost cannot confirm economics',()=>{
 const c=costs();c.adsPct={value:8,evidenceClass:'HEURISTIC',observedAt:'2026-08-26T10:00:00Z',source:'GUESS'};
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:c,sellPrice:80});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.weakCriticalEvidence.includes('adsPct'));
});

test('supplier quote from another canonical product is rejected',()=>{
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:{...quote,canonicalProductId:B},costEvidence:costs(),sellPrice:80});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.equal(r.supplierQuoteMatches,false);assert.ok(r.blockers.includes('SUPPLIER_QUOTE_PRODUCT_MISMATCH'));
});

test('missing target sell price keeps economics unknown',()=>{
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:costs()});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.blockers.includes('TARGET_SELL_PRICE_REQUIRED'));
});

test('low margin is REVIEW not PASS',()=>{
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:costs(),sellPrice:45});
 assert.equal(r.status,'REVIEW');assert.ok(r.blockers.includes('MARGIN_BELOW_TARGET'));assert.equal(r.economicsConfirmed,false);
});

test('negative cost input is invalid rather than treated as favorable economics',()=>{
 const c=costs();c.freightPerUnit=ev(-1);c.internationalFreightPerUnit=ev(-1);
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:c,sellPrice:80});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.invalidCosts.includes('internationalFreightPerUnit'));
});

test('all canonical cost keys are mandatory evidence inputs',()=>{
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:{},sellPrice:80});
 assert.deepEqual([...r.unknownCosts].sort(),[...ECONOMICS_COST_KEYS_V3].sort());
});

test('scenario overrides are explicit and do not mutate base evidence',()=>{
 const c=costs();const before=JSON.stringify(c);
 const r=analyzeEconomicsV3({canonicalProductId:A,supplierQuote:quote,costEvidence:c,sellPrice:80,scenarioAssumptions:{WORST:{internationalFreightPerUnit:10}}});
 assert.equal(r.scenarios.find(x=>x.scenario==='WORST').values.internationalFreightPerUnit,10);assert.equal(JSON.stringify(c),before);
});
