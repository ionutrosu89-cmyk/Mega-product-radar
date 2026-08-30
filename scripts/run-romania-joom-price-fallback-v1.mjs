import fs from 'node:fs/promises';
import path from 'node:path';
import {parseJoomRomaniaHtml} from '../romania-joom-price-evidence-v1.js';

const sourceUrl='https://www.joom.com/ro/best/sertare-din-plastic-negru-2145548';
const out=process.argv[2]||'artifacts/romania-joom-price-fallback.json';
const observedAt=new Date().toISOString();
const policy={providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,purchaseAuthorized:false,automaticEconomicPromotion:false};
const truthPolicy={publicListingPriceIsRealizedSale:false,localizedMarketplaceListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false};
let payload;
try{
  const response=await fetch(sourceUrl,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'ro-RO,ro;q=0.9,en;q=0.7'},redirect:'follow',signal:AbortSignal.timeout(15000)});
  const html=await response.text();
  const parsed=parseJoomRomaniaHtml(html,sourceUrl);
  payload={...parsed,observedAt,statusCode:response.status,htmlBytes:html.length,sourceUrl,policy,truthPolicy};
  if(!response.ok&&payload.status!=='BLOCKED')payload={...payload,status:'BLOCKED',blockers:['HTTP_NOT_OK'],selected:null};
}catch(error){
  payload={schemaVersion:'MPR_ROMANIA_JOOM_PRICE_EVIDENCE_V1',market:'RO',marketplace:'JOOM_RO',status:'BLOCKED',blockers:['FETCH_FAILED'],selected:null,candidates:[],observedAt,sourceUrl,error:String(error?.message||error),policy,truthPolicy};
}
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({status:payload.status,priceRon:payload.selected?.priceRon??null,blockers:payload.blockers??[],statusCode:payload.statusCode??null,htmlBytes:payload.htmlBytes??0},null,2));
