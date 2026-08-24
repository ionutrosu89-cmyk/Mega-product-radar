import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiscoverIntelligence,discoverPortfolioSummary} from '../discover-intelligence-hub.js';

const quotes=[
  {productKey:'desk-hook',supplierKey:'s1',quantity:30,unitPrice:3.99,currency:'USD',ddpTotal:139.67,ddpUnit:4.6557,evidenceLevel:'SUPPLIER_STATED'},
  {productKey:'desk-hook',supplierKey:'s2',quantity:50,unitPrice:3.5,currency:'USD',ddpTotal:200,ddpUnit:4,evidenceLevel:'DOCUMENTED'},
  {productKey:'desk-hook',supplierKey:'s3',quantity:100,unitPrice:3.2,currency:'USD',ddpTotal:380,ddpUnit:3.8,evidenceLevel:'MANUALLY_VERIFIED'}
];

test('Discover joins market context supplier benchmark and economics scenarios',()=>{
  const d=buildDiscoverIntelligence({product:{productKey:'desk-hook',title:'Desk Hook',marketScore:72,salesEvidenceClass:'ESTIMATED'},supplierQuotes:quotes,sellPriceRon:89.9,fxToRon:4.6});
  assert.equal(d.supplierIntelligence.quoteCount,3);
  assert.equal(d.readiness.supplierSample,'BENCHMARK_SAMPLE');
  assert.equal(d.readiness.economicsScenarios,3);
  assert.ok(d.supplierIntelligence.benchmark.ddpUnit.median>0);
  assert.equal(d.policy.purchaseAuthorized,false);
  assert.equal(d.policy.landedConfirmed,false);
});

test('missing FX stays incomplete instead of inventing RON economics',()=>{
  const d=buildDiscoverIntelligence({product:{productKey:'desk-hook'},supplierQuotes:quotes,sellPriceRon:89.9});
  assert.equal(d.readiness.fxRequired,true);
  assert.equal(d.readiness.economicsScenarios,0);
  for(const q of d.supplierIntelligence.quotes){
    assert.equal(q.ddpUnitRon,null);
    assert.equal(q.economics.status,'INCOMPLETE');
  }
});

test('missing sell price blocks profit scenarios even with quote and FX',()=>{
  const d=buildDiscoverIntelligence({product:{productKey:'desk-hook'},supplierQuotes:quotes,fxToRon:4.6});
  assert.equal(d.readiness.sellPriceRequired,true);
  assert.equal(d.readiness.economicsScenarios,0);
});

test('supplier sample below three is explicitly early sample',()=>{
  const d=buildDiscoverIntelligence({product:{productKey:'desk-hook'},supplierQuotes:quotes.slice(0,2)});
  assert.equal(d.readiness.supplierSample,'EARLY_SAMPLE');
  assert.equal(d.policy.purchaseAuthorized,false);
});

test('portfolio summary measures intelligence coverage only',()=>{
  const a=buildDiscoverIntelligence({product:{productKey:'desk-hook'},supplierQuotes:quotes,sellPriceRon:89.9,fxToRon:4.6});
  const b=buildDiscoverIntelligence({product:{productKey:'other'},supplierQuotes:quotes});
  const s=discoverPortfolioSummary([a,b]);
  assert.equal(s.products,2);
  assert.equal(s.withSupplierData,1);
  assert.equal(s.withBenchmarkSample,1);
  assert.equal(s.withEconomicsScenario,1);
  assert.equal(s.purchaseAuthorized,false);
});
