import {canonicalIdentitySeed} from './canonical-product-identity-v1.js';

const text=v=>String(v??'').trim();
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const pct=(n,d)=>d>0?Number(((n/d)*100).toFixed(2)):0;

export function measureCompactBootstrapSource(dataset={}){
  const fields=Array.isArray(dataset.fields)?dataset.fields:[];
  const rows=Array.isArray(dataset.products)?dataset.products:[];
  const index=Object.fromEntries(fields.map((name,i)=>[name,i]));
  const get=(row,name)=>index[name]===undefined?undefined:row[index[name]];
  const uniqueAsins=new Set();
  let withTitle=0,withBrand=0,withCategory=0,withPrice=0,withRating=0,withReviews=0,sourceUrlIdentityMatch=0;
  const rejected=[];
  for(const row of rows){
    const asin=text(get(row,'asin'));
    if(!asin){rejected.push({reason:'ASIN_REQUIRED'});continue;}
    if(uniqueAsins.has(asin)){rejected.push({reason:'DUPLICATE_ASIN',asin});continue;}
    uniqueAsins.add(asin);
    if(text(get(row,'title')))withTitle++;
    if(text(get(row,'brand')))withBrand++;
    if(text(get(row,'categoryLabel')))withCategory++;
    if(finite(get(row,'price'))!==null)withPrice++;
    if(finite(get(row,'rating'))!==null)withRating++;
    if(finite(get(row,'reviewCount'))!==null)withReviews++;
    if(get(row,'sourceUrlIdentityMatch')===true)sourceUrlIdentityMatch++;
  }
  const count=uniqueAsins.size;
  return Object.freeze({
    schemaVersion:'MPR_BOOTSTRAP_SOURCE_COVERAGE_V1',sourceProductCount:count,rejectedCount:rejected.length,
    coverage:Object.freeze({sourceIdentityCoveragePct:pct(count,count),titleCoveragePct:pct(withTitle,count),brandCoveragePct:pct(withBrand,count),categoryCoveragePct:pct(withCategory,count),priceCoveragePct:pct(withPrice,count),ratingCoveragePct:pct(withRating,count),reviewCoveragePct:pct(withReviews,count),sourceUrlIdentityMatchPct:pct(sourceUrlIdentityMatch,count)}),
    canonicalBinding:Object.freeze({measured:false,status:'UNKNOWN_SERVER_CANONICAL_REGISTRY_NOT_PRESENT_IN_PUBLIC_DATASET',canonicalProducts:null,boundAliases:null}),
    decisionEligibility:'NOT_MEASURED_UNTIL_EXACT_ALIASES_ARE_RESOLVED_AGAINST_CANONICAL_REGISTRY',scaleAuthorized:false,
    policy:'RAW_SOURCE_COVERAGE_IS_NOT_CANONICAL_COVERAGE; EXACT_ASIN_IDENTITY_ONLY; NO_TITLE_BINDING; NO_VERIFIED_SALES_INFERENCE',
    paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false
  });
}

export function planCanonicalBootstrapResolution(dataset={}){
  const fields=Array.isArray(dataset.fields)?dataset.fields:[];
  const rows=Array.isArray(dataset.products)?dataset.products:[];
  const asinIndex=fields.indexOf('asin'),titleIndex=fields.indexOf('title');
  const seen=new Set(),items=[],rejected=[];
  for(const row of rows){
    const asin=text(row?.[asinIndex]);
    if(!asin){rejected.push({reason:'ASIN_REQUIRED'});continue;}
    if(seen.has(asin)){rejected.push({reason:'DUPLICATE_ASIN',asin});continue;}
    seen.add(asin);
    const seed=canonicalIdentitySeed({platform:'AMAZON',externalId:asin,title:titleIndex>=0?row?.[titleIndex]:null});
    if(!seed.valid){rejected.push({reason:'INVALID_SOURCE_ALIAS',asin});continue;}
    items.push(Object.freeze({platform:'AMAZON',externalId:asin,stagingCanonicalKey:seed.canonicalKey,observedTitle:seed.alias.observedTitle,operation:'RESOLVE_EXISTING_ALIAS_OR_CREATE_CANONICAL_SERVER_SIDE'}));
  }
  return Object.freeze({schemaVersion:'MPR_CANONICAL_BOOTSTRAP_RESOLUTION_PLAN_V1',items:Object.freeze(items),rejected:Object.freeze(rejected),serverResolutionRequired:true,clientGeneratedCanonicalUuid:false,titleAutoMergeAllowed:false,automaticExecutionAllowed:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});
}
