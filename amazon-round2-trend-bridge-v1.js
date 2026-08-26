import {appendProductSnapshots,buildProductHistoryMetrics} from './product-snapshot-ledger.js';

const text=v=>String(v??'').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};

function validRound2Artifact(artifact={}){
  return artifact?.schemaVersion==='MPR_AMAZON_ROUND2_REFRESH_V1'&&
    Number(artifact?.policy?.minimumObservationIntervalHours)>=24&&
    artifact?.policy?.salesEvidenceClass==='NOT_VERIFIED_SALES'&&
    artifact?.policy?.purchaseAuthorized===false;
}

function movementKey(x={}){
  return `${text(x.asin).toUpperCase()}|${iso(x.previousObservedAt)||''}|${iso(x.currentObservedAt)||''}`;
}

function reviewCountComparability(x={}){
  const previous=num(x.reviewCountPrevious),current=num(x.reviewCountCurrent),delta=num(x.reviewDelta);
  if(previous===null||current===null||delta===null)return{comparable:true,ratio:null,reason:null};
  if(previous<0||current<0)return{comparable:false,ratio:null,reason:'NEGATIVE_REVIEW_COUNT'};
  if(previous===0)return{comparable:true,ratio:null,reason:null};
  const ratio=Math.round((current/previous)*1000)/1000;
  if(previous>=50&&(ratio<0.5||ratio>2))return{comparable:false,ratio,reason:'REVIEW_COUNT_COMPARABILITY_ANOMALY'};
  return{comparable:true,ratio,reason:null};
}

export function round2ArtifactToProductSnapshots(artifact={}){
  if(!validRound2Artifact(artifact))return{ok:false,error:'ROUND2_ARTIFACT_POLICY_INVALID',snapshots:[],rejected:[],paidCallsTriggered:0,purchaseAuthorized:false};
  const observations=Array.isArray(artifact.observations)?artifact.observations:[];
  const snapshots=[];const rejected=[];
  for(const row of observations){
    const externalId=text(row.externalId||row.asin).toUpperCase();
    const observedAt=iso(row.observedAt);
    if(!externalId||!observedAt){rejected.push({externalId:externalId||null,error:'IDENTITY_OR_OBSERVED_AT_MISSING'});continue;}
    snapshots.push({
      platform:'AMAZON',externalId,observedAt,freshnessClass:'LIVE_PUBLIC_PAGE',
      price:num(row.price),currency:text(row.currency).toUpperCase()||null,rating:num(row.rating),reviewCount:num(row.reviewCount),
      sourceRank:null,sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    });
  }
  return{ok:true,snapshots,rejected,paidCallsTriggered:0,purchaseAuthorized:false};
}

export function buildAmazonRound2PreliminaryTrendEvidence(artifact={}){
  if(!validRound2Artifact(artifact))return{
    ok:false,status:'BLOCKED',error:'ROUND2_ARTIFACT_POLICY_INVALID',rows:[],eligible:0,
    policy:'NO_TREND_WITHOUT_VALID_ROUND2_ARTIFACT; NO_RANK_INFERENCE; REVIEW_VELOCITY_IS_NOT_SALES_VELOCITY',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
  const movements=Array.isArray(artifact.movements)?artifact.movements:[];
  const seen=new Set();const rows=[];const rejected=[];
  for(const x of movements){
    const asin=text(x.asin).toUpperCase();
    const previousObservedAt=iso(x.previousObservedAt),currentObservedAt=iso(x.currentObservedAt);
    const elapsedHours=num(x.elapsedHours);
    const key=movementKey(x);
    if(!asin||!previousObservedAt||!currentObservedAt){rejected.push({asin:asin||null,error:'MOVEMENT_PROVENANCE_MISSING'});continue;}
    if(seen.has(key)){rejected.push({asin,error:'DUPLICATE_MOVEMENT'});continue;}
    seen.add(key);
    if(x.intervalEligible!==true||elapsedHours===null||elapsedHours<24){rejected.push({asin,error:'MINIMUM_24H_INTERVAL_NOT_MET'});continue;}
    if(x.sourceRankPrevious!=null||x.sourceRankCurrent!=null||x.rankVelocity!=null){rejected.push({asin,error:'ROUND2_RANK_EVIDENCE_NOT_ALLOWED'});continue;}
    const comparability=reviewCountComparability(x);
    if(!comparability.comparable){
      rejected.push({
        asin,error:comparability.reason,
        reviewCountPrevious:num(x.reviewCountPrevious),reviewCountCurrent:num(x.reviewCountCurrent),reviewDelta:num(x.reviewDelta),reviewCountRatio:comparability.ratio
      });
      continue;
    }
    const reviewVelocityPerDay=num(x.reviewVelocityPerDay);
    const reviewDelta=num(x.reviewDelta);
    const priceDelta=num(x.priceDelta);
    rows.push({
      identity:`AMAZON:${asin}`,
      platform:'AMAZON',externalId:asin,previousObservedAt,currentObservedAt,elapsedHours,
      observationCount:2,
      reviewCountPrevious:num(x.reviewCountPrevious),reviewCountCurrent:num(x.reviewCountCurrent),reviewDelta,reviewVelocityPerDay,
      reviewCountComparable:true,reviewCountRatio:comparability.ratio,
      pricePrevious:num(x.pricePrevious),priceCurrent:num(x.priceCurrent),priceDelta,
      sourceRankPrevious:null,sourceRankCurrent:null,rankVelocityPerDay:null,
      evidenceClass:'LONGITUDINAL_PUBLIC_PRODUCT_PAGE',
      trendEvidenceLevel:'PRELIMINARY_REVIEW_PRICE_ONLY',
      preliminarySignal:reviewVelocityPerDay===null?'INSUFFICIENT_REVIEW_DATA':reviewVelocityPerDay>0?'REVIEWS_INCREASING':reviewVelocityPerDay<0?'REVIEWS_DECREASING':'REVIEWS_UNCHANGED',
      eligibleForEarlyPrioritization:true,
      eligibleForRankTrend:false,
      eligibleForDemandConfirmation:false,
      eligibleForVerifiedSales:false,
      maximumFunnelContribution:'PROMISING_SUPPORT_ONLY',
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    });
  }
  return{
    ok:true,status:rows.length?'PRELIMINARY_LONGITUDINAL_EVIDENCE_READY':'NO_ELIGIBLE_MOVEMENTS',
    eligible:rows.length,rejectedCount:rejected.length,rows,rejected,
    policy:'MINIMUM_24H; REVIEW_COUNT_COMPARABILITY_SANITY_GATE; REVIEW_AND_PRICE_LONGITUDINAL_EVIDENCE_ONLY; REVIEW_VELOCITY_IS_NOT_SALES_VELOCITY; NO_RANK_INFERENCE; NO_DEMAND_CONFIRMATION; PROMISING_SUPPORT_ONLY',
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,rankVelocityAvailable:0,paidCallsTriggered:0,purchaseAuthorized:false
  };
}

export function appendAmazonRound2ToSnapshotLedger({existingSnapshots=[],round1Snapshots=[],artifact={}}={}){
  const converted=round2ArtifactToProductSnapshots(artifact);
  if(!converted.ok)return{...converted,ledgerSnapshots:existingSnapshots||[],history:{productCount:0,trendReadyCount:0,products:[]}};
  const incoming=[...(round1Snapshots||[]),...converted.snapshots];
  const ledger=appendProductSnapshots(existingSnapshots,incoming);
  const history=buildProductHistoryMetrics(ledger.snapshots,{minObservationHours:24});
  return{
    ok:true,ledgerSnapshots:ledger.snapshots,rejected:[...(converted.rejected||[]),...(ledger.rejected||[])],history,
    trendReadyCount:history.trendReadyCount,
    policy:'APPEND_ONLY_PRODUCT_SNAPSHOT_LEDGER; MINIMUM_24H; NO_RANK_INFERENCE; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORIZATION',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
}
