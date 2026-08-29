const clean=value=>String(value??'').trim();
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));

export const CATALOG_PRIORITIZATION_SCHEMA='MPR_CATALOG_PRIORITIZATION_V1';
export const CATALOG_PRIORITIZATION_EVIDENCE_CLASS='CATALOG_PRIORITIZATION_ONLY';

function strongestIdentity(candidate={}){
  const keys=Array.isArray(candidate.identityKeys)?candidate.identityKeys:[];
  const priority=['ASIN','GTIN','EPREL','ICECAT'];
  for(const namespace of priority){
    const hit=keys.find(k=>clean(k?.namespace).toUpperCase()===namespace&&clean(k?.valueNorm));
    if(hit)return{namespace,valueNorm:clean(hit.valueNorm)};
  }
  return null;
}

export function scoreCatalogCandidate(candidate={}){
  const identity=strongestIdentity(candidate);
  const components={
    strongIdentity:identity?40:0,
    title:clean(candidate.title)?18:0,
    brand:clean(candidate.brand)?12:0,
    category:clean(candidate.category)?10:0,
    model:clean(candidate.model)?8:0,
    provenance:clean(candidate.sourceKey)&&clean(candidate.sourceRecordId)?8:(clean(candidate.sourceKey)?4:0),
    observedAt:Number.isNaN(new Date(candidate.observedAt||0).getTime())?0:4
  };
  const score=clamp(Object.values(components).reduce((s,n)=>s+n,0));
  const eligibleForReview=Boolean(identity&&clean(candidate.title)&&clean(candidate.sourceKey));
  const priorityTier=!eligibleForReview?'HOLD':score>=80?'P1':score>=65?'P2':'P3';
  return{
    fingerprint:clean(candidate.fingerprint)||null,
    identity,
    title:clean(candidate.title)||null,
    brand:clean(candidate.brand)||null,
    category:clean(candidate.category)||null,
    sourceKey:clean(candidate.sourceKey).toUpperCase()||null,
    score,
    components,
    eligibleForReview,
    priorityTier,
    evidenceClass:CATALOG_PRIORITIZATION_EVIDENCE_CLASS,
    demandConfirmed:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0,
    romaniaGapExact:false,
    supplierQuoteVerified:false,
    landedCostConfirmed:false,
    promising:false,
    validate:false,
    finalist:false,
    purchaseAuthorized:false
  };
}

export function prioritizeCatalog(candidates=[],{topN=5000}={}){
  const rows=(Array.isArray(candidates)?candidates:[]).map(scoreCatalogCandidate);
  rows.sort((a,b)=>b.score-a.score||String(a.identity?.namespace||'').localeCompare(String(b.identity?.namespace||''))||String(a.identity?.valueNorm||a.fingerprint||'').localeCompare(String(b.identity?.valueNorm||b.fingerprint||'')));
  const eligible=rows.filter(r=>r.eligibleForReview);
  const limit=Math.max(0,Math.floor(Number(topN)||0));
  const selected=eligible.slice(0,limit);
  return{
    schema:CATALOG_PRIORITIZATION_SCHEMA,
    evidenceClass:CATALOG_PRIORITIZATION_EVIDENCE_CLASS,
    inputCount:rows.length,
    eligibleCount:eligible.length,
    holdCount:rows.length-eligible.length,
    p1Count:rows.filter(r=>r.priorityTier==='P1').length,
    p2Count:rows.filter(r=>r.priorityTier==='P2').length,
    p3Count:rows.filter(r=>r.priorityTier==='P3').length,
    selectedCount:selected.length,
    selected,
    policy:{
      providerDataSpendEur:0,
      paidDataCallsTriggered:0,
      purchaseAuthorized:false,
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      verifiedSalesRows:0,
      demandConfirmed:false,
      romaniaGapExact:false,
      supplierQuoteVerified:false,
      landedCostConfirmed:false
    },
    note:'This score prioritizes catalogue records for further evidence collection only. It is not demand, sales, exact Romania competition, supplier economics, PROMISING, VALIDATE, or FINALIST evidence.'
  };
}
