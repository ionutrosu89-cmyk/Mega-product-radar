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
  KAGGLE_AMAZON_PRODUCTS_2023:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.COMMERCIAL_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:true,
    redistributionAllowed:true,
    derivativesAllowed:true,
    imageRights:'NOT_INCLUDED',
    cacheTtlSeconds:null,
    license:'ODC-By-1.0',
    basis:'DATABASE FACTS ONLY; ATTRIBUTION REQUIRED; PRODUCT IMAGES, DESCRIPTIONS AND TRADEMARK CONTENT EXCLUDED UNLESS SEPARATELY LICENSED',
    reviewedAt:'2026-09-02T00:00:00.000Z',
    reviewer:'MPR_ZERO_COST_PUBLIC_LICENSE_REVIEW',
    evidenceRef:'https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  THE_MARKUP_AMAZON_SEARCHES_2021:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.COMMERCIAL_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:true,
    redistributionAllowed:true,
    derivativesAllowed:true,
    imageRights:'NOT_INCLUDED',
    cacheTtlSeconds:null,
    license:'BSD-3-Clause',
    basis:'PINNED HISTORICAL RESEARCH DATASET; LICENSE NOTICE REQUIRED; NEVER PRESENT AS CURRENT MARKET OR VERIFIED SALES',
    reviewedAt:'2026-09-02T00:00:00.000Z',
    reviewer:'MPR_ZERO_COST_PUBLIC_LICENSE_REVIEW',
    evidenceRef:'https://github.com/the-markup/investigation-amazon-brands',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  YOUTUBE_DATA_API:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:true,
    imageRights:'NOT_INCLUDED',
    cacheTtlSeconds:null,
    license:'YOUTUBE_API_SERVICES_TERMS',
    basis:'OFFICIAL API PILOT ONLY; COMMERCIAL DISPLAY, CACHING AND DELETION REQUIRE FINAL TERMS CHECK AND API CREDENTIALS',
    reviewedAt:'2026-09-02T00:00:00.000Z',
    reviewer:'MPR_ZERO_COST_API_PRECHECK',
    evidenceRef:'https://developers.google.com/youtube/v3/getting-started',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  MANUAL_PUBLIC_FACT_CHECK:Object.freeze({
    status:SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED,
    analysisAllowed:true,
    commercialUseAllowed:false,
    redistributionAllowed:false,
    derivativesAllowed:true,
    imageRights:'NOT_INCLUDED',
    cacheTtlSeconds:null,
    license:null,
    basis:'LIMITED HUMAN REVIEW OF MINIMAL FACTS AND SOURCE URL; NO SYSTEMATIC EXTRACTION OR COPYING OF PROTECTED CONTENT',
    reviewedAt:'2026-09-02T00:00:00.000Z',
    reviewer:'MPR_ZERO_COST_MANUAL_RESEARCH_POLICY',
    evidenceRef:'docs/ZERO_COST_BETA_OPERATING_PLAN_V1.md',
    termsSnapshotHash:null,
    robotsSnapshotHash:null
  }),
  TIKTOK_COMMERCIAL_CONTENT_API:Object.freeze({...DEFAULT_PROFILE,basis:'OFFICIAL APPLICATION AND WRITTEN COMMERCIAL USE CONFIRMATION REQUIRED'}),
  META_AD_LIBRARY:Object.freeze({...DEFAULT_PROFILE,basis:'MANUAL REVIEW ONLY; AUTOMATED COLLECTION REQUIRES EXPRESS WRITTEN PERMISSION'}),
  AMAZON_PUBLIC_PRODUCT_PAGE:Object.freeze({...DEFAULT_PROFILE,basis:'PUBLIC PAGE AUTOMATION AND COMMERCIAL DISPLAY NOT APPROVED'}),
  EMAG_PUBLIC_PRODUCT_PAGE:Object.freeze({...DEFAULT_PROFILE,basis:'PUBLIC PAGE AUTOMATION AND COMMERCIAL DISPLAY NOT APPROVED'}),
  TRENDYOL_PUBLIC_PRODUCT_PAGE:Object.freeze({...DEFAULT_PROFILE,basis:'PUBLIC PAGE AUTOMATION AND COMMERCIAL DISPLAY NOT APPROVED'}),
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
