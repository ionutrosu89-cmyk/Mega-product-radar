import {selectGenericOpportunities} from './top25-generic-selection-v1.js';
import {CURRENT_TOP25_PLATFORM_POLICY} from './top25-current-snapshot-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const https=value=>{try{return new URL(clean(value)).protocol==='https:';}catch{return false;}};
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(value).toISOString():null;

// A marketplace list is source evidence. This separate snapshot is MPR's
// human-reviewed, brand-filtered selection; its rank is never the source rank.
export function normalizeGenericTop25Snapshot(raw={},reviews={},options={}){
  const now=options.now instanceof Date?options.now:new Date(options.now||Date.now());
  const nicheId=upper(raw.nicheId||raw.niche_id),sourcePlatform=upper(raw.sourcePlatform),market=upper(raw.market),sourceKey=upper(raw.sourceKey||raw.source_key);
  const policy=CURRENT_TOP25_PLATFORM_POLICY[sourcePlatform];
  if(!policy)return {ok:false,code:'SOURCE_PLATFORM_NOT_ALLOWED'};
  if(!policy.markets.has(market)||!policy.sourceKeys.has(sourceKey))return {ok:false,code:'SOURCE_NOT_ALLOWED'};
  if(options.rightsApproved!==true)return {ok:false,code:'PUBLIC_DISPLAY_RIGHTS_REQUIRED'};
  if(!Number.isFinite(now.getTime()))return {ok:false,code:'INVALID_REVIEW_TIME'};
  const selected=selectGenericOpportunities(raw.candidates,reviews,{nicheId,targetCount:25});
  if(!selected.ok)return {ok:false,code:selected.code,selectedCount:selected.selectedCount||0,pendingCount:selected.pendingCount||0};
  const products=[];
  for(const row of selected.selected){
    const name=clean(row.name||row.title).slice(0,220),sourceUrl=clean(row.sourceUrl).slice(0,500),observedAt=iso(row.observedAt);
    const sourceRank=Number(row.sourceRank),brandReviewedAt=Date.parse(row.brandReview?.reviewedAt||''),nicheReviewedAt=Date.parse(row.nicheReview?.reviewedAt||'');
    if(!name||!https(sourceUrl)||!policy.host.test(new URL(sourceUrl).hostname)||!observedAt||!Number.isInteger(sourceRank)||sourceRank<row.opportunityRank)return {ok:false,code:'INVALID_CURATED_PRODUCT'};
    const ageMs=now.getTime()-Date.parse(observedAt);
    if(ageMs<0||ageMs>policy.freshnessHours*3_600_000)return {ok:false,code:'STALE_CURATED_PRODUCT'};
    if(![brandReviewedAt,nicheReviewedAt].every(value=>Number.isFinite(value)&&value<=now.getTime()&&now.getTime()-value<=30*86_400_000))return {ok:false,code:'STALE_OR_FUTURE_HUMAN_REVIEW'};
    if(!https(row.brandReview?.evidenceUrl)||!https(row.nicheReview?.evidenceUrl))return {ok:false,code:'REVIEW_EVIDENCE_REQUIRED'};
    products.push({
      name,externalId:clean(row.externalId).slice(0,120),rank:row.opportunityRank,sourceRank,sourcePlatform,market,sourceUrl,observedAt,sourceKey,
      sourceLabel:clean(raw.sourceLabel).slice(0,160)||sourceKey,conceptKey:upper(row.conceptKey).slice(0,160),
      rankingBasis:'MPR_GENERIC_CURATED_FROM_SOURCE_RANK',brandPolicyClass:'GENERIC_PRIVATE_LABEL',commercialGate:'GENERIC_PRIVATE_LABEL',
      brandReview:row.brandReview,nicheReview:row.nicheReview,
      evidenceClass:sourcePlatform.startsWith('AMAZON_')?'LICENSED':'DIRECT',salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES'
    });
  }
  const windowEnd=products.map(row=>row.observedAt).sort().at(-1);
  return {ok:true,code:'READY',snapshot:{
    niche_id:nicheId,platform:'MPR_GENERIC',market,window_days:7,window_end:windowEnd,products,product_count:25,
    evidence_class:products.every(row=>row.evidenceClass==='DIRECT')?'DIRECT':'DERIVED',
    source_key:sourceKey,source_label:clean(raw.sourceLabel).slice(0,160)||sourceKey,
    source_rights_status:'APPROVED',freshness_status:'CURRENT'
  }};
}
