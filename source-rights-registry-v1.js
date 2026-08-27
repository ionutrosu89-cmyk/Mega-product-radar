const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export const SOURCE_RIGHTS_STATUS=Object.freeze({
  UNKNOWN:'UNKNOWN',
  ANALYSIS_ALLOWED:'ANALYSIS_ALLOWED',
  COMMERCIAL_ALLOWED:'COMMERCIAL_ALLOWED'
});

const DEFAULT_RECORD=Object.freeze({
  status:SOURCE_RIGHTS_STATUS.UNKNOWN,
  analysisAllowed:false,
  commercialUseAllowed:false,
  basis:'NOT_CONFIRMED',
  reviewedAt:null,
  evidenceRef:null
});

const REGISTRY=Object.freeze({
  AMAZON_PUBLIC_PRODUCT_PAGE:Object.freeze({...DEFAULT_RECORD})
});

export function getSourceRights(sourceKey){
  const key=upper(sourceKey);
  const record=REGISTRY[key]||DEFAULT_RECORD;
  return{sourceKey:key||null,...record};
}

export function resolveSourceRights(sourceKey,override=null){
  const registered=getSourceRights(sourceKey);
  if(!override)return registered;
  const status=upper(override.status||registered.status);
  const reviewedAt=clean(override.reviewedAt)||null;
  const basis=clean(override.basis)||null;
  const evidenceRef=clean(override.evidenceRef)||null;
  const analysisAllowed=status===SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED||status===SOURCE_RIGHTS_STATUS.COMMERCIAL_ALLOWED;
  const commercialUseAllowed=status===SOURCE_RIGHTS_STATUS.COMMERCIAL_ALLOWED;
  const explicitReview=Boolean(reviewedAt&&basis&&evidenceRef);
  if(!explicitReview)return registered;
  return{
    sourceKey:registered.sourceKey,
    status,
    analysisAllowed,
    commercialUseAllowed,
    basis,
    reviewedAt,
    evidenceRef
  };
}

export function isSourceRightsRecordReviewable(record={}){
  return Boolean(
    clean(record.sourceKey)&&
    Object.values(SOURCE_RIGHTS_STATUS).includes(upper(record.status))&&
    clean(record.basis)&&clean(record.reviewedAt)&&clean(record.evidenceRef)
  );
}
