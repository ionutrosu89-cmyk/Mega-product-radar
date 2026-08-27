import fs from 'node:fs/promises';
import path from 'node:path';
import {buildCanonicalBatch,evaluateScaleGate} from '../data-pipeline-core-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const input=String(args.input||'artifacts/real-public-seed-1000.json');
const out=String(args.out||'artifacts/canonical-batch-v1.json');
const requiredCanonicalCount=Math.max(1,Number(args.requiredCanonicalCount||1000000));

const payload=JSON.parse(await fs.readFile(input,'utf8'));
const observations=Array.isArray(payload.observations)?payload.observations:[];
if(!observations.length)throw new Error('CANONICALIZE_INPUT_EMPTY');
const batch=buildCanonicalBatch(observations);
const provenanceComplete=batch.accepted.every(row=>Boolean(row.payload?.provenance));
const gate=evaluateScaleGate(batch,{
  requiredCanonicalCount,
  provenanceComplete,
  restoreVerified:false,
  replayDeterministic:true,
  queuesStable:false,
  p95Ms:Number.NaN
});
const result={
  schemaVersion:'MPR_CANONICALIZATION_RUN_V1',
  generatedAt:new Date().toISOString(),
  input,
  sourceSchemaVersion:payload.schemaVersion||null,
  manifest:batch.manifest,
  accepted:batch.accepted,
  rejected:batch.rejected,
  scaleGate:gate,
  policy:{
    providerSpendEur:0,
    paidCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false,
    scaleAuthorized:false
  }
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({canonicalCount:batch.manifest.canonicalCount,rejectedCount:batch.manifest.rejectedCount,logicalDuplicateCount:batch.manifest.logicalDuplicateCount,scaleDecision:gate.decision,scaleFailed:gate.failed},null,2));
if(batch.manifest.logicalDuplicateCount>0)process.exitCode=2;
