const text=v=>String(v??'').trim();
const finitePositive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const bool=v=>v===true?true:v===false?false:null;
const dim=x=>({lengthCm:finitePositive(x?.lengthCm),widthCm:finitePositive(x?.widthCm),heightCm:finitePositive(x?.heightCm)});
const completeDim=x=>x.lengthCm!==null&&x.widthCm!==null&&x.heightCm!==null;

export const SupplierDirectReplyEvidenceTruthPolicy=Object.freeze({
  evidenceClass:'SUPPLIER_DIRECT_REPLY_EVIDENCE',
  exactListingOrModelBindingRequired:true,
  supplierReplyIsNegotiatedQuote:false,
  supplierReplyCanFillDirectIdentityEvidence:true,
  missingFieldRemainsUnknown:true,
  similarProductEvidenceMayTransfer:false,
  purchaseAuthorized:false,
  matchingThresholdRelaxed:false,
  unknownEqualsZero:false
});

export function normalizeSupplierDirectReplyEvidence(input={}){
  const externalId=text(input.externalId);
  const supplierName=text(input.supplierName);
  const model=text(input.model);
  const sourceRef=text(input.sourceRef);
  const listingBound=bool(input.listingBound);
  const modelBound=bool(input.modelBound);
  const provenanceOk=Boolean(externalId&&supplierName&&sourceRef&&(listingBound===true||Boolean(model&&modelBound===true)));
  const productDimensions=dim(input.productDimensions);
  const packedUnitDimensions=dim(input.packedUnitDimensions);
  const masterCartonDimensions=dim(input.masterCartonDimensions);
  const exactConfigurationConfirmed=bool(input.exactConfigurationConfirmed);
  const blockers=[];
  if(!provenanceOk)blockers.push('EXACT_SUPPLIER_PROVENANCE_REQUIRED');
  if(!completeDim(productDimensions))blockers.push('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED');
  if(exactConfigurationConfirmed!==true)blockers.push('EXACT_CONFIGURATION_CONFIRMATION_REQUIRED');

  const evidence={
    schemaVersion:'MPR_SUPPLIER_DIRECT_REPLY_EVIDENCE_V1',
    evidenceClass:'SUPPLIER_DIRECT_REPLY_EVIDENCE',
    externalId,
    supplierName,
    model:model||null,
    sourceRef,
    receivedAt:text(input.receivedAt)||null,
    provenance:{listingBound,modelBound,valid:provenanceOk},
    exactConfigurationConfirmed,
    productDimensions:completeDim(productDimensions)?productDimensions:null,
    netWeightGrams:finitePositive(input.netWeightKg)!==null?Math.round(finitePositive(input.netWeightKg)*1000):null,
    packedUnitDimensions:completeDim(packedUnitDimensions)?packedUnitDimensions:null,
    grossPackedUnitWeightGrams:finitePositive(input.grossPackedUnitWeightKg)!==null?Math.round(finitePositive(input.grossPackedUnitWeightKg)*1000):null,
    masterCarton:{units:finitePositive(input.masterCarton?.units),dimensions:completeDim(masterCartonDimensions)?masterCartonDimensions:null,grossWeightGrams:finitePositive(input.masterCarton?.grossWeightKg)!==null?Math.round(finitePositive(input.masterCarton.grossWeightKg)*1000):null},
    quote:input.quote?{currency:text(input.quote.currency)||null,unitPrice:finitePositive(input.quote.unitPrice),moq:finitePositive(input.quote.moq),incoterm:text(input.quote.incoterm)||null}:null,
    sampleOrTrial:input.sampleOrTrial?{available:bool(input.sampleOrTrial.available),quantity:finitePositive(input.sampleOrTrial.quantity),unitPrice:finitePositive(input.sampleOrTrial.unitPrice),currency:text(input.sampleOrTrial.currency)||null}:null,
    blockers,
    directIdentityEvidenceUsable:provenanceOk&&completeDim(productDimensions)&&exactConfigurationConfirmed===true,
    canAuthorizeEconomics:false,
    purchaseAuthorized:false,
    truthPolicy:SupplierDirectReplyEvidenceTruthPolicy
  };
  return evidence;
}

export function supplierReplyToFingerprintPatch(evidence={}){
  if(evidence?.schemaVersion!=='MPR_SUPPLIER_DIRECT_REPLY_EVIDENCE_V1'||evidence.directIdentityEvidenceUsable!==true)return null;
  return {
    dimensions:evidence.productDimensions,
    unitWeightGrams:evidence.netWeightGrams,
    technicalSpecs:{supplierExactConfigurationConfirmed:true},
    provenance:{evidenceClass:evidence.evidenceClass,externalId:evidence.externalId,model:evidence.model,sourceRef:evidence.sourceRef}
  };
}
