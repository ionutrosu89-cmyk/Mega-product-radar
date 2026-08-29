const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));
const blocked=blockers=>({version:'1.0',status:'BLOCKED',confirmedLandedEconomics:false,blockers,landedCostPerSet:null,profitPerSet:null,margin:null,roi:null,breakEvenSellPriceGrossRon:null,verifiedSales:false,purchaseAuthorized:false});

export function calculateLandedEconomics(input={}){
  const blockers=[];
  if(input.supplierPackageVerified!==true) blockers.push('SUPPLIER_PACKAGE_NOT_VERIFIED');
  if(input.romaniaGapExact!==true) blockers.push('ROMANIA_GAP_NOT_EXACT');
  const required=['sellableSets','goodsValueRon','internationalFreightRon','insuranceRon','dutyRate','importVatRate','importVatAdditionalBaseRon','brokerageRon','destinationHandlingRon','domesticTransportRon','complianceRon','sellPriceGrossRon','sellVatRate','marketplaceCommissionRate','fulfillmentPerSetRon','adsReserveRate','returnsReserveRate','otherReserveRate'];
  for(const key of required) if(!finite(input[key])) blockers.push(`MISSING_${key.toUpperCase()}`);
  if(input.quoteCurrency&&String(input.quoteCurrency).toUpperCase()!=='RON'){
    if(!finite(input.fxRate)) blockers.push('FX_RATE_REQUIRED');
    if(!String(input.fxSource??'').trim()) blockers.push('FX_SOURCE_REQUIRED');
  }
  if(input.importVatRecoverable!==true&&input.importVatRecoverable!==false) blockers.push('IMPORT_VAT_RECOVERABILITY_REQUIRED');
  if(!String(input.freightEvidenceRef??'').trim()) blockers.push('FREIGHT_EVIDENCE_REQUIRED');
  if(!String(input.dutyEvidenceRef??'').trim()) blockers.push('DUTY_EVIDENCE_REQUIRED');
  if(!String(input.importVatBaseEvidenceRef??'').trim()) blockers.push('IMPORT_VAT_BASE_EVIDENCE_REQUIRED');
  if(!String(input.sellPriceEvidenceRef??'').trim()) blockers.push('SELL_PRICE_EVIDENCE_REQUIRED');
  if(blockers.length) return blocked(blockers);

  const sets=Number(input.sellableSets);
  if(sets<=0) return blocked(['SELLABLE_SETS_MUST_BE_POSITIVE']);
  const rates=['dutyRate','importVatRate','sellVatRate','marketplaceCommissionRate','adsReserveRate','returnsReserveRate','otherReserveRate'];
  for(const key of rates){const v=Number(input[key]);if(v<0||v>=1) return blocked([`INVALID_${key.toUpperCase()}`]);}
  const reserveRate=Number(input.adsReserveRate)+Number(input.returnsReserveRate)+Number(input.otherReserveRate);
  if(reserveRate>=1) return blocked(['INVALID_TOTAL_RESERVE_RATE']);

  const goods=Number(input.goodsValueRon), freight=Number(input.internationalFreightRon), insurance=Number(input.insuranceRon);
  const customsValue=goods+freight+insurance;
  const customsDuty=customsValue*Number(input.dutyRate);
  const importVatBase=customsValue+customsDuty+Number(input.importVatAdditionalBaseRon);
  const importVat=importVatBase*Number(input.importVatRate);
  const recoverableVat=input.importVatRecoverable?importVat:0;
  const cashTotal=goods+freight+insurance+customsDuty+importVat+Number(input.brokerageRon)+Number(input.destinationHandlingRon)+Number(input.domesticTransportRon)+Number(input.complianceRon);
  const netEconomicTotal=cashTotal-recoverableVat;
  const cashLandedPerSet=cashTotal/sets;
  const landedCostPerSet=netEconomicTotal/sets;

  const gross=Number(input.sellPriceGrossRon);
  const netRevenue=gross/(1+Number(input.sellVatRate));
  const commission=gross*Number(input.marketplaceCommissionRate);
  const reserves=netRevenue*reserveRate;
  const variableNonLanded=commission+Number(input.fulfillmentPerSetRon)+reserves;
  const profit=netRevenue-landedCostPerSet-variableNonLanded;
  const margin=profit/netRevenue;
  const roi=profit/landedCostPerSet;

  const contributionPerGross=(1/(1+Number(input.sellVatRate)))*(1-reserveRate)-Number(input.marketplaceCommissionRate);
  const breakEvenGross=contributionPerGross>0?(landedCostPerSet+Number(input.fulfillmentPerSetRon))/contributionPerGross:null;

  return {version:'1.0',status:'CONFIRMED',confirmedLandedEconomics:true,blockers:[],customsValueRon:round(customsValue,2),customsDutyRon:round(customsDuty,2),importVatBaseRon:round(importVatBase,2),importVatRon:round(importVat,2),recoverableImportVatRon:round(recoverableVat,2),cashLandedCostPerSet:round(cashLandedPerSet,2),landedCostPerSet:round(landedCostPerSet,2),netSellRevenuePerSet:round(netRevenue,2),marketplaceCommissionPerSet:round(commission,2),reservesPerSet:round(reserves,2),profitPerSet:round(profit,2),margin:round(margin,6),roi:round(roi,6),breakEvenSellPriceGrossRon:breakEvenGross==null?null:round(breakEvenGross,2),verifiedSales:false,purchaseAuthorized:false,policy:'UNKNOWN_NEVER_COERCED_TO_ZERO; CONFIRMED_REQUIRES_VERIFIED_SUPPLIER_PACKAGE+EXACT_ROMANIA_GAP+COMPLETE_NUMERIC_COSTS+FREIGHT/DUTY/IMPORT_VAT_BASE/SELL_PRICE_EVIDENCE+VAT_RECOVERABILITY+FX_EVIDENCE_WHEN_NEEDED'};
}
