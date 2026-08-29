import fs from 'node:fs/promises';
import path from 'node:path';
import {adaptStructuredSupplierProviderRows} from '../structured-supplier-provider-adapter-v1.js';

const token=process.env.APIFY_TOKEN;
const triggerPath='data/v2-apify-supplier-price-recovery-trigger.json';
const OUT_DIR='artifacts/apify-alibaba-supplier-pilot-recovery';
if(!token)throw new Error('APIFY_TOKEN_MISSING');

const trigger=JSON.parse(await fs.readFile(triggerPath,'utf8'));
if(trigger.authorization!=='RECOVER_EXISTING_APIFY_RUN_ONLY')throw new Error('RECOVERY_NOT_AUTHORIZED');
if(trigger.newActorRunsAuthorized!==false)throw new Error('NEW_ACTOR_RUN_FORBIDDEN');
if(trigger.maxAdditionalProviderSpendUsd!==0)throw new Error('RECOVERY_MUST_HAVE_ZERO_ADDITIONAL_SPEND');
const actor=String(trigger.actor||'').trim();
if(!actor)throw new Error('ACTOR_REQUIRED');
const startMs=Date.parse(trigger.windowStart);
const endMs=Date.parse(trigger.windowEnd);
if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)throw new Error('INVALID_RECOVERY_WINDOW');

async function jsonGet(url){
  const r=await fetch(url,{method:'GET',signal:AbortSignal.timeout(60000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`HTTP_${r.status}:${text.slice(0,800)}`);
  return text?JSON.parse(text):{};
}

await fs.mkdir(OUT_DIR,{recursive:true});
const listDoc=await jsonGet(`https://api.apify.com/v2/actors/${actor}/runs?token=${encodeURIComponent(token)}&desc=1&limit=20`);
const candidates=Array.isArray(listDoc?.data?.items)?listDoc.data.items:[];
const matching=candidates.filter(r=>{
  const t=Date.parse(r.startedAt);
  return String(r.status||'').toUpperCase()==='SUCCEEDED'&&Number.isFinite(t)&&t>=startMs&&t<=endMs;
});
if(matching.length!==1)throw new Error(`RECOVERY_RUN_MATCH_COUNT_${matching.length}`);
const runId=matching[0].id;
const runDoc=await jsonGet(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
const run=runDoc?.data??runDoc;
if(String(run?.status||'').toUpperCase()!=='SUCCEEDED')throw new Error(`RECOVERY_RUN_NOT_SUCCESSFUL:${run?.status||'UNKNOWN'}`);
const datasetId=run?.defaultDatasetId;
if(!datasetId)throw new Error('APIFY_DATASET_ID_MISSING');
const rawDoc=await jsonGet(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${encodeURIComponent(token)}`);
const rows=Array.isArray(rawDoc)?rawDoc:Array.isArray(rawDoc?.items)?rawDoc.items:[];
if(rows.length>25)throw new Error(`RECOVERY_MAX_ITEMS_BREACH:${rows.length}`);
const normalized=adaptStructuredSupplierProviderRows(rows,{provider:'APIFY_MEMO23_ALIBABA_SCRAPER',platform:'ALIBABA',observedAt:new Date().toISOString()});
const usageCandidate=run?.usageTotalUsd??run?.usageUsd??run?.usage?.totalUsd;
const usage=Number(usageCandidate);
const reportedUsageUsd=Number.isFinite(usage)?usage:null;
const summary={
  schemaVersion:'MPR_APIFY_ALIBABA_SUPPLIER_PRICE_RECOVERY_V1',
  generatedAt:new Date().toISOString(),
  sourceGitHubWorkflowRunId:trigger.sourceGitHubWorkflowRunId,
  actor,
  recoveredRunId:runId,
  datasetId,
  status:run.status,
  reportedUsageUsd,
  rawRows:rows.length,
  acceptedPublicPriceObservations:normalized.observations.length,
  rejectedRows:normalized.rejected.length,
  additionalActorRunsTriggered:0,
  additionalProviderSpendAuthorizedUsd:0,
  truthPolicy:{providerResultIsVerifiedQuote:false,providerResultIsLandedCost:false,providerResultIsMarketplaceMatch:false,unknownEqualsZero:false,negotiationIncluded:false,purchaseAuthorized:false}
};
await fs.writeFile(path.join(OUT_DIR,'raw.json'),JSON.stringify(rows,null,2)+'\n');
await fs.writeFile(path.join(OUT_DIR,'supplier-ledger-input.json'),JSON.stringify(normalized,null,2)+'\n');
await fs.writeFile(path.join(OUT_DIR,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
