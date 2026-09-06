import test from 'node:test';
import assert from 'node:assert/strict';
import {seaLclChargeableMeasure,consolidationAllocatorV1,consolidationOpportunityV1} from '../consolidation-engine-v1.js';

test('sea LCL chargeable measure uses greater of CBM and metric tonnes',()=>{
 assert.equal(seaLclChargeableMeasure({volumeM3:.5,grossWeightKg:800}).revenueTon,.8);
 assert.equal(seaLclChargeableMeasure({volumeM3:.5,grossWeightKg:100}).revenueTon,.5);
});

test('small SKU alone pays shipment minimum but consolidation can share it',()=>{
 const o=consolidationOpportunityV1({itemMeasure:.021,minimumBillableMeasure:1,minimumShipmentCost:197});
 assert.equal(o.soloMinimumCost,197);
 assert.equal(o.allocatedCostIfMinimumIsFullyShared,4.14);
 assert.equal(o.fillRequiredFromOtherSkus,.979);
});

test('allocator spreads minimum shipment cost across consolidated SKU measures',()=>{
 const r=consolidationAllocatorV1({minimumBillableMeasure:1,ratePerMeasure:197,items:[
  {id:'small',volumeM3:.021,grossWeightKg:10},
  {id:'other',volumeM3:.979,grossWeightKg:100}
 ]});
 assert.equal(r.billableMeasure,1);
 assert.equal(r.allocationTruth,'FULL_MEASURE');
 assert.ok(r.items.find(x=>x.id==='small').allocatedShipmentCost<10);
});
