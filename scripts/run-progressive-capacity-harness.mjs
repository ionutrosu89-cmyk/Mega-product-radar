import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {
  buildProgressiveCapacityPlan,
  createSyntheticCapacityCheckpoint,
  serializeCheckpointEnvelope,
  verifyPersistedCheckpoint,
  evaluateTelemetrySnapshot
} from '../persistence-telemetry-adapters-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const outPath=String(args.out||'artifacts/progressive-capacity-harness.json');
const chunkSize=Math.max(100,Number(args.chunkSize||10000));
const stageLimit=String(args.stage||'1M').toUpperCase();
const plan=buildProgressiveCapacityPlan({chunkSize});
const selected=[];
for(const stage of plan){
  selected.push(stage);
  if(stage.stage===stageLimit)break;
}

const stageReports=[];
for(const stage of selected){
  const start=performance.now();
  let processed=0;
  let sequence=0;
  let checkpoint=null;
  while(processed<stage.targetCanonicalCount){
    processed=Math.min(stage.targetCanonicalCount,processed+stage.chunkSize);
    sequence+=1;
    checkpoint=createSyntheticCapacityCheckpoint({
      targetCanonicalCount:stage.targetCanonicalCount,
      processedCount:processed,
      sequence,
      seed:`${stage.stage}:LOCAL_SYNTHETIC_CAPACITY_V1`,
      runId:`LOCAL_CAPACITY_${stage.stage}`
    });
  }
  const elapsedMs=performance.now()-start;
  const storageOptions={
    storageMode:'LOCAL_FILE',
    storageRef:`artifacts/checkpoints/${stage.stage.toLowerCase()}.json`,
    writtenAt:'2026-08-27T00:00:00.000Z'
  };
  const persisted=serializeCheckpointEnvelope(checkpoint,storageOptions);
  const localAttestation={
    observationMode:'LOCAL_SIMULATION',
    environment:'local',
    evidenceRef:storageOptions.storageRef,
    observedAt:'2026-08-27T00:00:00.000Z',
    collectorVersion:'progressive-capacity-harness-v1',
    contentSha256:persisted.contentSha256
  };
  const persistence=verifyPersistedCheckpoint(checkpoint,structuredClone(checkpoint),{
    original:storageOptions,
    restored:storageOptions,
    attestation:localAttestation
  });
  const telemetry=evaluateTelemetrySnapshot([{
    workerId:'local-capacity-worker-1',
    status:'HEALTHY',
    observedAt:'2026-08-27T00:00:00.000Z',
    processed:stage.targetCanonicalCount,
    failed:0,
    queueDepth:0,
    oldestQueueAgeMs:0,
    runId:`LOCAL_CAPACITY_${stage.stage}`,
    collectorVersion:'progressive-capacity-harness-v1'
  }],{
    snapshotAt:'2026-08-27T00:00:00.000Z',
    attestation:localAttestation
  });
  stageReports.push({
    stage:stage.stage,
    targetCanonicalCount:stage.targetCanonicalCount,
    chunks:sequence,
    elapsedMs,
    localThroughputItemsPerSecond:elapsedMs>0?stage.targetCanonicalCount/(elapsedMs/1000):null,
    checkpoint,
    persistedCheckpoint:{
      storageMode:persisted.storageMode,
      storageRef:persisted.storageRef,
      contentSha256:persisted.contentSha256
    },
    persistence,
    telemetry,
    productionEvidence:false,
    scaleAuthorizationAllowed:false
  });
}

const report={
  schema:'MPR_PROGRESSIVE_CAPACITY_HARNESS_REPORT_V1',
  generatedAt:new Date().toISOString(),
  stageLimit,
  chunkSize,
  stages:stageReports,
  policy:{
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    productionEvidence:false,
    scaleAuthorized:false
  },
  notes:[
    'This is a local synthetic capacity exercise, not a canonical-product production load test.',
    'Local file checkpoint round-trips cannot prove production persistence.',
    'Local worker telemetry cannot prove production queue stability.',
    'The 10K, 100K and 1M stages measure harness mechanics only; SCALE_READY remains forbidden without production-observed attestations.'
  ]
};

await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({
  stages:stageReports.map(x=>({stage:x.stage,targetCanonicalCount:x.targetCanonicalCount,chunks:x.chunks,elapsedMs:x.elapsedMs,productionEvidence:x.productionEvidence})),
  scaleAuthorized:report.policy.scaleAuthorized
},null,2));
if(report.policy.scaleAuthorized!==false)throw new Error('LOCAL_CAPACITY_HARNESS_MUST_NOT_AUTHORIZE_SCALE');
if(stageReports.some(x=>x.persistence.productionPersistenceVerified||x.telemetry.productionStable))throw new Error('LOCAL_CAPACITY_EVIDENCE_MUST_FAIL_CLOSED');
