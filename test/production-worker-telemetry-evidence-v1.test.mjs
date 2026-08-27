import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkerTelemetrySnapshot,
  validateWorkerTelemetryAttestation,
  evaluateWorkerTelemetryEvidence
} from '../production-worker-telemetry-evidence-v1.js';

const snapshotInput={
  observedAt:'2026-08-27T12:00:00Z',
  collectorVersion:'worker-telemetry-v1',
  runtimeRef:'runtime://prod/workers-a',
  workers:[
    {id:'w2',status:'HEALTHY',heartbeatAt:'2026-08-27T11:59:59Z',processed:200,failed:0,queueDepth:2,oldestMessageAgeMs:500},
    {id:'w1',status:'HEALTHY',heartbeatAt:'2026-08-27T11:59:58Z',processed:100,failed:0,queueDepth:1,oldestMessageAgeMs:250}
  ]
};

test('worker telemetry snapshot is deterministic and worker order stable',()=>{
  const a=createWorkerTelemetrySnapshot(snapshotInput);
  const b=createWorkerTelemetrySnapshot({...snapshotInput,workers:[...snapshotInput.workers].reverse()});
  assert.equal(a.contentSha256,b.contentSha256);
  assert.equal(a.snapshotFingerprint,b.snapshotFingerprint);
  assert.deepEqual(a.workers.map(x=>x.id),['w1','w2']);
});

test('local healthy telemetry cannot prove production queues stable',()=>{
  const evidence=evaluateWorkerTelemetryEvidence({snapshot:snapshotInput,attestation:{
    schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',
    observationMode:'LOCAL_SIMULATION',environment:'local',sourceKind:'LOCAL_RUNTIME',
    evidenceRef:'local://telemetry',observedAt:snapshotInput.observedAt,
    collectorVersion:snapshotInput.collectorVersion,runtimeRef:snapshotInput.runtimeRef,
    contentSha256:createWorkerTelemetrySnapshot(snapshotInput).contentSha256
  }});
  assert.equal(evidence.localHealthVerified,true);
  assert.equal(evidence.queuesStable,false);
  assert.equal(evidence.decision,'HOLD_PRODUCTION_QUEUES');
});

test('stale heartbeat fails worker health',()=>{
  const input={...snapshotInput,workers:[{...snapshotInput.workers[0],heartbeatAt:'2026-08-27T11:00:00Z'}]};
  const evidence=evaluateWorkerTelemetryEvidence({snapshot:input});
  assert.equal(evidence.localHealthVerified,false);
  assert.ok(evidence.reasons.includes('WORKER_HEALTH_THRESHOLDS_FAILED'));
});

test('queue backlog thresholds fail closed',()=>{
  const input={...snapshotInput,workers:[{...snapshotInput.workers[0],queueDepth:1001,oldestMessageAgeMs:60001}]};
  const evidence=evaluateWorkerTelemetryEvidence({snapshot:input},{maxQueueDepth:1000,maxOldestMessageAgeMs:60000});
  assert.equal(evidence.localHealthVerified,false);
});

test('production attestation must bind exact telemetry hash and runtime',()=>{
  const snapshot=createWorkerTelemetrySnapshot(snapshotInput);
  const attestation={
    schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',
    sourceKind:'PRODUCTION_WORKER_RUNTIME',evidenceRef:'artifact://prod/worker-telemetry-1',observedAt:snapshot.observedAt,
    collectorVersion:snapshot.collectorVersion,runtimeRef:snapshot.runtimeRef,contentSha256:'f'.repeat(64)
  };
  const result=validateWorkerTelemetryAttestation(attestation,snapshot);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('TELEMETRY_HASH_BINDING_MISMATCH'));
});

test('synthetic production-observed evidence can prove queue gate only when all bindings and health checks pass',()=>{
  const snapshot=createWorkerTelemetrySnapshot(snapshotInput);
  const attestation={
    schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',
    sourceKind:'PRODUCTION_WORKER_RUNTIME',evidenceRef:'artifact://prod/worker-telemetry-1',observedAt:snapshot.observedAt,
    collectorVersion:snapshot.collectorVersion,runtimeRef:snapshot.runtimeRef,contentSha256:snapshot.contentSha256
  };
  const evidence=evaluateWorkerTelemetryEvidence({snapshot:snapshotInput,attestation});
  assert.equal(evidence.queuesStable,true);
  assert.equal(evidence.decision,'PRODUCTION_QUEUES_STABLE');
  assert.equal(evidence.providerDataSpendEur,0);
  assert.equal(evidence.paidDataCallsTriggered,0);
  assert.equal(evidence.purchaseAuthorized,false);
  assert.equal(evidence.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
