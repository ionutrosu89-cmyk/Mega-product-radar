import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {processIngestionEvents,verifyReplay} from '../ingestion-pipeline-v1.js';
import {evaluateScaleGate} from '../data-pipeline-core-v1.js';
import {verifyArtifactRestore,buildOperationalScaleEvidence} from '../operational-scale-observability-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/real-public-seed-1000.json');
const outPath=String(args.out||'artifacts/operational-scale-observability.json');
const iterations=Math.max(3,Math.min(100,Number(args.iterations)||10));
const p95LimitMs=Math.max(1,Number(args.p95LimitMs)||1000);

const raw=JSON.parse(await fs.readFile(inputPath,'utf8'));
const observations=Array.isArray(raw.observations)?raw.observations:Array.isArray(raw)?raw:[];
const events=observations.map((observation,index)=>({
  eventId:`LOCAL_BENCH_${index+1}`,
  runId:'LOCAL_OPERATIONAL_BENCHMARK',
  collectedAt:'2026-08-27T00:00:00.000Z',
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  observation
}));

const options={intendedUse:'analysis',collector:'mpr-operational-scale-benchmark',parserVersion:'operational-scale-observability-v1'};
const runs=[];
for(let i=0;i<iterations;i++){
  const start=performance.now();
  const result=processIngestionEvents(events,options);
  const elapsedMs=performance.now()-start;
  runs.push({elapsedMs,result});
}
const first=runs[0].result;
const second=runs[1].result;
const replay=verifyReplay(first,second);
const restored=JSON.parse(JSON.stringify(first.canonicalBatch));
const artifactRestore=verifyArtifactRestore(first.canonicalBatch,restored);
const totalEvents=events.length*iterations;
const totalMs=runs.reduce((sum,x)=>sum+x.elapsedMs,0);
const throughputEventsPerSecond=totalMs>0?(totalEvents/(totalMs/1000)):null;

const operationalEvidence=buildOperationalScaleEvidence({
  benchmarkScope:'LOCAL_PROCESS_BENCHMARK',
  latencySamplesMs:runs.map(x=>x.elapsedMs),
  queueMetrics:{
    depth:0,
    oldestAgeMs:0,
    processed:totalEvents,
    failed:0,
    observationMode:'LOCAL_SIMULATION'
  },
  artifactRestore,
  replayDeterministic:replay.deterministic,
  throughputEventsPerSecond
},{p95LimitMs});

const provenanceComplete=first.events.every(x=>Boolean(x.envelope?.provenance?.collector&&x.envelope?.provenance?.runId&&x.envelope?.source?.name&&x.envelope?.source?.collectedAt));
const scaleGate=evaluateScaleGate(first.canonicalBatch,{
  provenanceComplete,
  restoreVerified:operationalEvidence.productionClaims.restoreVerified,
  replayDeterministic:replay.deterministic,
  queuesStable:operationalEvidence.productionClaims.queuesStable,
  p95Ms:operationalEvidence.productionClaims.p95Verified?operationalEvidence.latency.p95Ms:null,
  p95LimitMs,
  requiredCanonicalCount:1000000
});

const report={
  schema:'MPR_OPERATIONAL_SCALE_REPORT_V1',
  generatedAt:new Date().toISOString(),
  inputPath,
  inputEventCount:events.length,
  iterations,
  operationalEvidence,
  replay,
  provenanceComplete,
  scaleGate,
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false},
  notes:[
    'Latency is a local process benchmark, not production p95 evidence.',
    'Queue metrics are local simulation only and cannot prove production queue stability.',
    'Restore drill verifies JSON artifact round-trip only, not production persistence restore.',
    'Scale remains HOLD until production-observed evidence satisfies all gates.'
  ]
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({
  inputEventCount:report.inputEventCount,
  iterations,
  p95Ms:operationalEvidence.latency.p95Ms,
  throughputEventsPerSecond,
  replayDeterministic:replay.deterministic,
  artifactRestoreVerified:artifactRestore.verified,
  productionQueueStable:operationalEvidence.productionClaims.queuesStable,
  productionRestoreVerified:operationalEvidence.productionClaims.restoreVerified,
  scaleDecision:scaleGate.decision,
  scaleFailed:scaleGate.failed
},null,2));
if(scaleGate.decision!=='HOLD_SCALE')throw new Error('LOCAL_BENCHMARK_MUST_NOT_AUTHORIZE_SCALE');
