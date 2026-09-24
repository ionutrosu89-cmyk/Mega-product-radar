import {classifyPublicBrandGate} from './brand-policy-v1.js';
import {FREE_TOP25_LIVE_TAXONOMY_BY_ID} from './free-top25-live-taxonomy-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const https=value=>{try{return new URL(clean(value)).protocol==='https:';}catch{return false;}};

// A provider rank is evidence about its source list, never the rank of this
// MPR selection. Human reviews must confirm brand, niche fit and product identity;
// different listings of the same reviewed concept count only once.
export function selectGenericOpportunities(candidates=[],reviews={},options={}){
  const targetCount=options.targetCount??25;
  if(!Number.isInteger(targetCount)||targetCount<1)return {ok:false,code:'INVALID_TARGET_COUNT'};
  if(!Array.isArray(candidates))return {ok:false,code:'INVALID_CANDIDATES'};
  const nicheId=upper(options.nicheId);
  if(!FREE_TOP25_LIVE_TAXONOMY_BY_ID.has(nicheId))return {ok:false,code:'NICHE_NOT_ALLOWED'};
  const ranked=[...candidates].sort((a,b)=>Number(a?.sourceRank??a?.rank)-Number(b?.sourceRank??b?.rank));
  const seenIds=new Set(),seenRanks=new Set(),seenConcepts=new Set(),selected=[],excluded=[],pending=[];
  for(const raw of ranked){
    const externalId=clean(raw?.externalId);
    const sourceRank=Number(raw?.sourceRank??raw?.rank);
    if(!externalId||!Number.isInteger(sourceRank)||sourceRank<1||seenIds.has(externalId)||seenRanks.has(sourceRank))continue;
    seenIds.add(externalId);seenRanks.add(sourceRank);
    const gate=classifyPublicBrandGate(raw);
    if(gate.brandPolicyClass==='ESTABLISHED_EXCLUDE'){
      excluded.push({externalId,sourceRank,reason:gate.reason});
      continue;
    }
    if(upper(raw?.nicheId)!==nicheId){excluded.push({externalId,sourceRank,reason:'WRONG_NICHE'});continue;}
    const review=reviews?.[externalId];
    if(upper(review?.nicheDecision)==='OUT_OF_SCOPE'){
      excluded.push({externalId,sourceRank,reason:'REVIEWED_OUT_OF_SCOPE'});
      continue;
    }
    const approved=upper(review?.decision)==='GENERIC_PRIVATE_LABEL'&&clean(review?.reviewer)&&Number.isFinite(Date.parse(clean(review?.reviewedAt)))&&https(review?.evidenceUrl);
    if(!approved){pending.push({externalId,sourceRank,reason:'BRAND_REVIEW_REQUIRED'});continue;}
    if(upper(review?.nicheDecision)!=='IN_SCOPE'||upper(review?.nicheId)!==nicheId||!https(review?.nicheEvidenceUrl)){
      pending.push({externalId,sourceRank,reason:'NICHE_REVIEW_REQUIRED'});
      continue;
    }
    const conceptKey=upper(review?.conceptKey);
    if(!conceptKey){pending.push({externalId,sourceRank,reason:'PRODUCT_IDENTITY_REVIEW_REQUIRED'});continue;}
    if(seenConcepts.has(conceptKey)){
      excluded.push({externalId,sourceRank,reason:'DUPLICATE_REVIEWED_CONCEPT'});
      continue;
    }
    seenConcepts.add(conceptKey);
    if(selected.length<targetCount)selected.push({...raw,nicheId,conceptKey,sourceRank,opportunityRank:selected.length+1,brandPolicyClass:'GENERIC_PRIVATE_LABEL',brandReview:{reviewer:clean(review.reviewer),reviewedAt:new Date(review.reviewedAt).toISOString(),evidenceUrl:clean(review.evidenceUrl)},nicheReview:{reviewer:clean(review.reviewer),reviewedAt:new Date(review.reviewedAt).toISOString(),evidenceUrl:clean(review.nicheEvidenceUrl)},rankingBasis:'MPR_BRAND_FILTERED_FROM_SOURCE_RANK'});
  }
  return {ok:selected.length===targetCount,code:selected.length===targetCount?'READY':'INSUFFICIENT_REVIEWED_GENERIC_CANDIDATES',targetCount,candidateCount:seenIds.size,selectedCount:selected.length,excludedCount:excluded.length,pendingCount:pending.length,selected,excluded,pending};
}
