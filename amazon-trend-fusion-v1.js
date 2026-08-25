const text=v=>String(v??'').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function asin(v){return text(v).toUpperCase();}
function hoursBetween(a,b){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/36e5:null;}
function rankComponent(v){const x=num(v);if(x===null||x<=0)return 0;return clamp(x>=10?100:x/10*100);}
function reviewComponent(v){const x=num(v);if(x===null||x<=0)return 0;return clamp(x>=20?100:x/20*100);}

export function fuseAmazonTrendEvidence({reviewEvidenceRows=[],rankingHistoryRows=[],maxEndpointSkewHours=48}={}){
  const maxSkew=Math.max(1,Number(maxEndpointSkewHours)||48);
  const reviewByAsin=new Map();
  for(const row of reviewEvidenceRows||[]){
    const id=asin(row.externalId||String(row.identity||'').replace(/^AMAZON:/i,''));
    const currentObservedAt=iso(row.currentObservedAt);
    const elapsedHours=num(row.elapsedHours);
    if(!id||row.platform!=='AMAZON'||row.trendEvidenceLevel!=='PRELIMINARY_REVIEW_PRICE_ONLY'||elapsedHours===null||elapsedHours<24||!currentObservedAt)continue;
    reviewByAsin.set(id,{...row,externalId:id,currentObservedAt});
  }

  const rankByAsin=new Map();
  for(const row of rankingHistoryRows||[]){
    const id=asin(row.externalId);
    const latestObservedAt=iso(row.latestObservedAt);
    const elapsedHours=num(row.elapsedHours);
    if(!id||row.intervalEligible!==true||row.trendEvidenceClass!=='LONGITUDINAL_PUBLIC_RANKING'||elapsedHours===null||elapsedHours<24||!latestObservedAt)continue;
    const existing=rankByAsin.get(id);
    if(!existing||Date.parse(latestObservedAt)>Date.parse(existing.latestObservedAt))rankByAsin.set(id,{...row,externalId:id,latestObservedAt});
  }

  const allAsins=[...new Set([...reviewByAsin.keys(),...rankByAsin.keys()])].sort();
  const rows=[];const blocked=[];
  for(const id of allAsins){
    const review=reviewByAsin.get(id),rank=rankByAsin.get(id);
    if(!review||!rank){
      blocked.push({externalId:id,error:!review?'REVIEW_LONGITUDINAL_EVIDENCE_MISSING':'RANK_LONGITUDINAL_EVIDENCE_MISSING'});
      continue;
    }
    const endpointSkewHours=hoursBetween(review.currentObservedAt,rank.latestObservedAt);
    if(endpointSkewHours===null||endpointSkewHours>maxSkew){
      blocked.push({externalId:id,error:'EVIDENCE_ENDPOINTS_NOT_COMPARABLE',endpointSkewHours});
      continue;
    }
    const rankVelocityPerDay=num(rank.rankVelocityPerDay);
    const reviewVelocityPerDay=num(review.reviewVelocityPerDay);
    if(rankVelocityPerDay===null){blocked.push({externalId:id,error:'RANK_VELOCITY_MISSING'});continue;}
    if(reviewVelocityPerDay===null){blocked.push({externalId:id,error:'REVIEW_VELOCITY_MISSING'});continue;}

    let signal='NOT_ACCELERATING';
    if(rankVelocityPerDay>0&&reviewVelocityPerDay>0)signal='CONFIRMED_ACCELERATION';
    else if(rankVelocityPerDay>0&&reviewVelocityPerDay===0)signal='RANK_IMPROVING_REVIEWS_FLAT';
    else if(rankVelocityPerDay>0||reviewVelocityPerDay>0)signal='MIXED_SIGNAL';

    const score=signal==='CONFIRMED_ACCELERATION'
      ?Number((rankComponent(rankVelocityPerDay)*0.6+reviewComponent(reviewVelocityPerDay)*0.4).toFixed(1))
      :null;
    rows.push({
      identity:`AMAZON:${id}`,platform:'AMAZON',externalId:id,signal,trendScore:score,
      rankVelocityPerDay,reviewVelocityPerDay,rankLatest:rank.latestRank??null,reviewDelta:review.reviewDelta??null,
      rankObservedAt:rank.latestObservedAt,reviewObservedAt:review.currentObservedAt,endpointSkewHours:Number(endpointSkewHours.toFixed(4)),
      evidenceClass:'FUSED_LONGITUDINAL_PUBLIC_TREND',trendEvidenceLevel:'RANK_PLUS_REVIEW_LONGITUDINAL',
      demandEvidenceConfirmed:signal==='CONFIRMED_ACCELERATION',verifiedSales:false,
      salesEvidenceClass:'NOT_VERIFIED_SALES',maximumFunnelContribution:'VALIDATE_SUPPORT_ONLY',purchaseAuthorized:false
    });
  }
  rows.sort((a,b)=>(b.trendScore??-Infinity)-(a.trendScore??-Infinity)||a.externalId.localeCompare(b.externalId));
  return{
    eligible:rows.length,confirmedAcceleration:rows.filter(x=>x.signal==='CONFIRMED_ACCELERATION').length,
    rows,blocked,blockedCount:blocked.length,
    policy:'REQUIRES_LONGITUDINAL_RANK_AND_REVIEW_EVIDENCE; BOTH_INTERVALS_MINIMUM_24H; ENDPOINTS_MUST_BE_TEMPORALLY_COMPARABLE; REVIEW_VELOCITY_IS_NOT_SALES; RANKING_IS_NOT_SALES; FUSED_TREND_SUPPORTS_VALIDATE_ONLY',
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,paidCallsTriggered:0,purchaseAuthorized:false
  };
}
