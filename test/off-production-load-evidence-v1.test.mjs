import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOffProductionLoadEvidence,parseContentRangeTotal} from '../off-production-load-evidence-v1.js';

test('content-range parser extracts exact total',()=>{
  assert.equal(parseContentRangeTotal('0-0/10000'),10000);
  assert.equal(parseContentRangeTotal('*/0'),0);
  assert.equal(parseContentRangeTotal(''),null);
});

test('10K production load evidence requires identity and provenance coverage',()=>{
  const out=evaluateOffProductionLoadEvidence({target:10000,canonicalGtinProducts:10000,offGtinIdentities:10000,offSourceRecords:10000,offClaims:30000});
  assert.equal(out.decision,'TEN_K_PRODUCTION_LOAD_VERIFIED');
  assert.equal(out.productionCatalogWriteVerified,true);
  assert.equal(out.productionScaleAuthorized,false);
  assert.equal(out.commercialUseAuthorized,false);
  assert.equal(out.providerDataSpendEur,0);
  assert.equal(out.paidDataCallsTriggered,0);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.verifiedSalesRows,0);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('missing provenance fails closed',()=>{
  const out=evaluateOffProductionLoadEvidence({target:10000,canonicalGtinProducts:10000,offGtinIdentities:10000,offSourceRecords:9999,offClaims:30000});
  assert.equal(out.decision,'HOLD_10K_PRODUCTION_LOAD');
  assert.ok(out.reasons.includes('OFF_SOURCE_RECORDS_BELOW_TARGET'));
  assert.equal(out.productionCatalogWriteVerified,false);
});
