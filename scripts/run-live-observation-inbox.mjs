import fs from 'node:fs/promises';
import path from 'node:path';
import {createFilesystemHistoryStore} from '../ranking-history-store-v1.js';
import {enqueueObservationBundle,readObservationInboxEntry} from '../live-observation-inbox-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/ingestion-run-manifest.json');
const outputPath=String(args.output||'artifacts/live-observation-inbox-audit.json');
const storeRoot=String(args.storeRoot||'artifacts/live-observation-inbox-store');
const now=String(args.now||new Date().toISOString());
const maxAgeMs=Math.max(1,Number(args.maxAgeMs||2*60*60*1000));

async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2));}

const audit=await readJson(inputPath);
const basePolicy={providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false};
if(!audit?.rankingSignalResolution?.manifest){
  const output={schema:'MPR_LIVE_OBSERVATION_INBOX_AUDIT_V1',generatedAt:new Date().toISOString(),decision:'WAIT',reason:'RANKING_SIGNAL_RESOLUTION_REQUIRED',policy:basePolicy};
  await writeJson(outputPath,output);
  console.log(JSON.stringify(output,null,2));
  process.exit(0);
}

const store=createFilesystemHistoryStore(storeRoot);
const enqueue=await enqueueObservationBundle(store,audit.rankingSignalResolution,{receivedAt:now,sourceRef:inputPath});
const read=await readObservationInboxEntry(store,enqueue.key,{now,maxAgeMs});
const output={
  schema:'MPR_LIVE_OBSERVATION_INBOX_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  inputPath,outputPath,storeRoot,
  decision:read.analysisRunnable?'READY':'WAIT',
  enqueue,read,
  productionSchedulerAttested:false,
  policy:basePolicy
};
await writeJson(outputPath,output);
console.log(JSON.stringify({schema:output.schema,decision:output.decision,enqueueDecision:enqueue.decision,analysisRunnable:read.analysisRunnable,productionRunnable:read.productionRunnable,policy:basePolicy},null,2));
if(read.productionRunnable)throw new Error('LOCAL_INBOX_PROMOTED_TO_PRODUCTION');
if(basePolicy.providerDataSpendEur!==0||basePolicy.paidDataCallsTriggered!==0||basePolicy.purchaseAuthorized!==false)throw new Error('LIVE_OBSERVATION_INBOX_POLICY_INVARIANT_VIOLATION');
