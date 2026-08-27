import fs from 'node:fs/promises';
import path from 'node:path';
import {buildProductionReadinessSnapshot,createIngestionCheckpoint} from '../production-readiness-harness-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/operational-scale-observability.json');
const outPath=String(args.out||'artifacts/production-readiness-harness.json');
const stage=String(args.stage||'10K').toUpperCase();
const raw=JSON.parse(await fs.readFile(inputPath,'utf8'));
const operational=raw.operationalEvidence||{};
const canonicalCount=Number(raw?.scaleGate?.canonicalCount||raw?.inputEventCount||0);
const logicalDuplicateCount=Number(raw?.scaleGate?.checks?.zeroLogicalDuplicates===false?1:0);
const artifactHash='0'.repeat(64);
const checkpoint=createIngestionCheckpoint({
  runId:'LOCAL_READINESS_HARNESS',
  sequence:1,
  processedCount:Number(raw.inputEventCount||0),
  canonicalCount,
  cursor:'LOCAL_END',
  ingestionFingerprint:raw?.replay?.firstFingerprint||null,
  artifactContentSha256:artifactHash
});
const localAttestation={
  observationMode:'LOCAL_SIMULATION',
  environment:'local',
  evidenceRef:null,
  observedAt:new Date().toISOString(),
  collectorVersion:'production-readiness-harness-v1',
  contentSha256:artifactHash
};
const snapshot=buildProductionReadinessSnapshot({
  canonicalCount,
  logicalDuplicateCount,
  provenanceComplete:raw.provenanceComplete===true,
  replayDeterministic:raw?.replay?.deterministic===true,
  p95Ms:operational?.latency?.p95Ms??null,
  latencyAttestation:localAttestation,
  workerAttestation:localAttestation,
  restoreAttestation:localAttestation,
  workers:[{
    id:'local-worker-1',
    status:'HEALTHY',
    heartbeatAgeMs:0,
    processed:Number(raw.inputEventCount||0),
    failed:0
  }],
  originalCheckpoint:checkpoint,
  restoredCheckpoint:JSON.parse(JSON.stringify(checkpoint))
},{stage,p95LimitMs:Number(operational?.latency?.p95LimitMs||1000)});
const report={
  schema:'MPR_PRODUCTION_READINESS_HARNESS_REPORT_V1',
  generatedAt:new Date().toISOString(),
  inputPath,
  stage,
  snapshot,
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false},
  notes:[
    'This runner consumes local observability output only.',
    'Local health, latency and restore drills cannot satisfy production attestations.',
    'Use production-observed telemetry with evidenceRef, collectorVersion and SHA256 before any gate can be promoted.',
    'SCALE_READY remains forbidden unless every final scale gate is proven.'
  ]
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({
  stage:snapshot.stage.stage,
  stageDecision:snapshot.stage.decision,
  productionReady:snapshot.productionReady,
  scaleDecision:snapshot.finalScale.decision,
  failed:snapshot.finalScale.failed
},null,2));
if(snapshot.productionReady||snapshot.finalScale.decision!=='HOLD_SCALE')throw new Error('LOCAL_READINESS_HARNESS_MUST_HOLD_SCALE');
