import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {evaluateRankingEligibility} from './ranking-eligibility-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};
const DEFAULT_MAX_AGE_MS=7*24*60*60*1000;

function categoryKeyFromEnvelope(envelope={}){
  const payload=envelope?.payload||{};
  return clean(payload.rankCategory||payload.category||payload.categoryName||payload.browseNodeId)||null;
}

function evidenceHistoryKey(evidence={}){
  const envelope=evidence?.envelope||{};
  const marketplace=upper(envelope?.expectedIdentity?.marketplace||envelope?.observedIdentity?.marketplace);
  const externalId=upper(envelope?.expectedIdentity?.externalId||envelope?.observedIdentity?.externalId);
  const evidenceClass=upper(evidence?.evidenceClass||envelope?.evidenceClass);
  const category=categoryKeyFromEnvelope(envelope)||'UNSCOPED';
  return marketplace&&externalId&&evidenceClass?`${marketplace}:${externalId}|${evidenceClass}|${category}`:null;
}

function currentEvidenceTrusted(evidence={}){
  const envelope=evidence?.envelope||{};
  const policy={decision:evidence?.policyDecision||null};
  const eligibility=evaluateRankingEligibility({envelope,policy});
  return eligibility.trustedEligible===true;
}

export function evaluateTrustedTrendFusion(product={},trendIndex={},options={}){
  const asOfMs=parseTime(options.asOf||new Date().toISOString());
  const maxAgeMs=Math.max(1,Number(options.maxAgeMs||DEFAULT_MAX_AGE_MS));
  const evidences=Array.isArray(product?.rankingEvidence)?product.rankingEvidence:[];
  const trends=Array.isArray(trendIndex?.trends)?trendIndex.trends:[];
  const reasons=[];
  const current=evidences.filter(currentEvidenceTrusted);
  if(current.length===0)reasons.push('CURRENT_TRUSTED_RANKING_EVIDENCE_REQUIRED');

  const candidates=[];
  for(const evidence of current){
    const historyKey=evidenceHistoryKey(evidence);
    if(!historyKey)continue;
    for(const trend of trends){
      if(clean(trend?.historyKey)!==historyKey)continue;
      const lastMs=parseTime(trend?.lastObservedAt);
      const ageMs=asOfMs!==null&&lastMs!==null?asOfMs-lastMs:null;
      const fresh=ageMs!==null&&ageMs>=0&&ageMs<=maxAgeMs;
      const comparable=Number(trend?.sampleCount||0)>=2&&trend?.status!=='INSUFFICIENT_COMPARABLE_HISTORY';
      const truthSafe=upper(trend?.salesEvidenceClass||'NOT_VERIFIED_SALES')==='NOT_VERIFIED_SALES';
      candidates.push({evidence,trend,historyKey,ageMs,fresh,comparable,truthSafe});
    }
  }

  const eligible=candidates.filter(x=>x.fresh&&x.comparable&&x.truthSafe);
  if(current.length>0&&candidates.length===0)reasons.push('COMPARABLE_HISTORY_REQUIRED');
  if(candidates.some(x=>!x.fresh))reasons.push('HISTORICAL_TREND_STALE_OR_FUTURE');
  if(candidates.some(x=>!x.comparable))reasons.push('HISTORICAL_TREND_NOT_COMPARABLE');
  if(candidates.some(x=>!x.truthSafe))reasons.push('HISTORICAL_TREND_TRUTH_CLASS_INVALID');

  eligible.sort((a,b)=>{
    const ta=parseTime(a.trend?.lastObservedAt)||0;
    const tb=parseTime(b.trend?.lastObservedAt)||0;
    if(tb!==ta)return tb-ta;
    return clean(a.historyKey).localeCompare(clean(b.historyKey));
  });
  const selected=eligible[0]||null;
  const supportEligible=Boolean(selected);
  if(!supportEligible&&reasons.length===0)reasons.push('TREND_SUPPORT_NOT_PROVEN');

  const payload={
    schema:'MPR_TRUSTED_TREND_FUSION_V1',
    decision:supportEligible?'TREND_SUPPORT_ELIGIBLE':'HOLD_TREND_FUSION',
    supportEligible,
    historyKey:selected?.historyKey||null,
    trendStatus:selected?.trend?.status||null,
    sampleCount:Number(selected?.trend?.sampleCount||0),
    velocityRankPerDay:selected?.trend?.velocityRankPerDay??null,
    accelerationRankPerDay2:selected?.trend?.accelerationRankPerDay2??null,
    confirmedAcceleration:selected?.trend?.confirmedAcceleration===true,
    lastObservedAt:selected?.trend?.lastObservedAt||null,
    reasons:[...new Set(reasons)],
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0,
    rankTrendIsSalesVelocity:false,
    crossPlatformAutoMerge:false
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function attachTrustedTrendFusion(products=[],trendIndex={},options={}){
  let eligibleCount=0;
  let confirmedAccelerationCount=0;
  for(const product of Array.isArray(products)?products:[]){
    product.trustedTrendFusion=evaluateTrustedTrendFusion(product,trendIndex,options);
    if(product.trustedTrendFusion.supportEligible)eligibleCount+=1;
    if(product.trustedTrendFusion.confirmedAcceleration)confirmedAccelerationCount+=1;
  }
  return{
    schema:'MPR_TRUSTED_TREND_FUSION_ATTACHMENT_V1',
    productCount:Array.isArray(products)?products.length:0,
    eligibleCount,
    confirmedAccelerationCount,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
}
