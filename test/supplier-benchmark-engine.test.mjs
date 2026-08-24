import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkSupplierQuotes,classifyQuoteAgainstBenchmark} from '../supplier-benchmark-engine.js';

test('builds benchmarks without authorizing purchase',()=>{
  const rows=[
    {productKey:'p1',supplierKey:'a',unitPrice:1,ddpUnit:2,ddpTotal:20,ddpShipping:10,evidenceLevel:'SUPPLIER_STATED',mrnPromised:true,vatProofPromised:true,tradeAssurance:true,preShipmentInspectionAccepted:true},
    {productKey:'p1',supplierKey:'b',unitPrice:1.2,ddpUnit:3,ddpTotal:30,ddpShipping:12,evidenceLevel:'DOCUMENTED',mrnPromised:true,vatProofPromised:true,tradeAssurance:false,preShipmentInspectionAccepted:false},
    {productKey:'p1',supplierKey:'c',unitPrice:0.9,ddpUnit:4,ddpTotal:40,ddpShipping:16,evidenceLevel:'SUPPLIER_STATED'}
  ];
  const [b]=benchmarkSupplierQuotes(rows);
  assert.equal(b.quoteCount,3);
  assert.equal(b.completeDdpQuoteCount,3);
  assert.equal(b.ddpUnit.median,3);
  assert.equal(b.confidence,'LOW_MEDIUM');
  assert.equal(b.decisionUse,'INTELLIGENCE_ONLY');
  assert.equal(b.purchaseAuthorized,false);
  assert.equal(b.evidence.documentaryPct,33.3);
});

test('classifies quote only against the observed sample',()=>{
  const benchmark={ddpUnit:{median:4}};
  assert.equal(classifyQuoteAgainstBenchmark({ddpUnit:3},benchmark).classification,'CHEAP_VS_SAMPLE');
  assert.equal(classifyQuoteAgainstBenchmark({ddpUnit:4.2},benchmark).classification,'NORMAL');
  assert.equal(classifyQuoteAgainstBenchmark({ddpUnit:5},benchmark).classification,'EXPENSIVE_VS_SAMPLE');
});

test('never invents a benchmark from incomplete quotes',()=>{
  const [b]=benchmarkSupplierQuotes([{productKey:'p2',supplierKey:'x',ddpShipping:80}]);
  assert.equal(b.completeDdpQuoteCount,0);
  assert.equal(b.ddpUnit.median,null);
  assert.equal(classifyQuoteAgainstBenchmark({ddpUnit:2},b).classification,'INSUFFICIENT_DATA');
});
