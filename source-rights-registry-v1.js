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
  AMAZON_PUBLIC_PRODUCT_PAGE:Object.freeze({...DEFAULT_RECORD}),
  HF_AJAY_SANKEY_AMAZON_PRODUCTS_MIT:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    basis:'DATASET_CARD_DECLARES_MIT_LICENSE; ANALYSIS_ONLY UNTIL COMMERCIAL_SOURCE_RIGHTS REVIEW',
    reviewedAt:'2026-08-27T15:00:00.000Z',
    evidenceRef:'https://huggingface.co/datasets/ajay-sankey/amazon-products'
  })
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
