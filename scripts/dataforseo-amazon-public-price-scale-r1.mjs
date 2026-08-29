import fs from 'node:fs';
import path from 'node:path';
import {extractDataForSeoAmazonPriceObservations,DataForSeoAmazonPriceTruthPolicy} from '../dataforseo-amazon-price-v1.js';
import {buildMarketplacePriceLedger,normalizeMarketplaceListingSnapshot} from '../marketplace-price-ledger-v1.js';

const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'artifacts/dataforseo-amazon-price-scale-r1.json';
const ledgerPath=process.argv.find(x=>x.startsWith('--ledger='))?.slice(9)||'artifacts/dataforseo-amazon-price-ledger-scale-r1.json';
const login=process.env.DATAFORSEO_LOGIN||process.env.DATAFORSEO_API_LOGIN||'';
const password=process.env.DATAFORSEO_PASSWORD||process.env.DATAFORSEO_API_PASSWORD||'';
const base='https://api.dataforseo.com';
const endpoint='/v3/merchant/amazon/products/live/advanced';
const balanceEndpoint='/v3/appendix/user_data';
const HISTORICAL_ACCOUNTED_USD=11.15064;
const TOTAL_AUTHORIZED_CAP_USD=15;
const ROUND_MAX_SPEND_USD=0.25;
const CONSERVATIVE_MAX_REQUEST_USD=0.01;
const keywords=[
'desk organizer','cable management','laptop stand','headphone stand','phone holder','tablet stand','charging station organizer','electronics travel organizer','drawer organizer','closet organizer',
'under sink organizer','kitchen organizer','pantry organizer','shower caddy','bathroom organizer','laundry organizer','car visor organizer','car seat organizer','car cup holder organizer','trunk organizer',
'stroller organizer','baby travel organizer','nursery organizer','montessori toys','fine motor toys','dog travel bag','dog walking accessories','cat carrier','packing cubes','toiletry bag organizer',
'travel document organizer','travel pillow','makeup organizer','hair tool organizer','jewelry organizer','shoe organizer','resistance bands','fitness recovery accessories','camping organizer','hiking accessories',
'picnic bag','plant support','tool organizer','no drill shelf','reusable party decorations','birthday decorations','craft organizer','holiday storage organizer','oversized beach towel','microfiber beach towel'
];
const round6=n=>Math.round(Number(n)*1e6)/1e6;
async function api(ep,{method='GET',body=null}={}){const auth='Basic '+Buffer.from(`${login}:${password}`).toString('base64');const r=await fetch(base+ep,{method,headers:{Authorization:auth,'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok)throw new Error(`DATAFORSEO_HTTP_${r.status}`);if(Number(j.status_code)!==20000)throw new Error(`DATAFORSEO_STATUS_${j.status_code}: ${j.status_message||'unknown'}`);return j;}
function responseCost(r){const top=Number(r?.cost);const nested=(r?.tasks||[]).reduce((s,t)=>s+(Number(t?.cost)||0),0);return round6(Number.isFinite(top)&&top>0?top:nested);}
function balanceOf(r){const n=Number(r?.tasks?.[0]?.result?.[0]?.money?.balance);return Number.isFinite(n)?n:null;}
if(!login||!password)throw new Error('DATAFORSEO_CREDENTIALS_MISSING');
const remainingAuthorization=round6(TOTAL_AUTHORIZED_CAP_USD-HISTORICAL_ACCOUNTED_USD);
if(remainingAuthorization<=0)throw new Error('TOTAL_AUTHORIZATION_EXHAUSTED');
const balance=balanceOf(await api(balanceEndpoint));
if(balance===null||balance<=0)throw new Error('DATAFORSEO_BALANCE_UNAVAILABLE');
const effectiveCap=Math.min(ROUND_MAX_SPEND_USD,remainingAuthorization,balance);
let spent=0,stopReason='KEYWORDS_EXHAUSTED';
const byAsin=new Map(),requestLedger=[];
for(let i=0;i<keywords.length;i++){
  if(spent+CONSERVATIVE_MAX_REQUEST_USD>effectiveCap+1e-9){stopReason='ROUND_BUDGET_GUARD';break;}
  const recent=requestLedger.slice(-5);
  if(requestLedger.length>=15&&recent.length===5&&recent.reduce((s,x)=>s+x.newUniqueAsins,0)/5<20){stopReason='MARGINAL_UNIQUE_YIELD_LOW';break;}
  const keyword=keywords[i];
  const response=await api(endpoint,{method:'POST',body:[{keyword,location_code:2840,language_code:'en_US',depth:100,device:'desktop',os:'windows',tag:`mpr-v2-price-scale-r1-${i+1}`}]});
  const cost=responseCost(response);spent=round6(spent+cost);
  if(spent>ROUND_MAX_SPEND_USD+1e-9||HISTORICAL_ACCOUNTED_USD+spent>TOTAL_AUTHORIZED_CAP_USD+1e-9)throw new Error('SPEND_CAP_BREACH');
  const rows=extractDataForSeoAmazonPriceObservations(response);let added=0;
  for(const row of rows){if(!byAsin.has(row.externalProductId)){byAsin.set(row.externalProductId,row);added++;}}
  requestLedger.push({request:i+1,keyword,costUsd:cost,priceObservations:rows.length,newUniqueAsins:added,cumulativeUniqueAsins:byAsin.size,cumulativeSpendUsd:spent,uniquePerUsdCumulative:spent>0?Math.round((byAsin.size/spent)*100)/100:null});
}
const observations=[...byAsin.values()];
const ledger=buildMarketplacePriceLedger(observations.map(normalizeMarketplaceListingSnapshot));
const last5=requestLedger.slice(-5);const last5Avg=last5.length?last5.reduce((s,x)=>s+x.newUniqueAsins,0)/last5.length:null;
const report={schemaVersion:'MPR_DATAFORSEO_AMAZON_PUBLIC_PRICE_SCALE_R1_V1',generatedAt:new Date().toISOString(),endpoint,keywordsPlanned:keywords.length,keywordsAttempted:requestLedger.length,stopReason,uniquePriceObservations:observations.length,providerReportedSpendUsd:spent,priceObservationsPerUsd:spent>0?Math.round((observations.length/spent)*100)/100:null,last5AverageNewUniqueAsins:last5Avg,historicalAccountedSpendBeforeRoundUsd:HISTORICAL_ACCOUNTED_USD,totalAccountedSpendAfterRoundUsd:round6(HISTORICAL_ACCOUNTED_USD+spent),remainingAuthorizedSpendUsd:round6(TOTAL_AUTHORIZED_CAP_USD-HISTORICAL_ACCOUNTED_USD-spent),accountBalanceBeforeRoundUsd:balance,roundHardCapUsd:ROUND_MAX_SPEND_USD,requestLedger,observations,truthPolicy:{...DataForSeoAmazonPriceTruthPolicy,evidenceClass:'PUBLIC_MARKETPLACE_LISTING_PROVIDER_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:false,negotiationIncluded:false,purchaseAuthorized:false}};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
fs.mkdirSync(path.dirname(ledgerPath),{recursive:true});fs.writeFileSync(ledgerPath,JSON.stringify({...ledger,generatedAt:report.generatedAt,sourceRunSchemaVersion:report.schemaVersion,providerSpendUsd:spent,truthPolicy:{...ledger.truthPolicy,providerStructuredPriceIsRealizedSale:false,purchaseAuthorized:false}},null,2)+'\n');
console.log(JSON.stringify({keywordsAttempted:report.keywordsAttempted,stopReason,uniquePriceObservations:report.uniquePriceObservations,providerSpendUsd:spent,priceObservationsPerUsd:report.priceObservationsPerUsd,last5AverageNewUniqueAsins:last5Avg,totalAccountedSpendAfterRoundUsd:report.totalAccountedSpendAfterRoundUsd,remainingAuthorizedSpendUsd:report.remainingAuthorizedSpendUsd},null,2));