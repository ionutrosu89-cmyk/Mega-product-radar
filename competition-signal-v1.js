const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const clean=v=>String(v??'').trim();
const ALLOWED=new Set(['EXACT_MARKET_WIDE','EXHAUSTIVE_QUERY_SURFACE','SAMPLED_COMPETITION_ESTIMATE','UNKNOWN']);

export function scoreCompetition(input={}){
  const scope=ALLOWED.has(clean(input.scopeClass).toUpperCase())?clean(input.scopeClass).toUpperCase():'UNKNOWN';
  const listings=finite(input.comparableListingCount)?Number(input.comparableListingCount):null;
  const sellers=finite(input.uniqueSellerCount)?Number(input.uniqueSellerCount):null;
  const brands=finite(input.uniqueBrandCount)?Number(input.uniqueBrandCount):null;
  const compression=finite(input.priceCompressionPct)?Number(input.priceCompressionPct):null;
  const reviewBarrier=finite(input.medianReviewCount)?Number(input.medianReviewCount):null;
  const concentration=finite(input.topSellerConcentrationPct)?Number(input.topSellerConcentrationPct):null;
  const components={
    listingRoom:listings===null?50:clamp(100-listings*2),
    sellerRoom:sellers===null?50:clamp(100-sellers*3),
    brandRoom:brands===null?50:clamp(100-brands*4),
    priceRoom:compression===null?50:clamp(100-compression),
    reviewRoom:reviewBarrier===null?50:reviewBarrier>=1000?10:reviewBarrier>=300?30:reviewBarrier>=100?50:reviewBarrier>=30?70:90,
    concentrationRoom:concentration===null?50:clamp(100-concentration)
  };
  const score=round(Object.values(components).reduce((a,b)=>a+b,0)/Object.keys(components).length);
  const scopeConfidence={EXACT_MARKET_WIDE:100,EXHAUSTIVE_QUERY_SURFACE:85,SAMPLED_COMPETITION_ESTIMATE:60,UNKNOWN:20}[scope];
  const known=[listings,sellers,brands,compression,reviewBarrier,concentration].filter(x=>x!==null).length;
  const confidence=round(scopeConfidence*.7+(known/6)*30);
  return {schemaVersion:'MPR_COMPETITION_SIGNAL_V1',scopeClass:scope,competitionOpportunityScore:score,confidenceScore:confidence,components,metrics:{comparableListingCount:listings,uniqueSellerCount:sellers,uniqueBrandCount:brands,priceCompressionPct:compression,medianReviewCount:reviewBarrier,topSellerConcentrationPct:concentration},truthPolicy:{sampledMayBeRelabeledExact:false,unknownEqualsZero:false}};
}
