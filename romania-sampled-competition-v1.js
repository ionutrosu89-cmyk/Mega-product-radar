const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const up=v=>String(v??'').trim().toUpperCase();

function wilsonInterval(successes,total,z=1.96){
  if(!(total>0))return {low:null,high:null};
  const p=successes/total;
  const z2=z*z;
  const denom=1+z2/total;
  const center=(p+z2/(2*total))/denom;
  const margin=(z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/denom;
  return {low:clamp(center-margin),high:clamp(center+margin)};
}

export function deriveRomaniaSampledCompetition({
  platform,
  surfaceItemCountLowerBound=null,
  sampleSize=0,
  canonicalMatches=0,
  sourceScope='PUBLIC_MARKET_SURFACE',
  manualReviewed=false,
  observedAt=null
}={}){
  const p=up(platform);
  const total=num(surfaceItemCountLowerBound);
  const n=num(sampleSize);
  const matches=num(canonicalMatches);
  const blockers=[];
  if(!['EMAG','TRENDYOL'].includes(p))blockers.push('PLATFORM_UNSUPPORTED');
  if(!(total>0))blockers.push('SURFACE_COUNT_MISSING');
  if(!(n>=10))blockers.push('SAMPLE_TOO_SMALL');
  if(matches===null||matches<0||n===null||matches>n)blockers.push('SAMPLE_MATCH_COUNT_INVALID');
  if(up(sourceScope)!=='PUBLIC_MARKET_SURFACE')blockers.push('PUBLIC_MARKET_SURFACE_REQUIRED');
  if(manualReviewed!==true)blockers.push('MANUAL_REVIEW_REQUIRED');
  if(!Number.isFinite(Date.parse(String(observedAt??''))))blockers.push('OBSERVED_AT_INVALID');

  const eligible=blockers.length===0;
  const purity=eligible?matches/n:null;
  const interval=eligible?wilsonInterval(matches,n):{low:null,high:null};
  const estimate=eligible?Math.round(total*purity):null;
  const low=eligible?Math.floor(total*interval.low):null;
  const high=eligible?Math.ceil(total*interval.high):null;
  return {
    version:'1.0',
    platform:p,
    eligibleForSampledSignal:eligible,
    blockers,
    surfaceItemCountLowerBound:total,
    sampleSize:n,
    canonicalMatches:matches,
    samplePurity:purity,
    canonicalListingEstimate:estimate,
    canonicalListingEstimateLow:low,
    canonicalListingEstimateHigh:high,
    evidenceClass:eligible?'DERIVED_FROM_REVIEWED_PUBLIC_SAMPLE':'UNKNOWN',
    exactComparableCount:false,
    romaniaGapExactGateSatisfied:false,
    allowedFunnelUse:eligible?['DISCOVERED','PROMISING']:[],
    forbiddenFunnelUse:['VALIDATE','FINALIST','TEST_READY','BUY_READY'],
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}

export function combineRomaniaSampledCompetition(rows=[]){
  const signals=(rows||[]).map(deriveRomaniaSampledCompetition).filter(x=>x.eligibleForSampledSignal);
  const platforms=[...new Set(signals.map(x=>x.platform))];
  const estimate=signals.length?signals.reduce((s,x)=>s+x.canonicalListingEstimate,0):null;
  const low=signals.length?signals.reduce((s,x)=>s+x.canonicalListingEstimateLow,0):null;
  const high=signals.length?signals.reduce((s,x)=>s+x.canonicalListingEstimateHigh,0):null;
  return {
    version:'1.0',
    status:platforms.length>=2?'MULTI_PLATFORM_ESTIMATE':signals.length?'SINGLE_PLATFORM_ESTIMATE':'INSUFFICIENT',
    platforms,
    estimatedCanonicalListings:estimate,
    estimatedCanonicalListingsLow:low,
    estimatedCanonicalListingsHigh:high,
    evidenceClass:signals.length?'DERIVED_ESTIMATE':'UNKNOWN',
    exactComparableCount:false,
    romaniaGapExactGateSatisfied:false,
    allowedFunnelUse:signals.length?['DISCOVERED','PROMISING']:[],
    forbiddenFunnelUse:['VALIDATE','FINALIST','TEST_READY','BUY_READY'],
    policy:'SAMPLED_COMPETITION_IS_ESTIMATED_ONLY; NEVER_REPLACES_EXACT_ROMANIA_GAP_GATE; UNKNOWN_IS_NOT_ZERO; NO_VERIFIED_SALES; NO_PURCHASE_AUTHORITY',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}
