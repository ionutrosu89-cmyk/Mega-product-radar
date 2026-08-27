import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_OFF_CSV_URL,
  assertOfficialOffSource,
  buildHeaderIndex,
  projectOffTsvLine,
  summarizeOfficialOffPilot
} from '../open-food-facts-stream-pilot-v1.js';

test('official source is pinned to Open Food Facts bulk export',()=>{
  assert.equal(assertOfficialOffSource(OFFICIAL_OFF_CSV_URL),true);
  assert.throws(()=>assertOfficialOffSource('https://example.com/data.csv.gz'),/OFFICIAL_OFF_SOURCE_REQUIRED/);
});

test('header projection requires explicit catalogue fields',()=>{
  const header='code\tproduct_name\tbrands\tcategories\timage_front_url\timage_url\tquantity\tcountries\tnutriscore_grade\tlast_modified_datetime';
  const index=buildHeaderIndex(header);
  assert.equal(index.valid,true);
  const row=projectOffTsvLine('4006381333931\tAlpha\tAcme\tFood\thttps://a\thttps://b\t1 kg\tRomania\ta\t2026-08-27T00:00:00Z',index);
  assert.equal(row.code,'4006381333931');
  assert.equal(row.product_name,'Alpha');
});

test('missing required columns fail closed',()=>{
  const index=buildHeaderIndex('code\tproduct_name');
  assert.equal(index.valid,false);
  assert.ok(index.missing.includes('brands'));
  assert.equal(projectOffTsvLine('4006381333931\tAlpha',index),null);
});

test('pilot summary remains zero-cost and does not authorize commercial use',()=>{
  const rows=Array.from({length:3},(_,i)=>({code:String(4006381333931+i),product_name:`P${i}`}));
  const out=summarizeOfficialOffPilot({rows,minRows:10});
  assert.equal(out.decision,'HOLD_PILOT_SAMPLE');
  assert.equal(out.policy.providerDataSpendEur,0);
  assert.equal(out.policy.paidDataCallsTriggered,0);
  assert.equal(out.policy.purchaseAuthorized,false);
  assert.equal(out.policy.verifiedSalesRows,0);
  assert.equal(out.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.policy.commercialUseAuthorized,false);
});

test('pilot sample decision only reflects projected row threshold',()=>{
  const rows=Array.from({length:10},(_,i)=>({code:String(4006381333931+i),product_name:`P${i}`}));
  const out=summarizeOfficialOffPilot({rows,minRows:10});
  assert.equal(out.decision,'PILOT_SAMPLE_ACQUIRED');
  assert.equal(out.metrics.projectedRows,10);
  assert.match(out.projectedRowsSha256,/^[a-f0-9]{64}$/);
});
