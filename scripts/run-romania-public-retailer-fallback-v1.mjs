import fs from 'node:fs/promises';
import path from 'node:path';
import {parseUnchilipirCategoryHtml} from '../romania-public-retailer-price-evidence-v1.js';

const sourceUrl='https://unchilipir.ro/accesorii-de-birou-si-produse-de-depozitare/';
const out=process.argv[2]||'artifacts/romania-public-retailer-fallback.json';
const observedAt=new Date().toISOString();
let payload;
try{
  const r=await fetch(sourceUrl,{headers:{'user-agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'ro-RO,ro;q=0.9,en;q=0.7'},redirect:'follow',signal:AbortSignal.timeout(15000)});
  const html=await r.text();
  payload={...parseUnchilipirCategoryHtml(html,sourceUrl),observedAt,statusCode:r.status,htmlBytes:html.length,sourceUrl,policy:{providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,purchaseAuthorized:false,automaticEconomicPromotion:false}};
}catch(error){
  payload={schemaVersion:'MPR_ROMANIA_PUBLIC_RETAILER_PRICE_EVIDENCE_V1',market:'RO',retailer:'UNCHILIPIR',status:'BLOCKED',blockers:['FETCH_FAILED','NO_COMPARABLE_CURRENT_RON_PRICE'],selected:null,observedAt,sourceUrl,error:String(error?.message||error),policy:{providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,purchaseAuthorized:false,automaticEconomicPromotion:false},truthPolicy:{publicListingPriceIsRealizedSale:false,retailerListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}};
}
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({status:payload.status,priceRon:payload.selected?.priceRon??null,blockers:payload.blockers??[],statusCode:payload.statusCode??null},null,2));
