const REVIEWED_AT='2026-08-22';
const OBSERVED_RANK_SOURCES=new Set(['BEAUTYMATTER']);

function evidenceType(product){
  const kind=String(product?.sourceKind||'');
  const hasSearchMetric=product?.metric?.unit==='searches'&&Number.isFinite(Number(product?.metric?.value));
  if(OBSERVED_RANK_SOURCES.has(product?.sourceKey)&&Number.isInteger(product?.sourceRank)&&product.sourceRank>0)return 'EXACT_RANK';
  if(hasSearchMetric)return 'SEARCH_VOLUME';
  if(kind==='HISTORICAL_DATASET')return 'HISTORICAL_PRODUCT';
  if(['BEST_SELLERS','NEW_RELEASES','CATEGORY_LIST'].includes(kind))return 'EXACT_PRODUCT';
  if(kind==='TREND_GROWTH')return 'TREND_SIGNAL';
  if(['AMAZON_EDITORIAL','EDITORIAL_RANKING','PUBLISHED_RANKING'].includes(kind))return 'EDITORIAL_SIGNAL';
  return 'CATEGORY_EVIDENCE';
}

function evidenceConfidence(type,tier){
  if(type==='EXACT_RANK')return 'HIGH';
  if(type==='EXACT_PRODUCT'&&tier==='A')return 'HIGH';
  if(type==='SEARCH_VOLUME')return 'HIGH';
  if(type==='CATEGORY_EVIDENCE'&&tier==='A')return 'MEDIUM';
  return 'MEDIUM';
}

function evidenceClass(type){
  return ['EXACT_RANK','EXACT_PRODUCT','SEARCH_VOLUME'].includes(type)?'VERIFIED':'DERIVED';
}

export function hardenTop25Evidence(product){
  const type=evidenceType(product);
  const sourceRankObserved=type==='EXACT_RANK';
  return {
    ...product,
    sourceRank:sourceRankObserved?product.sourceRank:null,
    sourceRankObserved,
    evidenceType:type,
    evidenceConfidence:evidenceConfidence(type,product?.sourceTier),
    evidenceClass:evidenceClass(type),
    evidenceReviewedAt:REVIEWED_AT
  };
}

export const TOP25_EVIDENCE_REVIEWED_AT=REVIEWED_AT;
