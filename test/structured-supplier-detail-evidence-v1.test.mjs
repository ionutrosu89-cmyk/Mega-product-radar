import assert from 'node:assert/strict';
import test from 'node:test';
import {adaptStructuredSupplierDetailEvidence} from '../structured-supplier-detail-evidence-v1.js';

test('maps structured Alibaba specifications into fingerprint evidence without inventing unknowns',()=>{
  const x=adaptStructuredSupplierDetailEvidence({
    title:'Mesh Desk Organizer With File Holder 5-Tier Paper Letter Tray Organizer Drawer 2 Pen Holder',
    category:'Desk Sets',
    specifications:{Material:'Steel Mesh','Product Size':'13.8 x 11 x 12 inches','Net Weight':'2.5 kg','Package Quantity':'1 pack'},
    productDetails:[{name:'Feature',value:'5 tier with 2 pen holders and 1 drawer'}]
  });
  assert.equal(x.fingerprintEvidence.productType,'desk organizer');
  assert.equal(x.fingerprintEvidence.primaryFunction,'organize desk supplies');
  assert.equal(x.fingerprintEvidence.material,'metal mesh');
  assert.deepEqual(x.fingerprintEvidence.dimensions,{lengthCm:35.052,widthCm:27.94,heightCm:30.48});
  assert.equal(x.fingerprintEvidence.unitWeightGrams,2500);
  assert.equal(x.fingerprintEvidence.packCount,1);
  assert.equal(x.fingerprintEvidence.technicalSpecs.tiers,5);
  assert.equal(x.fingerprintEvidence.technicalSpecs.penHolders,2);
  assert.equal(x.truthPolicy.unknownEqualsZero,false);
});

test('leaves missing detail fields unknown',()=>{
  const x=adaptStructuredSupplierDetailEvidence({title:'Desk organizer'});
  assert.equal(x.fingerprintEvidence.material,null);
  assert.equal(x.fingerprintEvidence.dimensions,null);
  assert.equal(x.fingerprintEvidence.unitWeightGrams,null);
  assert.equal(x.fingerprintEvidence.packCount,null);
});
