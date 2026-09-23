import {classifyPublicBrandGate} from './brand-policy-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

// A provider rank is evidence about its source list, never the rank of this
// brand-filtered MPR selection. Only a separate human review can confirm that
// an unfamiliar brand is suitable for the generic/private-label opportunity list.
export function selectGenericOpportunities(candidates=[],reviews={},options={}){
  const targetCount=options.targetCount??25;
  if(!Number.isInteger(targetCount)||targetCount<1)return {ok:false,code:'INVALID_TARGET_COUNT'};
  if(!Array.isArray(candidates))return {ok:false,code:'INVALID_CANDIDATES'};
  const ranked=[...candidates].sort((a,b)=>Number(a?.sourceRank??a?.rank)-Number(b?.sourceRank??b?.rank));
  const seenIds=new Set(),seenRanks=new Set(),selected=[],excluded=[],pending=[];
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
    const review=reviews?.[externalId];
    const approved=upper(review?.decision)==='GENERIC_PRIVATE_LABEL'&&clean(review?.reviewer)&&Number.isFinite(Date.parse(clean(review?.reviewedAt)))&&clean(review?.evidenceUrl).startsWith('https://');
    if(!approved){pending.push({externalId,sourceRank,reason:'BRAND_REVIEW_REQUIRED'});continue;}
    if(selected.length<targetCount)selected.push({...raw,sourceRank,opportunityRank:selected.length+1,brandPolicyClass:'GENERIC_PRIVATE_LABEL',brandReview:{reviewer:clean(review.reviewer),reviewedAt:new Date(review.reviewedAt).toISOString(),evidenceUrl:clean(review.evidenceUrl)},rankingBasis:'MPR_BRAND_FILTERED_FROM_SOURCE_RANK'});
  }
  return {ok:selected.length===targetCount,code:selected.length===targetCount?'READY':'INSUFFICIENT_REVIEWED_GENERIC_CANDIDATES',targetCount,candidateCount:seenIds.size,selectedCount:selected.length,excludedCount:excluded.length,pendingCount:pending.length,selected,excluded,pending};
}
