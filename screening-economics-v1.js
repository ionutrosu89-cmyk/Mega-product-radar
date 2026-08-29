const present=v=>v!==null&&v!==undefined&&v!=='';
const finite=v=>present(v)&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const nonNegative=v=>finite(v)&&Number(v)>=0;
const clean=v=>String(v??'').trim();
const round=(v,d=4)=>Number(Number(v).toFixed(d));

const BLOCKED=(blockers=[])=>({schemaVersion:'MPR_SCREENING_ECONOMICS_V1',status:'BLOCKED',evidenceClass:'SCREENING_ESTIMATE',confirmedLandedEconomics:false,blockers,scenarios:null,rankingScenario:null,verifiedSales:false,purchaseAuthorized:false});

function validateRate(v,key,blockers){if(!finite(v)||Number(v)<0||Number(v)>=1)blockers.push(`INVALID_${key.toUpperCase()}`);}
function requireNonNegative(input,key,blockers){if(!nonNegative(input[key]))blockers.push(`MISSING_${key.toUpperCase()}`);}
function requirePositive(input,key,blockers){if(!positive(input[key]))blockers.push(`MISSING_${key.toUpperCase()}`);}

function scenario(name,input,mult){
  const supplierUnit=Number(input.supplierUnitPriceRon)*mult.supplier;
  const freightUnit=Number(input.freightPerUnitRon)*mult.freight;
  const insuranceUnit=Number(input.insurancePerUnitRon)*mult.insurance;
  const customsBase=supplierUnit+freightUnit+insuranceUnit;
  const duty=customsBase*Number(input.dutyRate)*mult.duty;
  const importHandling=(Number(input.brokeragePerUnitRon)+Number(input.destinationHandlingPerUnitRon)+Number(input.domesticTransportPerUnitRon)+Number(input.packagingPerUnitRon)+Number(input.complianceReservePerUnitRon))*mult.handling;
  const importVatBase=customsBase+duty+Number(input.importVatAdditionalBasePerUnitRon)*mult.handling;
  const importVat=importVatBase*Number(input.importVatRate);
  const economicImportVat=input.importVatRecoverable?0:importVat;
  const landed=supplierUnit+freightUnit+insuranceUnit+duty+importHandling+economicImportVat;

  const sellGross=Number(input.sellPriceGrossRon);
  const netRevenue=sellGross/(1+Number(input.sellVatRate));
  const commission=sellGross*Number(input.marketplaceCommissionRate)*mult.marketplace;
  const fulfillment=Number(input.fulfillmentPerUnitRon)*mult.marketplace;
  const reserveRate=(Number(input.adsReserveRate)+Number(input.returnsReserveRate)+Number(input.warrantyReserveRate)+Number(input.otherReserveRate))*mult.reserves;
  const reserves=netRevenue*reserveRate;
  const profit=netRevenue-landed-commission-fulfillment-reserves;
  const margin=netRevenue>0?profit/netRevenue:null;
  const roi=landed>0?profit/landed:null;
  const contributionPerGross=(1/(1+Number(input.sellVatRate)))*(1-reserveRate)-Number(input.marketplaceCommissionRate)*mult.marketplace;
  const breakEven=contributionPerGross>0?(landed+fulfillment)/contributionPerGross:null;
  const targetProfit=Number(input.targetProfitPerUnitRon||0);
  const maxSupplier=(netRevenue-commission-fulfillment-reserves-targetProfit-freightUnit-insuranceUnit-duty-importHandling-economicImportVat);
  const maxFreight=(netRevenue-commission-fulfillment-reserves-targetProfit-supplierUnit-insuranceUnit-duty-importHandling-economicImportVat);
  return {name,supplierUnitPriceRon:round(supplierUnit,2),freightPerUnitRon:round(freightUnit,2),dutyPerUnitRon:round(duty,2),importVatPerUnitRon:round(importVat,2),landedCostPerUnitRon:round(landed,2),netRevenuePerUnitRon:round(netRevenue,2),marketplaceCommissionPerUnitRon:round(commission,2),fulfillmentPerUnitRon:round(fulfillment,2),reservesPerUnitRon:round(reserves,2),profitPerUnitRon:round(profit,2),netMargin:margin===null?null:round(margin,6),roi:roi===null?null:round(roi,6),breakEvenSellPriceGrossRon:breakEven===null?null:round(breakEven,2),maximumViableSupplierPriceRon:round(maxSupplier,2),maximumViableFreightPerUnitRon:round(maxFreight,2)};
}

export function calculateScreeningEconomics(input={}){
  const blockers=[];
  requirePositive(input,'supplierUnitPriceRon',blockers);
  requirePositive(input,'sellPriceGrossRon',blockers);
  for(const key of ['freightPerUnitRon','insurancePerUnitRon','brokeragePerUnitRon','destinationHandlingPerUnitRon','domesticTransportPerUnitRon','packagingPerUnitRon','complianceReservePerUnitRon','importVatAdditionalBasePerUnitRon','fulfillmentPerUnitRon'])requireNonNegative(input,key,blockers);
  for(const key of ['dutyRate','importVatRate','sellVatRate','marketplaceCommissionRate','adsReserveRate','returnsReserveRate','warrantyReserveRate','otherReserveRate'])validateRate(input[key],key,blockers);
  if(input.importVatRecoverable!==true&&input.importVatRecoverable!==false)blockers.push('IMPORT_VAT_RECOVERABILITY_REQUIRED');
  if(!clean(input.supplierPriceEvidenceRef))blockers.push('SUPPLIER_PRICE_EVIDENCE_REQUIRED');
  if(!clean(input.marketplacePriceEvidenceRef))blockers.push('MARKETPLACE_PRICE_EVIDENCE_REQUIRED');
  if(!clean(input.freightAssumptionRef))blockers.push('FREIGHT_ASSUMPTION_REF_REQUIRED');
  if(!clean(input.dutyAssumptionRef))blockers.push('DUTY_ASSUMPTION_REF_REQUIRED');
  if(!clean(input.marketplaceFeeAssumptionRef))blockers.push('MARKETPLACE_FEE_ASSUMPTION_REF_REQUIRED');
  if(!finite(input.matchConfidence)||Number(input.matchConfidence)<80)blockers.push('MATCH_CONFIDENCE_BELOW_80');
  const totalReserve=['adsReserveRate','returnsReserveRate','warrantyReserveRate','otherReserveRate'].reduce((s,k)=>s+(finite(input[k])?Number(input[k]):0),0);
  if(totalReserve>=1)blockers.push('INVALID_TOTAL_RESERVE_RATE');
  if(blockers.length)return BLOCKED([...new Set(blockers)]);

  const profiles={
    BEST:{supplier:0.97,freight:0.9,insurance:1,duty:1,handling:0.9,marketplace:0.95,reserves:0.85},
    BASE:{supplier:1,freight:1,insurance:1,duty:1,handling:1,marketplace:1,reserves:1},
    CONSERVATIVE:{supplier:1.05,freight:1.2,insurance:1.1,duty:1.05,handling:1.15,marketplace:1.05,reserves:1.2}
  };
  const scenarios={best:scenario('BEST',input,profiles.BEST),base:scenario('BASE',input,profiles.BASE),conservative:scenario('CONSERVATIVE',input,profiles.CONSERVATIVE)};
  return {schemaVersion:'MPR_SCREENING_ECONOMICS_V1',status:'SCREENED',evidenceClass:'SCREENING_ESTIMATE',confirmedLandedEconomics:false,blockers:[],rankingScenario:'CONSERVATIVE',scenarios,screeningInputs:{matchConfidence:Number(input.matchConfidence),supplierPriceEvidenceRef:clean(input.supplierPriceEvidenceRef),marketplacePriceEvidenceRef:clean(input.marketplacePriceEvidenceRef),freightAssumptionRef:clean(input.freightAssumptionRef),dutyAssumptionRef:clean(input.dutyAssumptionRef),marketplaceFeeAssumptionRef:clean(input.marketplaceFeeAssumptionRef)},truthPolicy:{screeningEstimateIsConfirmedLandedCost:false,publicSupplierListingIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,unknownEqualsZero:false,negotiatedPriceIncluded:false,verifiedSales:false,purchaseAuthorized:false},verifiedSales:false,purchaseAuthorized:false};
}
