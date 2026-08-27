import fs from 'node:fs/promises';
import path from 'node:path';
import {processIngestionEvents,verifyReplay} from '../ingestion-pipeline-v1.js';
import {evaluateScaleGate} from '../data-pipeline-core-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/real-public-seed-1000.json');
const outputPath=String(args.output||'artifacts/ingestion-run-manifest.json');
const raw=JSON.parse(await fs.readFile(inputPath,'utf8'));
const observations=Array.isArray(raw)?raw:Array.isArray(raw.observations)?raw.observations:[];
const runId=String(args.runId||'LOCAL_INGESTION_RUN');
const collectedAt=String(args.collectedAt||raw.generatedAt||new Date().toISOString());
const events=observations.map((observation,index)=>({eventId:`${runId}:${index}`,runId,collectedAt,observation}));

const options={collector:'mpr-ingestion-runner',parserVersion:'ingestion-pipeline-v1'};
const first=processIngestionEvents(events,options);
const second=processIngestionEvents(events,options);
const replay=verifyReplay(first,second);
const provenanceComplete=first.canonicalBatch.accepted.every(row=>Boolean(row?.payload?.provenance));
const scaleGate=evaluateScaleGate(first.canonicalBatch,{
  provenanceComplete,
  restoreVerified:false,
  replayDeterministic:replay.deterministic,
  queuesStable:false,
  p95Ms:NaN,
  requiredCanonicalCount:1000000
});
const output={
  schema:'MPR_INGESTION_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  inputPath,
  runId,
  ingestion:first.manifest,
  replay,
  provenanceComplete,
  scaleGate,
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false}
};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
if(scaleGate.scaleAuthorized)throw new Error('UNEXPECTED_SCALE_AUTHORIZATION');
