import {classifyPublicBrandGate} from './brand-policy-v1.js';

const DAY_MS=86_400_000;
const clean=value=>String(value??'').trim();
const normalize=value=>clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const OFFICE=/(?:\bdesk\b|\boffice\b|\bstationery\b|\bbirou\b|\bpapetarie\b)/;
const ORGANIZATION=/(?:\borganiz|\borganis|\bstorage\b|\bholder\b|\btray\b|\bdrawer\b|\bcable\b|\bfile\b|\bdocument\b|\bsertar\b|\bdosar\b|\btava\b)/;

export const OPF_SOURCE_URL='https://static.openproductsfacts.org/data/openproductsfacts-products.jsonl.gz';

export function evaluateOpenProductsFactsRecord(raw,{now=new Date(),maxAgeDays=90}={}){
  const code=clean(raw?.code||raw?._id),name=clean(raw?.product_name||raw?.product_name_en);
  const brand=clean(raw?.brands),categories=Array.isArray(raw?.categories_tags)?raw.categories_tags.join(' '):clean(raw?.categories);
  if(!/^\d{8,14}$/.test(code)||name.length<5||name.length>220)return {status:'INVALID_IDENTITY'};
  const context=normalize(`${name} ${categories}`);
  if(!OFFICE.test(context)||!ORGANIZATION.test(context))return {status:'OUT_OF_NICHE'};
  const modifiedSeconds=Number(raw?.last_modified_t),nowMs=now.getTime();
  if(!Number.isSafeInteger(modifiedSeconds)||modifiedSeconds<=0||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxAgeDays)||maxAgeDays<1)return {status:'DATE_UNKNOWN'};
  const observedAt=new Date(modifiedSeconds*1000),ageMs=nowMs-observedAt.getTime();
  if(!Number.isFinite(observedAt.getTime())||ageMs<0)return {status:'DATE_UNKNOWN'};
  if(ageMs>maxAgeDays*DAY_MS)return {status:'STALE_RECORD'};
  const gate=classifyPublicBrandGate({name,brand});
  if(!gate.commercialEligible)return {status:'ESTABLISHED_BRAND'};
  return {status:'HUMAN_REVIEW_REQUIRED',candidate:{sourceKey:'OPEN_PRODUCTS_FACTS',sourceLicense:'ODbL-1.0',nicheId:'BIROU_ORGANIZARE',code,name,brand:brand||null,categories:categories.slice(0,300),sourceUrl:`https://world.openproductsfacts.org/product/${code}`,recordModifiedAt:observedAt.toISOString(),fetchedAt:null,brandPolicyClass:'UNKNOWN_REVIEW',sourceRank:null,salesEvidenceClass:'NONE',published:false}};
}

export function createOpenProductsFactsPilot({now=new Date(),maxAgeDays=90,maxCandidates=100}={}){
  if(!Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>1000)throw new Error('INVALID_CANDIDATE_LIMIT');
  const counts={total:0,INVALID_JSON:0,INVALID_IDENTITY:0,OUT_OF_NICHE:0,DATE_UNKNOWN:0,STALE_RECORD:0,ESTABLISHED_BRAND:0,HUMAN_REVIEW_REQUIRED:0};
  const candidates=[];
  function add(raw){
    counts.total++;
    const result=evaluateOpenProductsFactsRecord(raw,{now,maxAgeDays});
    counts[result.status]++;
    if(result.status!=='HUMAN_REVIEW_REQUIRED')return;
    const item=result.candidate;
    const existing=candidates.findIndex(row=>row.code===item.code);
    if(existing>=0){
      if(candidates[existing].recordModifiedAt>=item.recordModifiedAt)return;
      candidates.splice(existing,1);
    }
    candidates.push(item);
    candidates.sort((a,b)=>b.recordModifiedAt.localeCompare(a.recordModifiedAt)||a.code.localeCompare(b.code));
    if(candidates.length>maxCandidates)candidates.pop();
  }
  function invalidJson(){counts.total++;counts.INVALID_JSON++;}
  function report(){return {schema:'MPR_OPF_PRIVATE_PILOT_V1',source:'Open Products Facts',sourceUrl:OPF_SOURCE_URL,sourceLicense:'ODbL-1.0',nicheId:'BIROU_ORGANIZARE',checkedAt:now.toISOString(),maxAgeDays,counts:{...counts},candidateCount:candidates.length,candidates:candidates.map(row=>({...row})),policy:{privateReviewOnly:true,sourceModifiedIsNotMarketplaceObservation:true,noSalesRank:true,noAutomaticPublication:true,establishedBrandsExcluded:true}};}
  return {add,invalidJson,report};
}
