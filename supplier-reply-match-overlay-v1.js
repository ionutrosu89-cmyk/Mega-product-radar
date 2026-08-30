export function applySupplierReplyMatchOverlay(base={},replyEvidence=null){
  if(!replyEvidence||replyEvidence.schemaVersion!=='MPR_SUPPLIER_DIRECT_REPLY_EVIDENCE_V1'||replyEvidence.directIdentityEvidenceUsable!==true)return {...base,replyOverlay:null};
  const baseId=String(base.externalId??base.supplierListingKey??'');
  if(!baseId||String(replyEvidence.externalId)!==baseId)return {...base,replyOverlay:null};
  return {
    ...base,
    dimensions:replyEvidence.productDimensions??base.dimensions??null,
    unitWeightGrams:replyEvidence.netWeightGrams??base.unitWeightGrams??null,
    replyOverlay:{
      applied:true,
      evidenceClass:replyEvidence.evidenceClass,
      externalId:replyEvidence.externalId,
      model:replyEvidence.model??null,
      sourceRef:replyEvidence.sourceRef,
      receivedAt:replyEvidence.receivedAt??null,
      dimensionsApplied:Boolean(replyEvidence.productDimensions),
      weightApplied:Number.isFinite(Number(replyEvidence.netWeightGrams)),
      quote:replyEvidence.quote??null,
      sampleOrTrial:replyEvidence.sampleOrTrial??null
    }
  };
}

export const SupplierReplyMatchOverlayTruthPolicy=Object.freeze({
  exactExternalIdRequired:true,
  directIdentityEvidenceUsableRequired:true,
  similarProductEvidenceMayTransfer:false,
  replyCannotOverrideTitleOrDistinctiveSpecs:true,
  replyCannotRelaxMatchingThreshold:true,
  unknownEqualsZero:false,
  purchaseAuthorized:false
});
