const n=v=>Number(v??Infinity);

function blockers(row){
  const s=row?.signals||{};
  const out=[];
  if(!s.fiveTier)out.push('FIVE_TIER_EVIDENCE_REQUIRED');
  if(!s.drawer)out.push('DRAWER_EVIDENCE_REQUIRED');
  if(!s.penHolder)out.push('PEN_HOLDER_EVIDENCE_REQUIRED');
  if(s.penHolder&&!s.twoPenHolders)out.push('TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED');
  if(!s.organizer)out.push('ORGANIZER_IDENTITY_EVIDENCE_REQUIRED');
  if(row?.detailEvidence!==true)out.push('DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED');
  if(!row?.dimensions)out.push('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED');
  return [...new Set(out)];
}

export function buildSupplierValidationQueue(rows=[],limit=20){
  return rows
    .filter(row=>{
      const distinctive=row?.partialDistinctiveConfiguration===true||row?.exactDistinctiveConfiguration===true;
      const incomplete=row?.detailEvidence!==true||!row?.dimensions;
      return distinctive&&incomplete;
    })
    .map(row=>({
      ...row,
      funnelState:'VALIDATE',
      validationStatus:'EVIDENCE_INCOMPLETE_NOT_MATCHED',
      validationBlockers:blockers(row),
      missingDistinctiveEvidence:(row?.signals?.penHolder&&!row?.signals?.twoPenHolders)?['explicit-two-pen-holders']:[],
      canPromoteToMatch:false,
      truthPolicy:{
        ...(row.truthPolicy||{}),
        validationQueueIsMatchEvidence:false,
        validationQueueCanAuthorizeEconomics:false,
        validationQueueCanAuthorizePurchase:false,
        exactIndexConfigurationIsDirectIdentity:false,
        unknownEqualsZero:false
      }
    }))
    .filter(row=>row.validationBlockers.length>0)
    .sort((a,b)=>{
      const ae=a.exactDistinctiveConfiguration?1:0,be=b.exactDistinctiveConfiguration?1:0;
      if(be!==ae)return be-ae;
      const aMissing=a.validationBlockers.length,bMissing=b.validationBlockers.length;
      if(aMissing!==bMissing)return aMissing-bMissing;
      const am=n(a.moqCandidate?.value),bm=n(b.moqCandidate?.value);if(am!==bm)return am-bm;
      const ap=n(a.publicPriceCandidate?.max),bp=n(b.publicPriceCandidate?.max);if(ap!==bp)return ap-bp;
      return String(a.externalId??'').localeCompare(String(b.externalId??''));
    })
    .slice(0,Math.max(1,Number(limit)||20));
}

export const SupplierValidationQueueTruthPolicy=Object.freeze({
  validationQueueIsMatchEvidence:false,
  validationQueueCanAuthorizeEconomics:false,
  validationQueueCanAuthorizePurchase:false,
  exactIndexConfigurationIsDirectIdentity:false,
  explicitMissingEvidenceRemainsUnknown:true,
  matchingThresholdRelaxed:false,
  unknownEqualsZero:false
});
