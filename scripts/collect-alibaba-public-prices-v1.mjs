import fs from 'node:fs/promises';
import path from 'node:path';
import {extractAlibabaPublicPrice} from '../alibaba-public-price-extractor-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const input=String(args.input||'artifacts/real-public-seed-1000.json');
const out=String(args.out||'artifacts/alibaba-public-prices-v1.json');
const limit=Math.max(1,Math.min(500,Number(args.limit)||100));
const sleepMs=Math.max(0,Math.min(5000,Number(args.sleepMs)||250));
const observedAt=new Date().toISOString();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const seed=JSON.parse(await fs.readFile(input,'utf8'));
const rows=(Array.isArray(seed?.observations)?seed.observations:[]).filter(x=>String(x?.platform||'').toUpperCase()==='ALIBABA'&&String(x?.url||'').includes('/product-detail/')).slice(0,limit);

async function fetchPage(url){
  const headers={'user-agent':'Mozilla/5.0 (compatible; MegaProductRadar/2.0; public-price-research)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(18000)});
  const text=await r.text();
  return{statusCode:r.status,ok:r.ok,text};
}

const accepted=[];const diagnostics=[];
for(const row of rows){
  const supplierListingId=String(row.externalId||'').trim()||String(row.url).match(/_(\d{8,})\.html/i)?.[1]||null;
  try{
    const page=await fetchPage(row.url);
    const extraction=extractAlibabaPublicPrice(page.text,{sourceUrl:row.url,observedAt});
    const diag={supplierListingId,url:row.url,statusCode:page.statusCode,httpOk:page.ok,htmlBytes:page.text.length,validPriceEvidence:page.ok&&extraction.valid,blockers:page.ok?extraction.blockers:['HTTP_NOT_OK',...extraction.blockers]};
    diagnostics.push(diag);
    if(page.ok&&extraction.valid&&supplierListingId){
      accepted.push({
        platform:'ALIBABA',supplierListingId,supplierName:null,sourceUrl:row.url,title:row.title||null,currency:extraction.currency,publicPriceMin:extraction.publicPriceMin,publicPriceMax:extraction.publicPriceMax,priceTiers:[],moq:extraction.moq,targetOrderQuantity:null,priceUnit:extraction.priceUnit,observedAt,linkedMarketplaceCanonicalProductId:null,supplierFingerprintId:null,variantAttributes:{},extractionMethod:extraction.extractionMethod,extractionConfidence:extraction.confidence,evidenceClass:'PUBLIC_SUPPLIER_LISTING'
      });
    }
  }catch(error){diagnostics.push({supplierListingId,url:row.url,statusCode:null,httpOk:false,htmlBytes:0,validPriceEvidence:false,blockers:['FETCH_FAILED'],error:String(error?.message||error)});}
  if(sleepMs)await sleep(sleepMs);
}

const output={schemaVersion:'MPR_ALIBABA_PUBLIC_PRICE_COLLECTION_V1',generatedAt:observedAt,input,requested:rows.length,acceptedPriceObservations:accepted.length,rejectedOrUnresolved:diagnostics.length-accepted.length,observations:accepted,diagnostics,policy:{publicListingIsVerifiedQuote:false,publicSupplierPriceIsLandedCost:false,negotiationIncluded:false,unknownEqualsZero:false,paidCallsTriggered:0,providerSpend:0,purchaseAuthorized:false}};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out,requested:output.requested,acceptedPriceObservations:output.acceptedPriceObservations,rejectedOrUnresolved:output.rejectedOrUnresolved},null,2));
