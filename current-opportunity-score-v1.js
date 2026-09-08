import {classifyPublicBrandGate} from './brand-policy-v1.js';
import {classifyPublicCategoryRisk} from './public-category-risk-policy-v1.js';

const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
const round=value=>Math.round(Number(value)*10)/10;
const truth=value=>String(value??'').trim().toUpperCase();

const ebayRankScore=rank=>{
  const n=Number(rank);
  if(!Number.isFinite(n)||n<1||n>25)return 0;
  return 30*((26-n)/25);
};
const persistenceScore=(daysObserved,windowDays)=>10*clamp(Number(daysObserved)/Math.max(1,Number(windowDays)||0));
const accelerationScore=value=>10*clamp(value);
const amazonVelocityScore=(reviewsPerDay,evidenceClass)=>{
  if(truth(evidenceClass)!=='DERIVED')return 0;
  const velocity=Math.max(0,Number(reviewsPerDay)||0);
  return 15*clamp(Math.log1p(velocity)/Math.log1p(10));
};
const searchScore=(strength,evidenceClass)=>{
  if(!['SEARCH_INTEREST_NOT_SALES','DERIVED'].includes(truth(evidenceClass)))return 0;
  return 10*clamp(strength);
};
const romaniaGapScore=value=>10*clamp(value);
const economicsScore=marginPct=>{
  const margin=Number(marginPct);
  if(!Number.isFinite(margin)||margin<=0)return 0;
  return 15*clamp(margin/50);
};

export function computeCurrentOpportunityScore(product={},signals={},options={}){
  const brandGate=classifyPublicBrandGate(product);
  const categoryGate=classifyPublicCategoryRisk(product);
  const commercialEligible=brandGate.commercialEligible&&categoryGate.commercialEligible;
  const windowDays=[7,30].includes(Number(options.windowDays))?Number(options.windowDays):7;

  const components={
    ebayBestSelling:ebayRankScore(signals.ebayBestSellingRank),
    ebayPersistence:persistenceScore(signals.ebayDaysObserved,windowDays),
    ebayAcceleration:accelerationScore(signals.ebayRankAcceleration01),
    amazonReviewVelocity:amazonVelocityScore(signals.amazonReviewsPerDay,signals.amazonEvidenceClass),
    googleSearchInterest:searchScore(signals.googleSearchStrength01,signals.googleEvidenceClass),
    romaniaGap:romaniaGapScore(signals.romaniaGap01),
    economics:economicsScore(signals.estimatedGrossMarginPct)
  };
  const roundedComponents=Object.fromEntries(Object.entries(components).map(([key,value])=>[key,round(value)]));
  const marketSignalScore=round(Object.values(components).reduce((sum,value)=>sum+value,0));

  const signalFamilies=[];
  if(components.ebayBestSelling>0||components.ebayPersistence>0||components.ebayAcceleration>0)signalFamilies.push('EBAY');
  if(components.amazonReviewVelocity>0)signalFamilies.push('AMAZON');
  if(components.googleSearchInterest>0)signalFamilies.push('GOOGLE_SEARCH');
  if(components.romaniaGap>0)signalFamilies.push('ROMANIA_GAP');
  if(components.economics>0)signalFamilies.push('ECONOMICS');
  const directMarketplaceEvidence=components.ebayBestSelling>0;
  const enoughCurrentEvidence=directMarketplaceEvidence||signalFamilies.filter(name=>name!=='ECONOMICS').length>=2;

  let decision='INSUFFICIENT_DATA';
  let currentOpportunityScore=null;
  if(!brandGate.commercialEligible)decision='STOP_BRAND_GATE';
  else if(!categoryGate.commercialEligible)decision=categoryGate.decision==='MANUAL_REVIEW'?'MANUAL_REVIEW':'STOP_CATEGORY_GATE';
  else if(enoughCurrentEvidence){decision='ELIGIBLE_CURRENT_OPPORTUNITY';currentOpportunityScore=marketSignalScore;}

  const evidenceClass=directMarketplaceEvidence?'DIRECT_PLUS_DERIVED':enoughCurrentEvidence?'DERIVED_MULTI_SOURCE':'INSUFFICIENT_DATA';
  const confidence=directMarketplaceEvidence&&signalFamilies.length>=3?'HIGH':enoughCurrentEvidence?'MEDIUM':'LOW';

  return {
    version:'CURRENT_OPPORTUNITY_SCORE_V1',
    windowDays,
    marketSignalScore,
    currentOpportunityScore,
    commercialEligible:decision==='ELIGIBLE_CURRENT_OPPORTUNITY',
    decision,
    evidenceClass,
    confidence,
    signalFamilies,
    components:roundedComponents,
    gates:{brand:brandGate,category:categoryGate},
    policy:{unknownSignalsScoreZero:true,noHistoricalFallback:true,noVerifiedSalesClaim:true,brandAndCategoryGateBeforeCommercialScore:true}
  };
}
