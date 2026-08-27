import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCanonicalBatch} from '../data-pipeline-core-v1.js';
import {
  percentile,
  summarizeLatency,
  evaluateQueueHealth,
  verifyArtifactRestore,
  buildOperationalScaleEvidence
} from '../operational-scale-observability-v1.js';

test('percentile and latency summary are deterministic',()=>{
  assert.equal(percentile([1,2,3,4,5],95),5);
  const summary=summarizeLatency([10,20,30,40],{p95LimitMs:50});
  assert.equal(summary.p50Ms,20);
  assert.equal(summary.p95Ms,40);
  assert.equal(summary.p95Acceptable,true);
});

test('local queue health cannot be promoted to production stable',()=>{
  const q=evaluateQueueHealth({depth:0,oldestAgeMs:0,processed:100,failed:0,observationMode:'LOCAL_SIMULATION'});
  assert.equal(q.locallyHealthy,true);
  assert.equal(q.queuesStable,false);
  assert.equal(q.decision,'QUEUE_NOT_PROVEN');
});

test('production observed queue can be stable only within all limits',()=>{
  const healthy=evaluateQueueHealth({depth:2,oldestAgeMs:50,processed:1000,failed:1,observationMode:'PRODUCTION_OBSERVED'},{maxDepth:10,maxOldestAgeMs:1000,maxFailureRate:0.01});
  assert.equal(healthy.queuesStable,true);
  const bad=evaluateQueueHealth({depth:20,oldestAgeMs:50,processed:1000,failed:1,observationMode:'PRODUCTION_OBSERVED'},{maxDepth:10});
  assert.equal(bad.queuesStable,false);
});

test('artifact restore round trip verifies exact canonical content only',()=>{
  const batch=buildCanonicalBatch([{platform:'amazon',externalId:'B000000001',salesEvidenceClass:'NOT_VERIFIED_SALES'}]);
  const restored=JSON.parse(JSON.stringify(batch));
  const result=verifyArtifactRestore(batch,restored);
  assert.equal(result.verified,true);
  assert.equal(result.productionPersistenceVerified,false);
  restored.accepted[0].title='mutated';
  assert.equal(verifyArtifactRestore(batch,restored).verified,false);
});

test('local benchmark evidence never claims production p95, queue or restore verification',()=>{
  const evidence=buildOperationalScaleEvidence({
    benchmarkScope:'LOCAL_PROCESS_BENCHMARK',
    latencySamplesMs:[1,2,3],
    queueMetrics:{depth:0,oldestAgeMs:0,processed:3,failed:0,observationMode:'LOCAL_SIMULATION'},
    artifactRestore:{verified:true,productionPersistenceVerified:false},
    replayDeterministic:true,
    throughputEventsPerSecond:1000
  },{p95LimitMs:1000});
  assert.equal(evidence.productionClaims.p95Verified,false);
  assert.equal(evidence.productionClaims.queuesStable,false);
  assert.equal(evidence.productionClaims.restoreVerified,false);
  assert.equal(evidence.replayDeterministic,true);
});
