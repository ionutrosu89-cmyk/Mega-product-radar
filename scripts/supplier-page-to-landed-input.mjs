import {activeMarketProfile} from '../market-profiles-v1.js';
import {resolveCarrierDivisor} from '../carrier-profiles-v1.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const text=v=>String(v??'').trim();

export function buildSupplierPageScreeningInput(record={},carrierCode='DHL_EXPRESS'){
  const market=activeMarketProfile();
  const page=record.directProductPageEvidence||record;
  const blockers=[];
  const sourceUrl=text(record.sourceUrl||page.sourceUrl);
  const supplierName=text(record.supplierName||page.supplierName);
  const priceRange=Array.isArray(page.publicPriceRangeUsd)?page.publicPriceRangeUsd.filter(finite).map(Number):[];
  const unitPrice=finite(page.publicUnitPrice)?Number(page.publicUnitPrice):priceRange.length?Math.max(...priceRange):finite(record.unitPrice)?Number(record.unitPrice):null;
  const currency=text(page.currency||record.currency||'USD').toUpperCase();
  const moq=finite(page.publicMoq)?Number(page.publicMoq):finite(record.moq)?Number(record.moq):null;

  if(!sourceUrl.startsWith('http'))blockers.push('DIRECT_PRODUCT_PAGE_URL_MISSING');
  if(!supplierName)blockers.push('SUPPLIER_NAME_MISSING');
  if(!(unitPrice>0))blockers.push('PUBLIC_PRICE_MISSING');
  if(!(moq>0))blockers.push('PUBLIC_MOQ_MISSING');

  const length=num(record.cartonLengthCm),width=num(record.cartonWidthCm),height=num(record.cartonHeightCm),actual=num(record.cartonGrossWeightKg);
  const {divisor,source:divisorSource,profile}=resolveCarrierDivisor(carrierCode);
  const volumetric=(length&&width&&height&&divisor)?(length*width*height/divisor):null;
  const chargeable=actual!==null&&volumetric!==null?Math.max(actual,volumetric):actual??volumetric;

  return {
    version:'1.0',
    status:blockers.length?'BLOCKED_INSUFFICIENT_PAGE_EVIDENCE':'PAGE_BACKED_SCREENING_READY',
    blockers,
    evidenceClass:'SUPPLIER_PAGE_OBSERVED',
    commercialQuoteSubstitute:false,
    supplierContactRequired:false,
    userApprovalRequiredBeforeSampleOrOrder:true,
    productCanonicalKey:record.productCanonicalKey||null,
    supplierName,
    sourceUrl,
    publicUnitPrice:unitPrice,
    publicPriceRange:priceRange,
    currency,
    publicMoq:moq,
    marketCode:market.code,
    importVatRatePct:market.importVatRatePct,
    sellVatRatePct:market.sellVatRatePct,
    logistics:{
      cartonQuantity:num(record.cartonQuantity),
      cartonLengthCm:length,
      cartonWidthCm:width,
      cartonHeightCm:height,
      actualGrossWeightKg:actual,
      carrierCode:profile?.code||carrierCode,
      volumetricDivisorCm3PerKg:divisor,
      volumetricDivisorSource:divisorSource,
      volumetricWeightKg:volumetric,
      chargeableWeightKg:chargeable,
      chargingRule:'MAX_ACTUAL_OR_VOLUMETRIC'
    },
    supplierStatedScenario:{
      quoteQuantity:num(record.quoteQuantity),
      supplierStatedProductTotal:num(record.totalProductPrice),
      supplierStatedFreight:num(record.bulkShippingToRomania),
      supplierStatedDeliveredTotal:num(record.quotedTotalDdp),
      incoterm:text(record.incoterm)||null,
      evidenceStatus:record.evidenceStatus||null
    },
    policy:'Public supplier-page data is sufficient for screening and estimates. It does not become a verified commercial quote. Missing fields remain unknown. Sample, negotiation, order and purchase require explicit user approval.'
  };
}
