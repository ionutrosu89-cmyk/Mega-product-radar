import {createHash} from 'node:crypto';

const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

export function parseContentRangeTotal(value=''){
  const match=String(value||'').match(/\/(\d+)$/);
  return match?Number(match[1]):null;
}

export function evaluateOffProductionLoadEvidence(input={}){
  const target=Math.max(1,Number(input.target||10000));
  const counts={
    canonicalGtinProducts:Math.max(0,Number(input.canonicalGtinProducts||0)),
    offGtinIdentities:Math.max(0,Number(input.offGtinIdentities||0)),
    offSourceRecords:Math.max(0,Number(input.offSourceRecords||0)),
    offClaims:Math.max(0,Number(input.offClaims||0))
  };
  const reasons=[];
  if(counts.canonicalGtinProducts<target)reasons.push('CANONICAL_GTIN_PRODUCTS_BELOW_TARGET');
  if(counts.offGtinIdentities<target)reasons.push('OFF_GTIN_IDENTITIES_BELOW_TARGET');
  if(counts.offSourceRecords<target)reasons.push('OFF_SOURCE_RECORDS_BELOW_TARGET');
  if(counts.offClaims<target)reasons.push('OFF_CLAIMS_BELOW_TARGET');
  const payload={
    schema:'MPR_OFF_PRODUCTION_LOAD_EVIDENCE_V1',
    decision:reasons.length?'HOLD_10K_PRODUCTION_LOAD':'TEN_K_PRODUCTION_LOAD_VERIFIED',
    reasons,
    target,
    counts,
    provenanceCoverage:counts.canonicalGtinProducts?Math.min(1,counts.offSourceRecords/counts.canonicalGtinProducts):0,
    identityCoverage:counts.canonicalGtinProducts?Math.min(1,counts.offGtinIdentities/counts.canonicalGtinProducts):0,
    productionCatalogWriteVerified:reasons.length===0,
    productionScaleAuthorized:false,
    commercialUseAuthorized:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,fingerprint:sha256(payload)};
}
