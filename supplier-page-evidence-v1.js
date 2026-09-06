const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const text=v=>String(v??'').trim();
const https=v=>/^https:\/\//i.test(text(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));

export function evaluateSupplierPageEvidence(input={}){
  const blockers=[];
  const sourceUrl=text(input.sourceUrl);
  const supplierUrl=text(input.supplierUrl);
  const supplierName=text(input.supplierName);
  const productTitle=text(input.productTitle);
  const priceMin=finite(input.priceMin)?Number(input.priceMin):null;
  const priceMax=finite(input.priceMax)?Number(input.priceMax):null;
  const moq=finite(input.moq)?Number(input.moq):null;
  if(!https(sourceUrl))blockers.push('DIRECT_PRODUCT_PAGE_REQUIRED');
  if(!supplierName)blockers.push('SUPPLIER_NAME_REQUIRED');
  if(!productTitle)blockers.push('PRODUCT_TITLE_REQUIRED');
  if(priceMin===null&&priceMax===null)blockers.push('PUBLIC_PRICE_REQUIRED');
  if(moq===null||moq<=0)blockers.push('PUBLIC_MOQ_REQUIRED');
  const exactMatch=String(input.productMatch||'').toUpperCase()==='HIGH'||input.exactProductConfirmed===true;
  if(!exactMatch)blockers.push('HIGH_PRODUCT_MATCH_REQUIRED');

  const screeningUnitPrice=priceMax!==null?priceMax:priceMin;
  const fields={
    material:text(input.material)||null,
    productDimensions:input.productDimensions||null,
    netWeight:finite(input.netWeight)?Number(input.netWeight):null,
    cartonDimensions:input.cartonDimensions||null,
    cartonGrossWeightKg:finite(input.cartonGrossWeightKg)?Number(input.cartonGrossWeightKg):null,
    supplierYears:finite(input.supplierYears)?Number(input.supplierYears):null,
    supplierRating:finite(input.supplierRating)?Number(input.supplierRating):null,
    soldCount:finite(input.soldCount)?Number(input.soldCount):null
  };
  const ready=blockers.length===0;
  return Object.freeze({
    schemaVersion:'MPR_SUPPLIER_PAGE_EVIDENCE_V1',
    status:ready?'PAGE_BACKED_SCREENING_READY':'PAGE_EVIDENCE_INCOMPLETE',
    screeningReady:ready,
    commercialQuoteVerified:false,
    supplierContactRequired:false,
    sourceUrl:sourceUrl||null,
    supplierUrl:https(supplierUrl)?supplierUrl:null,
    supplierName:supplierName||null,
    productTitle:productTitle||null,
    publicPriceMin:priceMin,
    publicPriceMax:priceMax,
    screeningUnitPrice:screeningUnitPrice===null?null:round(screeningUnitPrice),
    currency:text(input.currency).toUpperCase()||null,
    moq,
    productMatch:exactMatch?'HIGH':'UNKNOWN',
    standardFields:Object.freeze(fields),
    blockers:Object.freeze(blockers),
    evidenceClass:ready?'DIRECT_OBSERVED':'UNKNOWN',
    purchaseAuthorized:false,
    policy:'Direct product/supplier pages are accepted for sourcing screening. Public price and MOQ may feed conservative screening economics, never a claim of negotiated or guaranteed order terms. Missing standard fields remain UNKNOWN; supplier contact is not required.'
  });
}
