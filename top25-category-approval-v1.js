import {FREE_TOP25_LIVE_TAXONOMY} from './free-top25-live-taxonomy-v1.js';

const ids=new Set(FREE_TOP25_LIVE_TAXONOMY.map(row=>row.id));
const https=value=>{try{return new URL(String(value)).protocol==='https:';}catch{return false;}};
const officialEvidenceHosts=Object.freeze({
  EBAY_US:new Set(['www.ebay.com','ebay.com','api.ebay.com','developer.ebay.com']),
  EBAY_DE:new Set(['www.ebay.de','ebay.de','api.ebay.com','developer.ebay.com']),
  ALIEXPRESS:new Set(['www.aliexpress.com','aliexpress.com','developer.alibaba.com'])
});

export function approvedTop25CategoryTarget(row,{provider,now=new Date()}={}){
  const nicheId=String(row?.nicheId??'').trim().toUpperCase();
  const checkedAt=now instanceof Date?now:new Date(now);
  const reviewedAt=Date.parse(row?.reviewedAt||'');
  let evidence;
  try{evidence=new URL(row?.categoryEvidenceUrl);}catch{return null;}
  if(!ids.has(nicheId)||!officialEvidenceHosts[provider]||!Number.isFinite(checkedAt.getTime())||
    row?.mappingStatus!=='APPROVED'||!String(row?.reviewer??'').trim()||
    !Number.isFinite(reviewedAt)||reviewedAt>checkedAt.getTime()||checkedAt.getTime()-reviewedAt>90*86_400_000||
    evidence.protocol!=='https:'||!officialEvidenceHosts[provider].has(evidence.hostname))return null;
  if(provider==='ALIEXPRESS'){
    const categoryIds=Array.isArray(row?.categoryIds)?row.categoryIds.map(String):[];
    if(!categoryIds.length||categoryIds.length>5||categoryIds.some(id=>!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0)||new Set(categoryIds).size!==categoryIds.length)return null;
    return {nicheId,categoryIds,reviewer:String(row.reviewer).trim(),reviewedAt:new Date(reviewedAt).toISOString(),categoryEvidenceUrl:evidence.href};
  }
  const categoryId=String(row?.categoryId??'').trim();
  if(!/^\d+$/.test(categoryId)||!Number.isSafeInteger(Number(categoryId))||Number(categoryId)<=0||String(row?.marketplaceId??'').trim().toUpperCase()!==provider)return null;
  return {nicheId,categoryId,marketplaceId:provider,reviewer:String(row.reviewer).trim(),reviewedAt:new Date(reviewedAt).toISOString(),categoryEvidenceUrl:evidence.href};
}

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
    const providerReview=row.providerReviews?.[provider];
    if(!providerReview)continue;
    if(provider==='ALIEXPRESS'){
      const values=Array.isArray(row[field])?row[field].map(String):[];
      const target=approvedTop25CategoryTarget({...providerReview,nicheId:row.id,categoryIds:values},{provider,now});
      if(target)targets.push(target);
    }else{
      const target=approvedTop25CategoryTarget({...providerReview,nicheId:row.id,categoryId:row[field],marketplaceId:provider},{provider,now});
      if(target)targets.push(target);
    }
  }
  return {...validation,provider,approvedTargetCount:targets.length,targetNicheCount:25,targets};
}
