import {canonicalRomaniaComparabilityKey} from './romania-comparability-key-registry-v1.js';

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const t=v=>String(v??'').trim().toUpperCase();
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};

export function validateRomaniaEvidencePromotion({queueItem={},emagProbe={},trendyolEvidence={}}={}){
  const blockers=[];
  const expectedKey=canonicalRomaniaComparabilityKey(queueItem.comparabilityKey);
  const nicheKey=queueItem.nicheKey||null;

  const emagKey=canonicalRomaniaComparabilityKey(emagProbe.comparabilityKey);
  const trendyolKey=canonicalRomaniaComparabilityKey(trendyolEvidence.comparabilityKey);
  if(!expectedKey)blockers.push('QUEUE_COMPARABILITY_KEY_MISSING');
  if(emagKey!==expectedKey)blockers.push('EMAG_COMPARABILITY_KEY_MISMATCH');
  if(trendyolKey!==expectedKey)blockers.push('TRENDYOL_COMPARABILITY_KEY_MISMATCH');

  const emagObservedAt=iso(emagProbe.observedAt);
  const trendyolObservedAt=iso(trendyolEvidence.observedAt);
  if(!emagObservedAt)blockers.push('EMAG_OBSERVED_AT_MISSING');
  if(!trendyolObservedAt)blockers.push('TRENDYOL_OBSERVED_AT_MISSING');

  const emagExact=n(emagProbe.listingCount);
  const trendyolExact=n(trendyolEvidence.listingCount);
  const emagLower=n(emagProbe.listingCountLowerBound);
  const trendyolLower=n(trendyolEvidence.listingCountLowerBound);
  if(emagExact===null)blockers.push(emagLower!==null?'EMAG_LOWER_BOUND_NOT_EXACT':'EMAG_EXACT_COUNT_MISSING');
  if(trendyolExact===null)blockers.push(trendyolLower!==null?'TRENDYOL_LOWER_BOUND_NOT_EXACT':'TRENDYOL_EXACT_COUNT_MISSING');

  if(emagProbe.manualReviewed!==true)blockers.push('EMAG_MANUAL_REVIEW_REQUIRED');
  if(trendyolEvidence.manualReviewed!==true)blockers.push('TRENDYOL_MANUAL_REVIEW_REQUIRED');
  if(emagProbe.comparableScopeConfirmed!==true)blockers.push('EMAG_SCOPE_NOT_CONFIRMED');
  if(trendyolEvidence.comparableScopeConfirmed!==true)blockers.push('TRENDYOL_SCOPE_NOT_CONFIRMED');

  const emagScope=t(emagProbe.scope||'');
  const trendyolScope=t(trendyolEvidence.scope||'');
  if(emagScope!=='MARKET_WIDE')blockers.push('EMAG_NOT_MARKET_WIDE');
  if(trendyolScope!=='MARKET_WIDE')blockers.push('TRENDYOL_NOT_MARKET_WIDE');
  if(emagProbe.sellerScoped===true||emagProbe.storeScoped===true)blockers.push('EMAG_SCOPED_DATA_REJECTED');
  if(trendyolEvidence.sellerScoped===true||trendyolEvidence.storeScoped===true)blockers.push('TRENDYOL_SCOPED_DATA_REJECTED');

  if(emagProbe.salesEvidenceClass&&emagProbe.salesEvidenceClass!=='NOT_VERIFIED_SALES')blockers.push('EMAG_SALES_CLASS_INVALID');
  if(trendyolEvidence.salesEvidenceClass&&trendyolEvidence.salesEvidenceClass!=='NOT_VERIFIED_SALES')blockers.push('TRENDYOL_SALES_CLASS_INVALID');

  const promotable=blockers.length===0;
  return {
    version:'1.1',nicheKey,comparabilityKey:expectedKey||null,
    status:promotable?'PROMOTABLE_TO_COMPARABLE_LOCAL_EVIDENCE':'BLOCKED',
    promotable,blockers,
    exactCompetition:promotable?{EMAG:emagExact,TRENDYOL:trendyolExact}:null,
    observedAt:promotable?{EMAG:emagObservedAt,TRENDYOL:trendyolObservedAt}:null,
    policy:'FAIL_CLOSED; CANONICAL_COMPARABILITY_KEYS; LOWER_BOUNDS_ARE_NOT_EXACT; SAME_SCOPE_REQUIRED; NO_VERIFIED_SALES_CLAIM',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,paidCallsTriggered:0,approvedSpendEur:0
  };
}

export function validateRomaniaEvidenceBatch({queueItems=[],evidenceByNiche={}}={}){
  const rows=(queueItems||[]).map(item=>{
    const e=evidenceByNiche[item.nicheKey]||{};
    return validateRomaniaEvidencePromotion({queueItem:item,emagProbe:e.EMAG||{},trendyolEvidence:e.TRENDYOL||{}});
  });
  return {version:'1.1',total:rows.length,promotable:rows.filter(x=>x.promotable).length,blocked:rows.filter(x=>!x.promotable).length,rows,paidCallsTriggered:0,purchaseAuthorized:false};
}
