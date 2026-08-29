import fs from 'node:fs/promises';
import path from 'node:path';
import {adaptStructuredSupplierDetailEvidence} from '../structured-supplier-detail-evidence-v1.js';

const token=process.env.APIFY_TOKEN;
const authorization=process.env.MPR_APIFY_DETAIL_AUTHORIZATION;
const triggerPath='data/v2-apify-supplier-detail-pilot-trigger.json';
const outDir='artifacts/apify-alibaba-supplier-detail-pilot';
const expectedAuthorization='USER_APPROVED_APIFY_SUPPLIER_DETAIL_PILOT_2026_08_29';
if(!token)throw new Error('APIFY_TOKEN_MISSING');
if(authorization!==expectedAuthorization)throw new Error('APIFY_DETAIL_SPEND_NOT_AUTHORIZED');

const trigger=JSON.parse(await fs.readFile(triggerPath,'utf8'));
if(trigger.authorization!==expectedAuthorization)throw new Error('TRIGGER_AUTHORIZATION_MISMATCH');
if(Number(trigger.maxTotalChargeUsd)!==0.05)throw new Error('APIFY_DETAIL_CAP_MUST_EQUAL_0_05');
if(trigger.discoveryAuthorized!==false||trigger.negotiationAuthorized!==false||trigger.purchaseAuthorized!==false)throw new Error('FORBIDDEN_COMMERCIAL_ACTION');
if(trigger.actor!=='xtracto~alibaba-product-scraper')throw new Error('UNEXPECTED_ACTOR');

const inputUrls=Array.isArray(trigger.supplierUrls)?trigger.supplierUrls.map(String).filter(Boolean):[];
const urls=[...new Set(inputUrls)];
if(!urls.length)throw new Error('NO_SUPPLIER_URLS');
if(urls.length>Number(trigger.maxUniqueSupplierUrls??5))throw new Error('SUPPLIER_URL_CAP_BREACH');
if(urls.some(u=>!/^https:\/\/(?:www\.)?alibaba\.com\/product-detail\//i.test(u)))throw new Error('NON_ALIBABA_DETAIL_URL');

const MAX_TOTAL_CHARGE_USD=0.05;
const MAX_ITEMS=urls.length;
const ACTOR=trigger.actor;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jsonFetch(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(90000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`HTTP_${r.status}:${text.slice(0,1000)}`);
  return text?JSON.parse(text):{};
}

await fs.mkdir(outDir,{recursive:true});
const actorInput={productUrls:urls.map(url=>({url})),maxConcurrency:1,maxRequestRetries:2};
const runUrl=`https://api.apify.com/v2/actors/${ACTOR}/runs?token=${encodeURIComponent(token)}&maxItems=${MAX_ITEMS}&maxTotalChargeUsd=${MAX_TOTAL_CHARGE_USD}`;
const started=await jsonFetch(runUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(actorInput)});
let run=started?.data??started;
const runId=run?.id;
if(!runId)throw new Error('APIFY_RUN_ID_MISSING');

for(let i=0;i<180;i++){
  const status=String(run?.status||'').toUpperCase();
  if(['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status))break;
  await sleep(2000);
  const doc=await jsonFetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
  run=doc?.data??doc;
}
const finalStatus=String(run?.status||'').toUpperCase();
if(finalStatus!=='SUCCEEDED')throw new Error(`APIFY_DETAIL_RUN_NOT_SUCCESSFUL:${finalStatus||'UNKNOWN'}`);

await sleep(3000);
const stable=await jsonFetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
run=stable?.data??stable;
const datasetId=run?.defaultDatasetId;
if(!datasetId)throw new Error('APIFY_DATASET_ID_MISSING');
const rawDoc=await jsonFetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${encodeURIComponent(token)}`);
const rows=Array.isArray(rawDoc)?rawDoc:Array.isArray(rawDoc?.items)?rawDoc.items:[];
if(rows.length>MAX_ITEMS)throw new Error(`MAX_ITEMS_BREACH:${rows.length}`);

const details=rows.map(row=>({
  supplierListingId:String(row?.productId??row?.id??'').trim()||null,
  sourceUrl:String(row?.productUrl??row?.url??'').trim()||null,
  evidence:adaptStructuredSupplierDetailEvidence(row),
  rawPriceRange:row?.priceRange??row?.price??null,
  rawMinOrderQuantity:row?.minOrderQuantity??row?.moq??null,
  rawBulkPricing:row?.bulkPricing??row?.priceTiers??row?.ladderPricing??null,
  rawVariants:row?.variants??row?.skus??row?.skuMatrix??null
}));

const coverage={
  rows:details.length,
  withProductType:details.filter(x=>x.evidence.coverage.productTypeKnown).length,
  withMaterial:details.filter(x=>x.evidence.coverage.materialKnown).length,
  withDimensions:details.filter(x=>x.evidence.coverage.dimensionsKnown).length,
  withUnitWeight:details.filter(x=>x.evidence.coverage.unitWeightKnown).length,
  withPackCount:details.filter(x=>x.evidence.coverage.packCountKnown).length,
  withAttributes:details.filter(x=>x.evidence.coverage.attributeCount>0).length
};
const usage=Number(run?.usageTotalUsd??run?.usageUsd??run?.usage?.totalUsd);
const reportedUsageUsd=Number.isFinite(usage)?usage:null;
if(reportedUsageUsd!==null&&reportedUsageUsd>MAX_TOTAL_CHARGE_USD+1e-9)throw new Error(`APIFY_DETAIL_CHARGE_CAP_BREACH:${reportedUsageUsd}`);

const summary={
  schemaVersion:'MPR_APIFY_ALIBABA_SUPPLIER_DETAIL_PILOT_V1',
  generatedAt:new Date().toISOString(),actor:ACTOR,runId,datasetId,status:run.status,
  requestedUniqueSupplierUrls:urls.length,sourceTopPairCount:Number(trigger.sourceTopPairCount??10),
  maxTotalChargeUsd:MAX_TOTAL_CHARGE_USD,reportedUsageUsd,rawRows:rows.length,coverage,
  truthPolicy:{structuredPublicDetailIsVerifiedQuote:false,structuredPublicDetailIsLandedCost:false,providerResultIsMarketplaceMatch:false,unknownEqualsZero:false,discoveryAuthorized:false,negotiationIncluded:false,purchaseAuthorized:false}
};
await fs.writeFile(path.join(outDir,'raw.json'),JSON.stringify(rows,null,2)+'\n');
await fs.writeFile(path.join(outDir,'normalized-detail-evidence.json'),JSON.stringify({schemaVersion:'MPR_STRUCTURED_SUPPLIER_DETAIL_BATCH_V1',generatedAt:new Date().toISOString(),details,truthPolicy:summary.truthPolicy},null,2)+'\n');
await fs.writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
