import assert from 'node:assert/strict';
import test from 'node:test';
import { ECON_DEFAULTS, buyingDecision, profitWithSettings, supplierVerification } from '../app.js';

test('Profit Calculator Pro applies configurable cost assumptions', () => {
  const p={landed:50,sell:200};
  const base=profitWithSettings(p,ECON_DEFAULTS);
  const expensive=profitWithSettings(p,{...ECON_DEFAULTS,adsRate:20,fulfillment:15,packaging:5,extraImport:10});
  assert.ok(base.profit>expensive.profit);
  assert.ok(Number.isFinite(base.margin));
  assert.ok(Number.isFinite(base.roi));
});

test('Supplier Verification stays VERIFY when only web sourcing presence exists', () => {
  const p={supplierIntel:{coverage:2},megaAnalysis:{components:{supplier:82}}};
  assert.equal(supplierVerification(p).verdict,'VERIFY');
});

test('Supplier Verification can reach SUPPLIER OK only with confirmed commercial fields', () => {
  const p={supplierIntel:{coverage:2,moq:20,sampleCost:80,rating:4.7,years:4,tradeAssurance:true,certifications:[]},megaAnalysis:{components:{supplier:90}}};
  assert.equal(supplierVerification(p).verdict,'SUPPLIER OK');
});

test('Buying engine does not emit ORDER NOW for an unverified supplier', () => {
  const p={name:'Test',cat:'Home',landed:40,sell:240,score:95,megaScore:95,action:'BUY',supplierIntel:{coverage:2},megaAnalysis:{score:95,action:'BUY',components:{supplier:90,compliance:95,romaniaGap:90,saturation:90,viral:85}}};
  assert.notEqual(buyingDecision(p).decision,'ORDER NOW');
});
