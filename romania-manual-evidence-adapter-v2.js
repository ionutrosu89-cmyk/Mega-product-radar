import {analyzeRomaniaGapV2} from './romania-gap-v2.js';

const text=v=>String(v??'').trim();

function coverageForObservation(obs={}){
  if(obs.exactListingCount===null||obs.exactListingCount===undefined)return 'ESTIMATED';
  if(obs.comparabilityConfirmed===true&&obs.marketWideReviewed===true)return 'EXHAUSTIVE_QUERY';
  return 'EXACT';
}

function syntheticExcludedRows(obs={}){
  const n=Number(obs.excludedFalsePositiveCount);
  if(!Number.isInteger(n)||n<=0)return [];
  return Array.from({length:n},(_,i)=>({
    listingId:`manual-excluded-${text(obs.platform)||'UNKNOWN'}-${i+1}`,
    comparability:'NOT_COMPARABLE',
    evidenceClass:'MANUALLY_VERIFIED'
  }));
}

export function adaptRomaniaManualEvidenceV2(evidence={}, {canonicalProductId=null,localDemandEvidence=null}={}){
  const observations=Array.isArray(evidence.observations)?evidence.observations:[];
  const analyses=observations.map(obs=>analyzeRomaniaGapV2({
    canonicalProductId,
    queryEvidence:{
      platform:obs.platform,
      coverageClass:coverageForObservation(obs),
      observedAt:obs.observedAt,
      source:obs.manualReviewer||evidence.schemaVersion||'MANUAL_ROMANIA_EVIDENCE',
      sourceUrl:obs.sourceUrl,
      scope:'PLATFORM_QUERY_SURFACE',
      marketWideVerified:false
    },
    listings:syntheticExcludedRows(obs),
    localDemandEvidence
  }));

  const unresolved=analyses.filter(x=>x.coverageClass==='ESTIMATED'||x.gateStatus==='UNKNOWN'||x.unknownComparabilityCount>0);
  const passed=analyses.filter(x=>x.gateStatus==='PASS');
  const overallGateStatus=!canonicalProductId?'UNKNOWN':unresolved.length?'REVIEW':analyses.length&&passed.length===analyses.length?'PASS':'REVIEW';
  const reasons=[];
  if(!canonicalProductId)reasons.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(unresolved.length)reasons.push('AT_LEAST_ONE_ROMANIA_SURFACE_UNRESOLVED');
  if(analyses.some(x=>x.localDemandScore===null))reasons.push('LOCAL_DEMAND_EVIDENCE_MISSING');
  if(evidence?.promotion?.exactRomaniaGapConfirmed===false)reasons.push('LEGACY_EVIDENCE_EXPLICITLY_NOT_PROMOTION_ELIGIBLE');

  return Object.freeze({
    schemaVersion:'MPR_ROMANIA_MANUAL_EVIDENCE_ADAPTER_V2',canonicalProductId:canonicalProductId||null,candidateAsin:evidence.candidateAsin||null,comparabilityKey:evidence.comparabilityKey||null,
    analyses:Object.freeze(analyses),overallGateStatus,reasons:Object.freeze([...new Set(reasons)]),
    exactRomaniaGapConfirmed:overallGateStatus==='PASS',promotionEligible:false,marketWideClaimAllowed:false,
    paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false,
    policy:'MANUAL_V1_EVIDENCE_IS_ADAPTED_WITHOUT_UPGRADING_SCOPE; NULL_EXACT_COUNT_BECOMES_ESTIMATED; FALSE_POSITIVES_STAY_NOT_COMPARABLE; PLATFORM_SURFACE_ZERO_IS_NOT_ROMANIA_MARKET_ZERO'
  });
}
