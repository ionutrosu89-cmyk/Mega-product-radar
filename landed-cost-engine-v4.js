const num=value=>Number(value);
const finitePositive=value=>Number.isFinite(num(value))&&num(value)>0;
const finiteNonNegative=value=>Number.isFinite(num(value))&&num(value)>=0;
const round=(value,digits=4)=>Number(Number(value).toFixed(digits));
const pct=value=>num(value)/100;

export function computeChargeableWeight({actualWeightKg,lengthCm,widthCm,heightCm,volumetricDivisor}={}){
  const divisor=num(volumetricDivisor);
  if(!finitePositive(actualWeightKg))return {ok:false,code:'ACTUAL_WEIGHT_REQUIRED'};
  if(!finitePositive(lengthCm)||!finitePositive(widthCm)||!finitePositive(heightCm))return {ok:false,code:'DIMENSIONS_REQUIRED'};
  if(!finitePositive(divisor))return {ok:false,code:'VOLUMETRIC_DIVISOR_REQUIRED'};
  const volumetricWeightKg=(num(lengthCm)*num(widthCm)*num(heightCm))/divisor;
  const chargeableWeightKg=Math.max(num(actualWeightKg),volumetricWeightKg);
  return {
    ok:true,
    actualWeightKg:round(actualWeightKg),
    volumetricWeightKg:round(volumetricWeightKg),
    chargeableWeightKg:round(chargeableWeightKg),
    chargeableBasis:volumetricWeightKg>num(actualWeightKg)?'VOLUMETRIC':'ACTUAL',
    volumetricDivisor:divisor
  };
}

export function computeLandedCostV4(input={}){
  const required=['supplierUnitPriceEur','quantity','freightRateEurPerChargeableKg','dutyRatePct','importVatRatePct','sellingPriceGrossEur','marketplaceFeePct'];
  for(const key of required){if(!finiteNonNegative(input[key])||(key==='quantity'&&num(input[key])<1))return {ok:false,code:`${key.toUpperCase()}_REQUIRED`};}
  if(!['RECOVERABLE','NON_RECOVERABLE'].includes(String(input.importVatTreatment||'').toUpperCase()))return {ok:false,code:'IMPORT_VAT_TREATMENT_REQUIRED'};
  if(!['VAT_INCLUSIVE','VAT_EXCLUSIVE'].includes(String(input.sellingPriceTreatment||'').toUpperCase()))return {ok:false,code:'SELLING_PRICE_TREATMENT_REQUIRED'};

  const weight=computeChargeableWeight(input);
  if(!weight.ok)return weight;

  const quantity=num(input.quantity);
  const goodsCost=num(input.supplierUnitPriceEur)*quantity;
  const freightTotal=weight.chargeableWeightKg*num(input.freightRateEurPerChargeableKg)*quantity;
  const complianceTotal=finiteNonNegative(input.complianceCostTotalEur)?num(input.complianceCostTotalEur):0;
  const otherTotal=finiteNonNegative(input.otherCostTotalEur)?num(input.otherCostTotalEur):0;
  const customsBase=goodsCost+freightTotal;
  const dutyTotal=customsBase*pct(input.dutyRatePct);
  const importVatBase=customsBase+dutyTotal+complianceTotal+otherTotal;
  const importVatTotal=importVatBase*pct(input.importVatRatePct);
  const vatRecoverable=String(input.importVatTreatment).toUpperCase()==='RECOVERABLE';
  const landedCashTotal=importVatBase+importVatTotal;
  const landedEconomicTotal=importVatBase+(vatRecoverable?0:importVatTotal);
  const landedCashUnit=landedCashTotal/quantity;
  const landedEconomicUnit=landedEconomicTotal/quantity;

  const sellingGross=num(input.sellingPriceGrossEur);
  const saleVatRate=finiteNonNegative(input.saleVatRatePct)?pct(input.saleVatRatePct):pct(input.importVatRatePct);
  const sellingPriceTreatment=String(input.sellingPriceTreatment).toUpperCase();
  const netRevenueBeforeFee=sellingPriceTreatment==='VAT_INCLUSIVE'?sellingGross/(1+saleVatRate):sellingGross;
  const marketplaceFee=sellingGross*pct(input.marketplaceFeePct);
  const otherSellingFee=finiteNonNegative(input.otherSellingFeeEur)?num(input.otherSellingFeeEur):0;
  const contributionProfit=netRevenueBeforeFee-marketplaceFee-otherSellingFee-landedEconomicUnit;
  const contributionMarginPct=netRevenueBeforeFee>0?100*contributionProfit/netRevenueBeforeFee:null;

  return {
    ok:true,
    evidenceClass:'DERIVED_FROM_EXPLICIT_INPUTS',
    weight,
    totals:{goodsCostEur:round(goodsCost),freightEur:round(freightTotal),dutyEur:round(dutyTotal),importVatEur:round(importVatTotal),complianceEur:round(complianceTotal),otherEur:round(otherTotal),landedCashEur:round(landedCashTotal),landedEconomicEur:round(landedEconomicTotal)},
    unit:{landedCashEur:round(landedCashUnit),landedEconomicEur:round(landedEconomicUnit),netRevenueBeforeMarketplaceFeeEur:round(netRevenueBeforeFee),marketplaceFeeEur:round(marketplaceFee),otherSellingFeeEur:round(otherSellingFee),contributionProfitEur:round(contributionProfit),contributionMarginPct:contributionMarginPct===null?null:round(contributionMarginPct,2)},
    assumptions:{supplierPriceBasis:'PUBLIC_STANDARD_BASELINE',negotiatedPriceIncluded:false,importVatTreatment:String(input.importVatTreatment).toUpperCase(),sellingPriceTreatment,marketplaceFeeAppliedTo:'GROSS_SELLING_PRICE',incomeTaxIncluded:false,returnsAdsStorageIncluded:false,chargeableWeightRule:'MAX_ACTUAL_VOLUMETRIC'},
    policy:{unknownInputsFailClosed:true,noSupplierNegotiatedPriceBaseline:true,noTaxAdviceClaim:true}
  };
}
