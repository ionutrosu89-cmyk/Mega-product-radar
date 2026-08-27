const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export const SOURCE_RIGHTS_STATUS=Object.freeze({
  UNKNOWN:'UNKNOWN',
  ANALYSIS_ALLOWED:'ANALYSIS_ALLOWED',
  COMMERCIAL_ALLOWED:'COMMERCIAL_ALLOWED'
});

export const SOURCE_RIGHTS_PROFILE_VERSION='2.0';

const DEFAULT_PROFILE=Object.freeze({
  status:SOURCE_RIGHTS_STATUS.UNKNOWN,
  analysisAllowed:false,
  commercialUseAllowed:false,
  redistributionAllowed:false,
  derivativesAllowed:false,
  imageRights:'UNKNOWN',
  cacheTtlSeconds:null,
  license:null,
  basis:'NOT_CONFIRMED',
  reviewedAt:null,
  reviewer:null,
  evidenceRef:null,
  termsSnapshotHash:null,
  robotsSnapshotHash:null
});

const PROFILES=Object.freeze({
  OPEN_FOOD_FACTS:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:false,
    imageRights:'SEPARATE_CC_BY_SA_REVIEW_REQUIRED',
    cacheTtlSeconds:null,
    license:'ODbL-1.0',
    basis:'PUBLIC_DATABASE_LICENSE_REVIEWED_FOR_ANALYSIS; COMMERCIAL/REDISTRIBUTION OBLIGATIONS REQUIRE SEPARATE RELEASE REVIEW',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://world.openfoodfacts.org/data',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  OPEN_BEAUTY_FACTS:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:false,
    imageRights:'SEPARATE_REVIEW_REQUIRED',
    cacheTtlSeconds:null,
    license:'ODbL-1.0',
    basis:'OPEN_FACTS_FAMILY_ANALYSIS_PROFILE; COMMERCIAL/REDISTRIBUTION REVIEW REQUIRED',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://world.openbeautyfacts.org/data',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  OPEN_PET_FOOD_FACTS:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:false,
    imageRights:'SEPARATE_REVIEW_REQUIRED',
    cacheTtlSeconds:null,
    license:'ODbL-1.0',
    basis:'OPEN_FACTS_FAMILY_ANALYSIS_PROFILE; COMMERCIAL/REDISTRIBUTION REVIEW REQUIRED',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://world.openpetfoodfacts.org/data',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  OPEN_PRODUCTS_FACTS:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:false,
    imageRights:'SEPARATE_REVIEW_REQUIRED',
    cacheTtlSeconds:null,
    license:'ODbL-1.0',
    basis:'OPEN_FACTS_FAMILY_ANALYSIS_PROFILE; COMMERCIAL/REDISTRIBUTION REVIEW REQUIRED',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://world.openproductsfacts.org/data',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  EPREL_PUBLIC:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:false,
    imageRights:'SOURCE_SPECIFIC_REVIEW_REQUIRED',
    cacheTtlSeconds:null,
    license:null,
    basis:'OFFICIAL_EU_PUBLIC_PRODUCT_REGISTRY; ANALYSIS APPROVED, COMMERCIAL REDISTRIBUTION REVIEW REQUIRED',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://eprel.ec.europa.eu/',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  OPEN_ICECAT:Object.freeze({...DEFAULT_PROFILE,basis:'PENDING_OPEN_ICECAT_RIGHTS_REVIEW'}),
  MANUFACTURER_FEED:Object.freeze({...DEFAULT_PROFILE,basis:'REQUIRES_CONTRACTUAL_FEED_RIGHTS'}),
  DISTRIBUTOR_FEED:Object.freeze({...DEFAULT_PROFILE,basis:'REQUIRES_CONTRACTUAL_FEED_RIGHTS'}),
  COMMON_CRAWL_DISCOVERY:Object.freeze({
    ...DEFAULT_PROFILE,
    analysisAllowed:true,
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    basis:'DISCOVERY_ONLY; UNDERLYING_PAGE_RIGHTS MUST BE REVIEWED PER DOMAIN',
    reviewedAt:'2026-08-27T15:40:00.000Z',
    reviewer:'MPR_SOURCE_RIGHTS_REVIEW',
    evidenceRef:'https://commoncrawl.org/'
  })
});

export function getSourceRightsProfile(sourceKey){
  const key=upper(sourceKey);
  const profile=PROFILES[key]||DEFAULT_PROFILE;
  return{sourceKey:key||null,profileVersion:SOURCE_RIGHTS_PROFILE_VERSION,...profile};
}

export function isRightsReviewComplete(profile={}){
  return Boolean(
    clean(profile.sourceKey)&&
    clean(profile.reviewedAt)&&
    clean(profile.reviewer)&&
    clean(profile.evidenceRef)&&
    clean(profile.basis)
  );
}

export function evaluateSourceUse(sourceKey,{intendedUse='analysis',needsRedistribution=false,needsDerivatives=false,needsImages=false}={}){
  const profile=getSourceRightsProfile(sourceKey);
  const reasons=[];
  if(!isRightsReviewComplete(profile))reasons.push('SOURCE_RIGHTS_REVIEW_INCOMPLETE');
  if(intendedUse==='analysis'&&profile.analysisAllowed!==true)reasons.push('ANALYSIS_NOT_ALLOWED');
  if(intendedUse==='commercial'&&profile.commercialUseAllowed!==true)reasons.push('COMMERCIAL_USE_NOT_ALLOWED');
  if(needsRedistribution&&profile.redistributionAllowed!==true)reasons.push('REDISTRIBUTION_NOT_ALLOWED');
  if(needsDerivatives&&profile.derivativesAllowed!==true)reasons.push('DERIVATIVES_NOT_ALLOWED');
  if(needsImages&&!['ALLOWED','CC_BY_SA','LICENSED'].includes(upper(profile.imageRights)))reasons.push('IMAGE_RIGHTS_NOT_CONFIRMED');
  return{decision:reasons.length?'HOLD':'ACCEPT',reasons,profile};
}
