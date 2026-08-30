import fs from 'node:fs/promises';
import path from 'node:path';
import {buildEmagSearchUrl} from '../emag-public-search-probe.js';
import {parseEmagRomaniaSellSearchHtml} from '../romania-sell-price-evidence-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return [k,rest.join('=')||true];}));
const out=String(args.out||'artifacts/first-romania-sell-price-observation.json');
const observedAt=new Date().toISOString();
const target={
  amazonAsin:'B09K5927B5',
  supplierListingKey:'1601573810318',
  title:'Organizator de birou cu suport pentru dosare, organizator cu 5 niveluri pentru hartie, cu sertar si 2 suporturi pentru pixuri, organizator de birou din plasa si depozitare cu suport pentru reviste'
};
const query='organizator birou 5 niveluri hartie sertar 2 suporturi pixuri plasa';
const sourceUrl=buildEmagSearchUrl(query);
const headers={
  'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'accept':'text/html,application/xhtml+xml',
  'accept-language':'ro-RO,ro;q=0.9,en;q=0.7'
};
let payload;
try{
  const response=await fetch(sourceUrl,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
  const html=await response.text();
  const parsed=parseEmagRomaniaSellSearchHtml(html,target);
  payload={
    ...parsed,generatedAt:observedAt,observedAt,sourceUrl,statusCode:response.status,htmlBytes:html.length,
    evidenceClass:parsed.selected?'LIVE_PUBLIC_ROMANIA_MARKETPLACE_LISTING_PRICE':'DIAGNOSTIC_ONLY',
    freshnessClass:parsed.selected?'LIVE_PUBLIC_SEARCH_OBSERVATION':'UNUSABLE_LIVE_OBSERVATION',
    selectedObservation:parsed.selected?{
      marketplace:'EMAG',market:'RO',grossPriceRon:parsed.selected.priceRon,currency:'RON',
      title:parsed.selected.title,sourceUrl:parsed.selected.url,observedAt,
      evidenceClass:'LIVE_PUBLIC_ROMANIA_MARKETPLACE_LISTING_PRICE',
      identityStatus:'COMPARABLE_SCREENING_CANDIDATE_NOT_VERIFIED_CANONICAL_IDENTITY',
      titleCoverage:parsed.selected.match.titleCoverage,hardCoverage:parsed.selected.match.hardCoverage
    }:null,
    policy:{providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,purchaseAuthorized:false,automaticEconomicPromotion:false}
  };
}catch(error){
  payload={
    schemaVersion:'MPR_ROMANIA_SELL_PRICE_EVIDENCE_V1',generatedAt:observedAt,observedAt,market:'RO',marketplace:'EMAG',target,
    sourceUrl,statusCode:null,htmlBytes:0,status:'BLOCKED',blockers:['LIVE_FETCH_FAILED','NO_COMPARABLE_CURRENT_RON_PRICE'],
    candidates:[],selected:null,selectedObservation:null,evidenceClass:'DIAGNOSTIC_ONLY',freshnessClass:'UNUSABLE_LIVE_OBSERVATION',
    error:String(error?.message||error),
    truthPolicy:{publicListingPriceIsRealizedSale:false,searchResultIsVerifiedIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false},
    policy:{providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,purchaseAuthorized:false,automaticEconomicPromotion:false}
  };
}
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({status:payload.status,sourceUrl,selectedObservation:payload.selectedObservation,blockers:payload.blockers},null,2));
if(payload.status!=='PRICE_OBSERVED_COMPARABLE')process.exitCode=2;
