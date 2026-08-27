const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export const RANKING_EVIDENCE_CLASSES=Object.freeze(new Set([
  'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
  'VERIFIED_SEARCH_DEMAND',
  'VERIFIED_MARKETPLACE_TREND',
  'VERIFIED_COMPETITOR_OBSERVATION',
  'VERIFIED_PRICING_OBSERVATION'
]));

export const CATALOGUE_ONLY_EVIDENCE_CLASSES=Object.freeze(new Set([
  'OPEN_PUBLIC_DATASET_PRODUCT',
  'CATALOGUE_BOOTSTRAP',
  'OBSERVATION'
]));

export function evaluateRankingEligibility(input={}){
  const policyDecision=upper(input.policyDecision||input?.policy?.decision);
  const evidenceClass=upper(input.evidenceClass||input?.envelope?.evidenceClass);
  const analysisAllowed=input.analysisAllowed===true||input?.envelope?.sourceRights?.analysisAllowed===true;
  const exactIdentity=input.exactIdentity===true||input?.identity?.exact===true||Boolean(input?.envelope?.observedIdentity?.externalId&&input?.envelope?.expectedIdentity?.externalId&&upper(input.envelope.observedIdentity.externalId)===upper(input.envelope.expectedIdentity.externalId));
  const hasProvenance=input.hasProvenance===true||Boolean(input?.envelope?.provenance?.collector&&input?.envelope?.provenance?.runId&&input?.envelope?.provenance?.contentSha256);
  const reasons=[];
  if(policyDecision!=='ACCEPT')reasons.push('POLICY_KERNEL_ACCEPT_REQUIRED');
  if(!analysisAllowed)reasons.push('ANALYSIS_SOURCE_RIGHTS_REQUIRED');
  if(!exactIdentity)reasons.push('EXACT_IDENTITY_REQUIRED');
  if(!hasProvenance)reasons.push('PROVENANCE_REQUIRED');
  if(CATALOGUE_ONLY_EVIDENCE_CLASSES.has(evidenceClass))reasons.push('CATALOGUE_EVIDENCE_NOT_RANKING_SIGNAL');
  if(!RANKING_EVIDENCE_CLASSES.has(evidenceClass))reasons.push('RANKING_EVIDENCE_CLASS_REQUIRED');
  const trustedEligible=reasons.length===0;
  return{
    schema:'MPR_RANKING_ELIGIBILITY_V1',
    trustedEligible,
    decision:trustedEligible?'RANKING_ELIGIBLE':'RANKING_HOLD',
    evidenceClass:evidenceClass||null,
    policyDecision:policyDecision||null,
    analysisAllowed,
    exactIdentity,
    hasProvenance,
    reasons:[...new Set(reasons)]
  };
}

export function evaluateAggregateRankingTrust(product={}){
  const evidenceRows=Array.isArray(product?.rankingEvidence)?product.rankingEvidence:[];
  const evaluated=evidenceRows.map(evaluateRankingEligibility);
  const trusted=evaluated.filter(x=>x.trustedEligible);
  const legacyEvidenceReady=Boolean(product?.launchScore?.enoughEvidence)&&Number(product?.evidenceCoverage?.concreteRows||0)>0;
  const trustState=trusted.length>0?'TRUSTED_RANKING_SIGNAL':legacyEvidenceReady?'LEGACY_RESEARCH_ORDERING_ONLY':'UNTRUSTED_OR_MISSING_RANKING_EVIDENCE';
  return{
    schema:'MPR_AGGREGATE_RANKING_TRUST_V1',
    trustState,
    trustedSignalCount:trusted.length,
    totalSignalCount:evaluated.length,
    trustedEligible:trusted.length>0,
    legacyResearchOrderingAllowed:legacyEvidenceReady,
    evaluated
  };
}

export function applyRankingTrustCap(score,trust={}){
  const value=Math.max(0,Math.min(100,Number(score)||0));
  if(trust.trustedEligible===true)return value;
  if(trust.legacyResearchOrderingAllowed===true)return Math.min(value,67);
  return Math.min(value,54);
}
