import fs from 'node:fs/promises';
import path from 'node:path';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from '../marketplace-supplier-matching-v1.js';
import {parseRobustDimensions,deriveSupplierSingleUnitPackEvidence,canonicalMaterialForMatching} from '../public-detail-fusion-evidence-v1.js';

const oldPath=process.argv[2]||'artifacts/top-enrichment/summary.json';
const supplierDetailPath=process.argv[3]||'artifacts/supplier-detail/normalized-detail-evidence.json';
const supplierRawPath=process.argv[4]||'artifacts/supplier-detail/raw.json';
const outPath=process.argv[5]||'artifacts/post-detail-fusion-match.json';

const [oldDoc,detailDoc,rawRows]=await Promise.all([
  fs.readFile(oldPath,'utf8').then(JSON.parse),
  fs.readFile(supplierDetailPath,'utf8').then(JSON.parse),
  fs.readFile(supplierRawPath,'utf8').then(JSON.parse)
]);
const oldRows=Array.isArray(oldDoc?.rows)?oldDoc.rows:[];
const details=Array.isArray(detailDoc?.details)?detailDoc.details:[];
const detailById=new Map(details.map(x=>[String(x.supplierListingId),x]));
const rawById=new Map((Array.isArray(rawRows)?rawRows:[]).map(x=>[String(x.productId??x.id),x]));

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const textOnly=s=>clean(decode(String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')));
async function fetchAmazonEvidence(asin){
  const url=`https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(20000)});
    const html=await r.text();
    const blocked=/robot check|enter the characters you see below|sorry! something went wrong/i.test(html);
    const body=textOnly(html).slice(0,200000);
    const keys=['Product Dimensions','Item Dimensions','Dimensions'];
    let dimensionWindow='';
    for(const k of keys){const i=body.toLowerCase().indexOf(k.toLowerCase());if(i>=0){dimensionWindow=body.slice(i,Math.min(body.length,i+500));break;}}
    return {ok:r.ok&&!blocked,blocked,statusCode:r.status,dimensionWindow,dimensions:parseRobustDimensions(dimensionWindow)};
  }catch(e){return {ok:false,blocked:false,statusCode:null,dimensionWindow:'',dimensions:null,error:String(e?.message||e)};}
}

const output=[];
for(const row of oldRows){
  const id=String(row.supplierListingKey);
  const detail=detailById.get(id);
  const raw=rawById.get(id);
  if(!detail||!raw){output.push({...row,status:'BLOCKED_MISSING_SUPPLIER_DETAIL'});continue;}
  const amazonLive=await fetchAmazonEvidence(row.amazonAsin);
  const oldA=row.amazonExtracted??{};
  const s=detail.evidence?.fingerprintEvidence??{};
  const amazonDimensions=oldA.dimensions??amazonLive.dimensions??parseRobustDimensions(oldA.sourceTitle??row.marketplaceTitle);
  const packEvidence=deriveSupplierSingleUnitPackEvidence({priceUnit:raw.priceUnit,productType:s.productType,title:detail.evidence?.title??row.supplierTitle});
  const mpInput={
    productType:oldA.productType,primaryFunction:oldA.primaryFunction,packCount:oldA.packCount,
    material:canonicalMaterialForMatching(oldA.material),dimensions:amazonDimensions,
    formFactor:oldA.formFactor,technicalSpecs:oldA.technicalSpecs,sourceTitle:row.marketplaceTitle
  };
  const spInput={
    productType:s.productType,primaryFunction:s.primaryFunction,packCount:packEvidence.packCount,
    material:canonicalMaterialForMatching(s.material),dimensions:s.dimensions,
    unitWeightGrams:s.unitWeightGrams,formFactor:s.formFactor,technicalSpecs:s.technicalSpecs,sourceTitle:row.supplierTitle
  };
  const match=matchMarketplaceToSupplier(buildProductFingerprint(mpInput),buildProductFingerprint(spInput),{screeningThreshold:80});
  output.push({
    amazonAsin:row.amazonAsin,supplierListingKey:id,marketplaceTitle:row.marketplaceTitle,supplierTitle:row.supplierTitle,
    marketplacePrice:row.marketplacePrice,supplierPriceMax:row.supplierPriceMax,supplierMoq:row.supplierMoq,supplierPriceTiers:row.supplierPriceTiers,
    amazonEvidence:{...mpInput,liveDimensionFetch:{ok:amazonLive.ok,blocked:amazonLive.blocked,statusCode:amazonLive.statusCode,dimensionWindow:amazonLive.dimensionWindow}},
    supplierEvidence:{...spInput,priceUnit:raw.priceUnit,categoryId:raw.categoryId??null,packEvidence,attributeCount:detail.evidence?.coverage?.attributeCount??0},
    match,
    evidenceClass:'POST_DETAIL_FUSED_PUBLIC_EVIDENCE',
    truthPolicy:{derivedPackCountIsDirectSupplierClaim:false,publicSupplierDetailIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,unknownEqualsZero:false,matchingThresholdRelaxed:false,purchaseAuthorized:false,negotiationIncluded:false}
  });
  await new Promise(r=>setTimeout(r,250));
}
output.sort((a,b)=>(b.match?.matchConfidence??-1)-(a.match?.matchConfidence??-1));
const eligible=output.filter(x=>x.match?.screeningEconomicsEligible);
const summary={
  schemaVersion:'MPR_POST_DETAIL_FUSION_MATCH_V1',generatedAt:new Date().toISOString(),pairCount:output.length,
  supplierDetailRows:details.length,amazonLiveDimensionFetchOk:output.filter(x=>x.amazonEvidence?.liveDimensionFetch?.ok).length,
  amazonDimensionsKnown:output.filter(x=>x.amazonEvidence?.dimensions).length,supplierDimensionsKnown:output.filter(x=>x.supplierEvidence?.dimensions).length,
  supplierDerivedPackOneCount:output.filter(x=>x.supplierEvidence?.packEvidence?.derived).length,
  maxMatchConfidence:output.length?Math.max(...output.map(x=>x.match?.matchConfidence??0)):null,
  screeningEligibleMatchCount:eligible.length,eligiblePairs:eligible,rows:output,
  policy:{paidCallsTriggered:0,providerSpendUsd:0,matchingThreshold:80,matchingThresholdRelaxed:false,unknownEqualsZero:false,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,rows:undefined,eligiblePairs:eligible.map(x=>({amazonAsin:x.amazonAsin,supplierListingKey:x.supplierListingKey,matchConfidence:x.match.matchConfidence,matchClass:x.match.matchClass}))},null,2));
