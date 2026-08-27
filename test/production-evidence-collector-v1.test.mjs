import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryStorageAdapter} from '../production-storage-adapter-v1.js';
import {createWorkerTelemetrySnapshot} from '../production-worker-telemetry-evidence-v1.js';
import {createLatencySnapshot} from '../production-latency-evidence-v1.js';
import {collectProductionEvidence} from '../production-evidence-collector-v1.js';

const observedAt='2026-08-27T12:00:00.000Z';

function localInput(){
  return{
    collectedAt:observedAt,
    checkpoint:{runId:'local-run',sequence:1,processedCount:100,canonicalCount:100,cursor:'100',ingestionFingerprint:'local',artifactContentSha256:'a'.repeat(64)},
    workerTelemetrySnapshot:createWorkerTelemetrySnapshot({observedAt,collectorVersion:'collector-v1',runtimeRef:'local-runtime',workers:[{id:'w1',status:'HEALTHY',heartbeatAt:observedAt,processed:100,failed:0,queueDepth:0,oldestMessageAgeMs:0}]}),
    workerTelemetryAttestation:{},
    latencySnapshot:createLatencySnapshot({observedAt,collectorVersion:'collector-v1',runtimeRef:'local-runtime',operation:'INGEST',surface:'PIPELINE',samplesMs:Array.from({length:100},(_,i)=>i+1)}),
    latencyAttestation:{},
    inventory:{canonicalCount:100,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,observedAt}
  };
}

test('local collector persists checkpoint but stays fail-closed for production',async()=>{
  const report=await collectProductionEvidence(localInput(),{storageAdapter:createMemoryStorageAdapter()});
  assert.equal(report.checkpointReceipt.localRestoreVerified,true);
  assert.equal(report.checkpointReceipt.productionPersistenceVerified,false);
  assert.equal(report.bundle.workerTelemetryEvidence.queuesStable,false);
  assert.equal(report.bundle.latencyEvidence.productionP95Verified,false);
  assert.equal(report.productionEvidenceComplete,false);
  assert.equal(report.progressiveScale.decision,'HOLD_PROGRESSIVE_SCALE');
  assert.equal(report.providerDataSpendEur,0);
  assert.equal(report.paidDataCallsTriggered,0);
  assert.equal(report.purchaseAuthorized,false);
  assert.equal(report.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('synthetic/local inventory cannot authorize 10K even with a large declared count',async()=>{
  const input=localInput();
  input.inventory.canonicalCount=10000;
  const report=await collectProductionEvidence(input,{storageAdapter:createMemoryStorageAdapter()});
  assert.equal(report.progressiveScale.stages[0].stageAuthorized,false);
  assert.ok(report.progressiveScale.stages[0].failed.includes('PRODUCTION_OBSERVATION_REQUIRED'));
  assert.ok(report.progressiveScale.stages[0].failed.includes('REAL_CANONICAL_PRODUCT_INVENTORY_REQUIRED'));
});

test('collector requires a storage adapter',async()=>{
  await assert.rejects(()=>collectProductionEvidence(localInput(),{}),/STORAGE_ADAPTER_REQUIRED/);
});
