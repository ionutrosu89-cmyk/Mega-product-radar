import fs from 'node:fs';
import path from 'node:path';
import {extractDataForSeoAmazonPriceObservations,DataForSeoAmazonPriceTruthPolicy} from '../dataforseo-amazon-price-v1.js';
import {buildMarketplacePriceLedger,normalizeMarketplaceListingSnapshot} from '../marketplace-price-ledger-v1.js';

const arg=(name,fallback)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const outPath=arg('out','artifacts/dataforseo-amazon-price-pilot-v1.json');
const ledgerPath=arg('ledger','artifacts/dataforseo-amazon-price-ledger-pilot-v1.json');
const dryRun=String(arg('dryRun',process.env.MPR_DATAFORSEO_DRY_RUN||'false')).toLowerCase()==='true';
const login=process.env.DATAFORSEO_LOGIN||process.env.DATAFORSEO_API_LOGIN||'';
const password=process.env.DATAFORSEO_PASSWORD||process.env.DATAFORSEO_API_PASSWORD||'';
const base='https://api.dataforseo.com';
const endpoint='/v3/merchant/amazon/products/live/advanced';
const balanceEndpoint='/v3/appendix/user_data';

const HISTORICAL_ACCOUNTED_USD=11.13414;
const TOTAL_AUTHORIZED_CAP_USD=15;
const PILOT_MAX_SPEND_USD=0.10;
const CONSERVATIVE_MAX_REQUEST_USD=0.01;
const keywords=['desk organizer','car seat organizer','stroller organizer','packing cubes','oversized beach towel'];
const round6=n=>Math.round(Number(n)*1e6)/1e6;

async function api(endpoint,{method='GET',body=null}={}){
  const auth='Basic '+Buffer.from(`${login}:${password}`).toString('base64');
  const res=await fetch(base+endpoint,{method,headers:{Authorization:auth,'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const json=await res.json();
  if(!res.ok)throw new Error(`DATAFORSEO_HTTP_${res.status}`);
  if(Number(json.status_code)!==20000)throw new Error(`DATAFORSEO_STATUS_${json.status_code}: ${json.status_message||'unknown'}`);
  return json;
}
function responseCost(response){
  const top=Number(response?.cost);
  const nested=(response?.tasks||[]).reduce((s,t)=>s+(Number(t?.cost)||0),0);
  return round6(Number.isFinite(top)&&top>0?top:nested);
}
function balanceOf(response){
  const n=Number(response?.tasks?.[0]?.result?.[0]?.money?.balance);
  return Number.isFinite(n)?n:null;
}
function dryResponse(keyword,index){
  const asin=`B0${String(index+1).padStart(8,'0')}`.slice(0,10);
  return{status_code:20000,cost:0,tasks:[{cost:0,result:[{datetime:'2026-08-29 17:00:00 +00:00',check_url:`https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`,items:[{type:'amazon_serp',data_asin:asin,title:`Dry ${keyword}`,url:`https://www.amazon.com/dp/${asin}`,price_from:10+index,price_to:12+index,currency:'USD',bought_past_month:100,rating:{value:4.5,votes_count:50}}]}]}]};
}

if(!dryRun&&(!login||!password))throw new Error('DATAFORSEO_CREDENTIALS_MISSING');
const remainingAuthorizationUsd=round6(TOTAL_AUTHORIZED_CAP_USD-HISTORICAL_ACCOUNTED_USD);
if(remainingAuthorizationUsd<=0)throw new Error('TOTAL_AUTHORIZATION_EXHAUSTED');
let accountBalanceBeforeUsd=null;
if(!dryRun){
  accountBalanceBeforeUsd=balanceOf(await api(balanceEndpoint));
  if(accountBalanceBeforeUsd===null)throw new Error('DATAFORSEO_BALANCE_UNKNOWN');
  if(accountBalanceBeforeUsd<=0)throw new Error('DATAFORSEO_BALANCE_EMPTY');
}
const effectivePilotCapUsd=Math.min(PILOT_MAX_SPEND_USD,remainingAuthorizationUsd,dryRun?PILOT_MAX_SPEND_USD:accountBalanceBeforeUsd);
let spent=0;
const requestLedger=[];
const observationsByAsin=new Map();
for(let i=0;i<keywords.length;i++){
  if(spent+CONSERVATIVE_MAX_REQUEST_USD>effectivePilotCapUsd+1e-9)break;
  if(HISTORICAL_ACCOUNTED_USD+spent+CONSERVATIVE_MAX_REQUEST_USD>TOTAL_AUTHORIZED_CAP_USD+1e-9)break;
  const keyword=keywords[i];
  const response=dryRun?dryResponse(keyword,i):await api(endpoint,{method:'POST',body:[{keyword,location_code:2840,language_code:'en_US',depth:100,device:'desktop',os:'windows',tag:`mpr-v2-price-pilot-${i+1}`}]});
  const cost=dryRun?0:responseCost(response);
  spent=round6(spent+cost);
  if(spent>PILOT_MAX_SPEND_USD+1e-9)throw new Error(`PILOT_SPEND_CAP_BREACH: ${spent}`);
  if(HISTORICAL_ACCOUNTED_USD+spent>TOTAL_AUTHORIZED_CAP_USD+1e-9)throw new Error(`TOTAL_SPEND_CAP_BREACH: ${HISTORICAL_ACCOUNTED_USD+spent}`);
  const rows=extractDataForSeoAmazonPriceObservations(response);
  let added=0;
  for(const row of rows){if(!observationsByAsin.has(row.externalProductId)){observationsByAsin.set(row.externalProductId,row);added++;}}
  requestLedger.push({keyword,costUsd:cost,priceObservations:rows.length,newUniqueAsins:added,cumulativeUniqueAsins:observationsByAsin.size,cumulativePilotSpendUsd:spent,cumulativeTotalAccountedUsd:round6(HISTORICAL_ACCOUNTED_USD+spent)});
}
const observations=[...observationsByAsin.values()];
const normalized=observations.map(normalizeMarketplaceListingSnapshot);
const ledger=buildMarketplacePriceLedger(normalized);
const boughtSignalCount=observations.filter(x=>x.provenance?.amazonDisplayedBoughtPastMonth!==null&&x.provenance?.amazonDisplayedBoughtPastMonth!==undefined).length;
const report={schemaVersion:'MPR_DATAFORSEO_AMAZON_PUBLIC_PRICE_PILOT_V1',generatedAt:new Date().toISOString(),dryRun,endpoint,keywordsAttempted:requestLedger.length,keywordsPlanned:keywords.length,uniquePriceObservations:observations.length,boughtPastMonthDisplayedSignalCount:boughtSignalCount,providerReportedSpendUsd:spent,historicalAccountedSpendUsd:HISTORICAL_ACCOUNTED_USD,totalAccountedSpendAfterPilotUsd:round6(HISTORICAL_ACCOUNTED_USD+spent),totalAuthorizedCapUsd:TOTAL_AUTHORIZED_CAP_USD,pilotMaxSpendUsd:PILOT_MAX_SPEND_USD,remainingAuthorizationBeforePilotUsd:remainingAuthorizationUsd,accountBalanceBeforeUsd,effectivePilotCapUsd,requestLedger,observations,truthPolicy:{...DataForSeoAmazonPriceTruthPolicy,evidenceClass:'PUBLIC_MARKETPLACE_LISTING_PROVIDER_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,negotiationIncluded:false,purchaseAuthorized:false}};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
fs.mkdirSync(path.dirname(ledgerPath),{recursive:true});
fs.writeFileSync(ledgerPath,JSON.stringify({...ledger,generatedAt:report.generatedAt,sourceRunSchemaVersion:report.schemaVersion,sourceEvidenceClass:'PUBLIC_MARKETPLACE_LISTING_PROVIDER_OBSERVATION',providerSpendUsd:spent,truthPolicy:{...ledger.truthPolicy,providerStructuredPriceIsRealizedSale:false,amazonDisplayedBoughtPastMonthIsVerifiedSales:false,purchaseAuthorized:false}},null,2)+'\n');
console.log(JSON.stringify({out:outPath,ledger:ledgerPath,keywordsAttempted:report.keywordsAttempted,uniquePriceObservations:report.uniquePriceObservations,ledgerListings:ledger.listingCount,providerSpendUsd:spent,totalAccountedSpendAfterPilotUsd:report.totalAccountedSpendAfterPilotUsd},null,2));
