import fs from 'node:fs/promises';
import path from 'node:path';
import {adaptStructuredSupplierProviderRows} from '../structured-supplier-provider-adapter-v1.js';

const token=process.env.APIFY_TOKEN;
const authorization=process.env.MPR_APIFY_AUTHORIZATION;
const OUT_DIR='artifacts/apify-alibaba-supplier-pilot';
const ACTOR='memo23~alibaba-scraper';
const MAX_TOTAL_CHARGE_USD=0.05;
const MAX_ITEMS=25;
const searchTerms=['desk organizer','car seat organizer','stroller organizer','packing cubes','white noise machine','knee support sleeve'];
if(!token)throw new Error('APIFY_TOKEN_MISSING');
if(authorization!=='USER_APPROVED_APIFY_SUPPLIER_PRICE_PILOT')throw new Error('APIFY_PROVIDER_SPEND_NOT_AUTHORIZED');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jsonFetch(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`HTTP_${r.status}:${text.slice(0,800)}`);
  return text?JSON.parse(text):{};
}

await fs.mkdir(OUT_DIR,{recursive:true});
const runUrl=`https://api.apify.com/v2/actors/${ACTOR}/runs?token=${encodeURIComponent(token)}&maxItems=${MAX_ITEMS}&maxTotalChargeUsd=${MAX_TOTAL_CHARGE_USD}`;
const started=await jsonFetch(runUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({searchTerms,maxPages:1,maxItems:MAX_ITEMS,proxy:{useApifyProxy:false}})});
const run=started?.data??started;
const runId=run?.id;
if(!runId)throw new Error('APIFY_RUN_ID_MISSING');
let finalRun=run;
for(let i=0;i<90;i++){
  const status=String(finalRun?.status||'').toUpperCase();
  if(['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status))break;
  await sleep(2000);
  const doc=await jsonFetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
  finalRun=doc?.data??doc;
}
if(String(finalRun?.status||'').toUpperCase()!=='SUCCEEDED')throw new Error(`APIFY_RUN_NOT_SUCCESSFUL:${finalRun?.status||'UNKNOWN'}`);
await sleep(10000);
const stableDoc=await jsonFetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
finalRun=stableDoc?.data??stableDoc;
const datasetId=finalRun?.defaultDatasetId;
if(!datasetId)throw new Error('APIFY_DATASET_ID_MISSING');
const rawRows=await jsonFetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${encodeURIComponent(token)}`);
const rows=Array.isArray(rawRows)?rawRows:Array.isArray(rawRows?.items)?rawRows.items:[];
if(rows.length>MAX_ITEMS)throw new Error(`MAX_ITEMS_BREACH:${rows.length}`);
const normalized=adaptStructuredSupplierProviderRows(rows,{provider:'APIFY_MEMO23_ALIBABA_SCRAPER',platform:'ALIBABA',observedAt:new Date().toISOString()});
const usageUsd=Number(finalRun?.usageTotalUsd??finalRun?.usageUsd??finalRun?.usage?.totalUsd);
const reportedUsageUsd=Number.isFinite(usageUsd)?usageUsd:null;
if(reportedUsageUsd!==null&&reportedUsageUsd>MAX_TOTAL_CHARGE_USD+1e-9)throw new Error(`APIFY_CHARGE_CAP_BREACH:${reportedUsageUsd}`);
const summary={schemaVersion:'MPR_APIFY_ALIBABA_SUPPLIER_PRICE_PILOT_V1',generatedAt:new Date().toISOString(),actor:ACTOR,runId,datasetId,status:finalRun.status,maxItems:MAX_ITEMS,maxTotalChargeUsd:MAX_TOTAL_CHARGE_USD,reportedUsageUsd,inputSearchTerms:searchTerms,rawRows:rows.length,acceptedPublicPriceObservations:normalized.observations.length,rejectedRows:normalized.rejected.length,truthPolicy:{providerResultIsVerifiedQuote:false,providerResultIsLandedCost:false,providerResultIsMarketplaceMatch:false,unknownEqualsZero:false,negotiationIncluded:false,purchaseAuthorized:false}};
await fs.writeFile(path.join(OUT_DIR,'raw.json'),JSON.stringify(rows,null,2)+'\n');
await fs.writeFile(path.join(OUT_DIR,'supplier-ledger-input.json'),JSON.stringify(normalized,null,2)+'\n');
await fs.writeFile(path.join(OUT_DIR,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
