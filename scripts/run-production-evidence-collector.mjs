import fs from 'node:fs/promises';
import path from 'node:path';
import {createFilesystemStorageAdapter} from '../production-storage-adapter-v1.js';
import {createWorkerTelemetrySnapshot} from '../production-worker-telemetry-evidence-v1.js';
import {createLatencySnapshot} from '../production-latency-evidence-v1.js';
import {collectProductionEvidence} from '../production-evidence-collector-v1.js';

const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'artifacts/production-evidence-collector.json';
const observedAt=new Date().toISOString();
const adapter=createFilesystemStorageAdapter('artifacts/local-production-evidence-store');
const workerTelemetrySnapshot=createWorkerTelemetrySnapshot({
  observedAt,collectorVersion:'production-evidence-collector-v1',runtimeRef:'local-evidence-runtime',
  workers:[{id:'local-worker-1',status:'HEALTHY',heartbeatAt:observedAt,processed:100,failed:0,queueDepth:0,oldestMessageAgeMs:0}]
});
const latencySnapshot=createLatencySnapshot({
  observedAt,collectorVersion:'production-evidence-collector-v1',runtimeRef:'local-evidence-runtime',operation:'INGEST',surface:'PIPELINE',
  samplesMs:Array.from({length:100},(_,i)=>10+(i%20))
});
const report=await collectProductionEvidence({
  collectedAt:observedAt,
  checkpoint:{runId:'local-evidence-drill',sequence:1,processedCount:100,canonicalCount:100,cursor:'100',ingestionFingerprint:'LOCAL_DIAGNOSTIC',artifactContentSha256:'a'.repeat(64)},
  workerTelemetrySnapshot,
  latencySnapshot,
  inventory:{observationMode:'LOCAL_OBSERVED',environment:'local',inventoryClass:'LOCAL_DIAGNOSTIC',canonicalCount:100,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,observedAt}
},{storageAdapter:adapter});
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({schema:report.schema,productionEvidenceComplete:report.productionEvidenceComplete,scaleDecision:report.progressiveScale.decision,checkpointLocalRestoreVerified:report.checkpointReceipt.localRestoreVerified,checkpointProductionVerified:report.checkpointReceipt.productionPersistenceVerified,providerDataSpendEur:report.providerDataSpendEur,paidDataCallsTriggered:report.paidDataCallsTriggered,purchaseAuthorized:report.purchaseAuthorized},null,2));
if(report.productionEvidenceComplete||report.progressiveScale.decision!=='HOLD_PROGRESSIVE_SCALE')throw new Error('LOCAL_EVIDENCE_DRILL_MUST_FAIL_CLOSED');
