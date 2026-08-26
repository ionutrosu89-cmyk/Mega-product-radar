const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const t=v=>String(v??'').trim();
const i=v=>{const x=Date.parse(String(v??''));return Number.isFinite(x)?new Date(x).toISOString():null};

export function buildAmazonStrictTrendFusion({leaders={},rankHistory={},maximumTemporalGapHours=48}={}){
  const reviewAt=i(leaders.generatedAt), rankAt=i(rankHistory.rows?.[0]?.latestObservedAt);
  const gap=reviewAt&&rankAt?Math.abs(Date.parse(rankAt)-Date.parse(reviewAt))/36e5:null;
  const temporalCompatible=Number.isFinite(gap)&&gap<=Math.max(24,Number(maximumTemporalGapHours)||48);
  const baseOk=leaders.schemaVersion==='MPR_AMAZON_ROUND2_PRELIMINARY_LEADERS_V1'&&rankHistory.ok===true&&rankHistory.status==='RANK_HISTORY_READY'&&temporalCompatible;
  const reviews=new Map((leaders.leaders||[]).map(x=>[t(x.asin).toUpperCase(),x]));
  const ranks=new Map((rankHistory.rows||[]).map(x=>[t(x.externalId).toUpperCase(),x]));
  const rows=[...new Set([...reviews.keys(),...ranks.keys()])].sort().map(externalId=>{
    const r=reviews.get(externalId), k=ranks.get(externalId);
    const rd=n(r?.reviewDelta), rv=n(r?.reviewVelocityPerDay), kv=n(k?.rankVelocityPerDay);
    const reviewPositive=rd!==null&&rd>0&&rv!==null&&rv>0;
    const rankEligible=!!k&&k.intervalEligible===true&&k.categorySignalsConflict===false&&k.trendEvidenceClass==='LONGITUDINAL_PUBLIC_RANKING'&&kv!==null;
    const confirmedAcceleration=baseOk&&reviewPositive&&rankEligible&&kv>0;
    let status='INSUFFICIENT_FUSION_EVIDENCE';
    if(k?.categorySignalsConflict) status='BLOCKED_RANK_CATEGORY_CONFLICT';
    else if(!reviewPositive) status='NO_POSITIVE_REVIEW_SIGNAL';
    else if(!rankEligible) status='NO_ELIGIBLE_LONGITUDINAL_RANK';
    else if(!temporalCompatible) status='BLOCKED_TEMPORAL_MISMATCH';
    else if(kv<=0) status=kv===0?'RANK_FLAT':'RANK_WORSENING';
    else if(confirmedAcceleration) status='CONFIRMED_ACCELERATION';
    return {platform:'AMAZON',externalId,title:r?.title??null,status,confirmedAcceleration,reviewSignal:r?{reviewDelta:rd,reviewVelocityPerDay:rv}:null,rankSignal:k?{rankVelocityPerDay:kv,categorySignalsConflict:k.categorySignalsConflict,comparableCategoryCount:k.comparableCategoryCount,categories:k.categories}:null,maximumFunnelContribution:confirmedAcceleration?'CONFIRMED_TREND_SUPPORT':'PROMISING_SUPPORT_ONLY',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:false,purchaseAuthorized:false};
  });
  const confirmed=rows.filter(x=>x.confirmedAcceleration);
  return {ok:baseOk,status:baseOk?(confirmed.length?'FUSION_READY_WITH_CONFIRMED_ACCELERATION':'FUSION_READY_NO_CONFIRMED_ACCELERATION'):'BLOCKED',temporalGapHours:Number.isFinite(gap)?Number(gap.toFixed(4)):null,maximumTemporalGapHours:Math.max(24,Number(maximumTemporalGapHours)||48),productsEvaluated:rows.length,confirmedAccelerationCount:confirmed.length,confirmedAsins:confirmed.map(x=>x.externalId),rows,policy:'SAME_ASIN; POSITIVE_REVIEW_SIGNAL; >=24H_EXPLICIT_BSR; NO_CATEGORY_CONFLICT; IMPROVING_RANK; TEMPORAL_COMPATIBILITY; NEVER_INFER_SALES',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
}
