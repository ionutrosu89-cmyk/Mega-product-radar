import fs from 'node:fs';
import path from 'node:path';
import {runBulkCatalogIngestion,evaluateTenKCatalogGate} from '../bulk-catalog-ingestion-v1.js';

function arg(name,fallback=null){
  const hit=process.argv.find(x=>x.startsWith(`--${name}=`));
  return hit?hit.slice(name.length+3):fallback;
}

const inputPath=arg('input');
const sourceKey=arg('source','OPEN_FOOD_FACTS');
const outPath=arg('out','artifacts/bulk-catalog-ingestion-v1.json');
const retrievedAt=arg('retrievedAt',new Date().toISOString());
const format=arg('format',inputPath?.endsWith('.jsonl')?'JSONL':'JSON');
const remoteEnabled=String(process.env.MPR_BULK_REMOTE_FETCH_ENABLED||'false').toLowerCase()==='true';

if(!inputPath)throw new Error('--input is required; remote fetch is intentionally not automatic');
if(/^https?:\/\//i.test(inputPath)){
  if(!remoteEnabled)throw new Error('Remote fetch disabled by default (MPR_BULK_REMOTE_FETCH_ENABLED=false)');
  throw new Error('Remote URL ingestion is not implemented in this runner; download a reviewed bulk artifact first');
}

const raw=fs.readFileSync(inputPath,'utf8');
let records;
if(format.toUpperCase()==='JSONL'){
  records=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line);}catch(err){throw new Error(`Invalid JSONL at line ${i+1}: ${err.message}`);}
  });
}else{
  const parsed=JSON.parse(raw);
  records=Array.isArray(parsed)?parsed:(Array.isArray(parsed.products)?parsed.products:[]);
}

const report=runBulkCatalogIngestion({
  sourceKey,
  records,
  retrievedAt,
  artifactRef:path.resolve(inputPath),
  format
},{calibrationSampleLimit:Number(arg('calibrationSampleLimit','250'))});

const gate=evaluateTenKCatalogGate({
  canonicalCount:report.stats.accepted,
  logicalDuplicateCount:report.stats.logicalDuplicates,
  provenanceComplete:report.claims.length>0&&report.accepted.every(x=>x.sourceKey&&x.sourceRecordId&&x.rightsDecision==='ACCEPT'),
  replayDeterministic:false,
  checkpointRestoreVerified:false,
  silentDrops:report.stats.silentDrops,
  syntheticCount:0,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false
});

const output={
  schema:'MPR_BULK_CATALOG_INGESTION_RUN_V1',
  mode:'LOCAL_ARTIFACT',
  productionDatabaseContacted:false,
  remoteFetchEnabled:remoteEnabled,
  report,
  tenKGate:gate,
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0},
  note:'Local bulk artifact processing is not production scale evidence and does not establish 10K readiness by itself.'
};

fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2));
console.log(JSON.stringify({output:outPath,input:report.stats.input,accepted:report.stats.accepted,held:report.stats.held,gate:gate.decision,remoteFetchEnabled:remoteEnabled},null,2));
