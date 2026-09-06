import test from 'node:test';
import assert from 'node:assert/strict';
import {customsRepresentationHeadroomV1} from '../customs-representation-headroom-v1.js';

test('cross-service Posta and DHL benchmarks remain context only',()=>{
 const r=customsRepresentationHeadroomV1({
   residualLocalCostCeilingTotalRon:183,
   publicBenchmarks:[
    {provider:'Posta',serviceScope:'POSTAL_H1',amountRon:170,applicableDirectlyToSeaLcl:false},
    {provider:'DHL',serviceScope:'EXPRESS',amountRon:49,applicableDirectlyToSeaLcl:false}
   ]
 });
 assert.equal(r.status,'CALCULATED_REFERENCE');
 assert.equal(r.directSeaLclConclusion,'UNKNOWN_NO_DIRECT_LCL_BENCHMARK');
 assert.equal(r.rows.find(x=>x.provider==='Posta').residualAfterBenchmarkRon,13);
 assert.equal(r.purchaseAuthorized,false);
});

test('scope-compatible benchmark can be evaluated against ceiling',()=>{
 const r=customsRepresentationHeadroomV1({
   residualLocalCostCeilingTotalRon:183,
   publicBenchmarks:[{provider:'LCL Broker',serviceScope:'SEA_LCL',amountRon:150,applicableDirectlyToSeaLcl:true}]
 });
 assert.equal(r.directSeaLclConclusion,'AT_LEAST_ONE_PUBLIC_LCL_BENCHMARK_FITS');
});
