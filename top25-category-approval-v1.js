import {FREE_TOP25_LIVE_TAXONOMY} from './free-top25-live-taxonomy-v1.js';

const ids=new Set(FREE_TOP25_LIVE_TAXONOMY.map(row=>row.id));
const https=value=>{try{return new URL(String(value)).protocol==='https:';}catch{return false;}};

export function reviewTop25CategoryMappings(review,{now=new Date()}={}){
  const rows=Array.isArray(review?.niches)?review.niches:[];
  const errors=[];
  const seen=new Set();
  for(const row of rows){
    if(!ids.has(row?.id))errors.push(`UNKNOWN_NICHE:${row?.id}`);
    if(seen.has(row?.id))errors.push(`DUPLICATE_NICHE:${row?.id}`);
    seen.add(row?.id);
    if(row?.mappingStatus==='APPROVED'){
      const reviewedAt=Date.parse(row.reviewedAt);
      if(!String(row.reviewer||'').trim()||!https(row.categoryEvidenceUrl)||!Number.isFinite(reviewedAt)||reviewedAt>now.getTime()||now.getTime()-reviewedAt>90*86_400_000)errors.push(`REVIEW_EVIDENCE_REQUIRED:${row.id}`);
    }
  }
  for(const id of ids)if(!seen.has(id))errors.push(`MISSING_NICHE:${id}`);
  return {ok:errors.length===0,errors,nicheCount:seen.size,approvedCount:rows.filter(row=>row.mappingStatus==='APPROVED').length};
}

export function compileTop25Targets(review,{provider,now=new Date()}={}){
  const validation=reviewTop25CategoryMappings(review,{now});
  if(!validation.ok)return {...validation,targets:[]};
  const field={EBAY_US:'ebayUsCategoryId',EBAY_DE:'ebayDeCategoryId',ALIEXPRESS:'aliexpressCategoryIds'}[provider];
  if(!field)return {ok:false,errors:['PROVIDER_NOT_ALLOWED'],targets:[]};
  const targets=[];
  for(const row of review.niches){
    if(row.mappingStatus!=='APPROVED')continue;
    if(provider==='ALIEXPRESS'){
      const values=Array.isArray(row[field])?row[field].map(String):[];
      if(values.length&&values.every(value=>/^\d+$/.test(value)))targets.push({nicheId:row.id,categoryIds:values});
    }else if(/^\d+$/.test(String(row[field]||'')))targets.push({nicheId:row.id,categoryId:String(row[field]),marketplaceId:provider});
  }
  return {...validation,provider,approvedTargetCount:targets.length,targetNicheCount:25,targets};
}
