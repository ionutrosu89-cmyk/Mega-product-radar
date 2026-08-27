import test from 'node:test';
import assert from 'node:assert/strict';
import {percentile,createLatencySnapshot,validateLatencyAttestation,evaluateLatencyEvidence} from '../production-latency-evidence-v1.js';

const samples=Array.from({length:100},(_,index)=>100+index);
const snapshotInput={
  observedAt:'2026-08-27T13:00:00Z',
  collectorVersion:'latency-collector-v1',
  runtimeRef:'runtime://prod/api-a',
  operation:'INGEST_OBSERVATION',
  surface:'INGESTION_PIPELINE',
  samplesMs:samples
};

test('percentile and latency snapshot are deterministic',()=>{
  assert.equal(percentile([1,2,3,4,5],0.95),5);
  const a=createLatencySnapshot(snapshotInput);
  const b=createLatencySnapshot({...snapshotInput,samplesMs:[...samples].reverse()});
  assert.equal(a.contentSha256,b.contentSha256);
  assert.equal(a.snapshotFingerprint,b.snapshotFingerprint);
  assert.equal(a.sampleCount,100);
  assert.equal(a.p95Ms,194);
});

test('local latency can pass local thresholds without proving production p95',()=>{
  const snapshot=createLatencySnapshot(snapshotInput);
  const evidence=evaluateLatencyEvidence({snapshot:snapshotInput,attestation:{
    schema:'MPR_LATENCY_ATTESTATION_V1',observationMode:'LOCAL_SIMULATION',environment:'local',sourceKind:'LOCAL_RUNTIME',
    evidenceRef:'local://latency',observedAt:snapshot.observedAt,collectorVersion:snapshot.collectorVersion,
    runtimeRef:snapshot.runtimeRef,operation:snapshot.operation,surface:snapshot.surface,contentSha256:snapshot.contentSha256
  }});
  assert.equal(evidence.localLatencyVerified,true);
  assert.equal(evidence.productionP95Verified,false);
  assert.equal(evidence.decision,'HOLD_PRODUCTION_P95');
});

test('insufficient samples fail closed even with acceptable values',()=>{
  const evidence=evaluateLatencyEvidence({snapshot:{...snapshotInput,samplesMs:[10,20,30]}});
  assert.equal(evidence.localLatencyVerified,false);
  assert.ok(evidence.reasons.includes('LATENCY_SAMPLE_COUNT_INSUFFICIENT'));
});

test('p95 above limit fails closed',()=>{
  const evidence=evaluateLatencyEvidence({snapshot:{...snapshotInput,samplesMs:Array.from({length:100},()=>1500)}},{p95LimitMs:1000});
  assert.equal(evidence.localLatencyVerified,false);
  assert.ok(evidence.reasons.includes('P95_LIMIT_EXCEEDED'));
});

test('production latency attestation binds hash runtime operation and surface',()=>{
  const snapshot=createLatencySnapshot(snapshotInput);
  const result=validateLatencyAttestation({
    schema:'MPR_LATENCY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_API_RUNTIME',
    evidenceRef:'artifact://prod/latency-1',observedAt:snapshot.observedAt,collectorVersion:snapshot.collectorVersion,
    runtimeRef:'runtime://prod/other',operation:snapshot.operation,surface:snapshot.surface,contentSha256:'f'.repeat(64)
  },snapshot);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('LATENCY_HASH_BINDING_MISMATCH'));
  assert.ok(result.errors.includes('LATENCY_RUNTIME_REF_MISMATCH'));
});

test('synthetic production-observed latency evidence verifies only with sufficient samples and exact bindings',()=>{
  const snapshot=createLatencySnapshot(snapshotInput);
  const evidence=evaluateLatencyEvidence({snapshot:snapshotInput,attestation:{
    schema:'MPR_LATENCY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_API_RUNTIME',
    evidenceRef:'artifact://prod/latency-1',observedAt:snapshot.observedAt,collectorVersion:snapshot.collectorVersion,
    runtimeRef:snapshot.runtimeRef,operation:snapshot.operation,surface:snapshot.surface,contentSha256:snapshot.contentSha256
  }},{p95LimitMs:1000,minSampleCount:100});
  assert.equal(evidence.productionP95Verified,true);
  assert.equal(evidence.decision,'PRODUCTION_P95_VERIFIED');
  assert.equal(evidence.providerDataSpendEur,0);
  assert.equal(evidence.paidDataCallsTriggered,0);
  assert.equal(evidence.purchaseAuthorized,false);
  assert.equal(evidence.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
