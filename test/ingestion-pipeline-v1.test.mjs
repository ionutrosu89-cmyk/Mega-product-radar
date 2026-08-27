import test from 'node:test';
import assert from 'node:assert/strict';
import {processIngestionEvents, verifyReplay} from '../ingestion-pipeline-v1.js';

const rights={status:'ANALYSIS_ALLOWED',basis:'TEST_REVIEW',reviewedAt:'2026-08-27T00:00:00.000Z',evidenceRef:'TEST_ONLY'};
const observation=(externalId,extra={})=>({
  sourceKey:'TEST_SOURCE',platform:'AMAZON',marketplace:'AMAZON',externalId,
  title:`Product ${externalId}`,url:`https://example.com/${externalId}`,
  observedAt:'2026-08-27T00:00:00.000Z',contentSha256:'a'.repeat(64),
  salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,...extra
});
const options={sourceRightsOverride:rights,collector:'test',parserVersion:'test-v1'};

test('accepted ingestion event reaches canonical batch',()=>{
  const out=processIngestionEvents([{runId:'r1',observation:observation('B000000001')}],options);
  assert.equal(out.manifest.policyAcceptedCount,1);
  assert.equal(out.manifest.canonicalCount,1);
  assert.equal(out.events[0].policy.decision,'ACCEPT');
});

test('paid data activity is held before canonicalization',()=>{
  const out=processIngestionEvents([{runId:'r1',paidDataCallsTriggered:1,observation:observation('B000000002')}],options);
  assert.equal(out.events[0].policy.decision,'HOLD');
  assert.equal(out.manifest.canonicalCount,0);
});

test('purchase authorization is held before canonicalization',()=>{
  const out=processIngestionEvents([{runId:'r1',purchaseAuthorized:true,observation:observation('B000000003')}],options);
  assert.equal(out.events[0].policy.decision,'HOLD');
  assert.equal(out.manifest.canonicalCount,0);
});

test('unsupported verified sales claim is held before canonicalization',()=>{
  const out=processIngestionEvents([{runId:'r1',observation:observation('B000000004',{salesEvidenceClass:'VERIFIED_SALES'})}],options);
  assert.equal(out.events[0].policy.decision,'HOLD');
  assert.equal(out.manifest.canonicalCount,0);
});

test('logical duplicate does not inflate canonical count',()=>{
  const events=[
    {runId:'r1',observation:observation('B000000005')},
    {runId:'r1',observation:observation('B000000005',{title:'Duplicate row'})}
  ];
  const out=processIngestionEvents(events,options);
  assert.equal(out.manifest.policyAcceptedCount,2);
  assert.equal(out.manifest.canonicalCount,1);
  assert.equal(out.manifest.logicalDuplicateCount,1);
});

test('same input produces deterministic ingestion replay fingerprint',()=>{
  const events=[{runId:'r1',collectedAt:'2026-08-27T01:00:00.000Z',observation:observation('B000000006')}];
  const first=processIngestionEvents(events,options);
  const second=processIngestionEvents(events,options);
  assert.equal(verifyReplay(first,second).deterministic,true);
});
