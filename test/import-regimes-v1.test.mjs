import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveImportRegime,customsTreatmentFor} from '../import-regimes-v1.js';

test('MPR defaults to B2B stock import and does not auto-apply €3 distance-sale duty',()=>{
 const r=resolveImportRegime();
 assert.equal(r.code,'B2B_STOCK_IMPORT');
 assert.equal(r.lowValueDistanceSaleFlatDutyApplicable,false);
 const c=customsTreatmentFor({regimeCode:'B2B_STOCK_IMPORT',consignmentValueEur:20});
 assert.equal(c.status,'TARIC_REQUIRED');
 assert.equal(c.flatDutyEur,null);
});

test('€3 temporary duty is isolated to qualifying low-value distance sales',()=>{
 const c=customsTreatmentFor({regimeCode:'EU_DISTANCE_SALE_LOW_VALUE',consignmentValueEur:100});
 assert.equal(c.status,'FLAT_DISTANCE_SALE_DUTY');
 assert.equal(c.flatDutyEurPerTariffItem,3);
});
