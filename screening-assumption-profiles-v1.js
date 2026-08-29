const present=v=>v!==null&&v!==undefined&&v!=='';
const finite=v=>present(v)&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const nonNegative=v=>finite(v)&&Number(v)>=0;
const clean=v=>String(v??'').trim();
const round=(v,d=4)=>Number(Number(v).toFixed(d));

function block(type,blockers){return{schemaVersion:'MPR_SCREENING_ASSUMPTION_RESOLUTION_V1',type,status:'BLOCKED',blockers,evidenceClass:'SCREENING_ASSUMPTION',value:null,sourceRef:null,confidence:null,truthPolicy:{assumptionIsQuote:false,assumptionIsConfirmedCost:false,unknownEqualsZero:false}};}

export function resolveFreightEstimate(input={}){
  const blockers=[];
  const sourceRef=clean(input.sourceRef);
  const confidence=clean(input.confidence).toUpperCase();
  if(!sourceRef)blockers.push('FREIGHT_SOURCE_REF_REQUIRED');
  if(!['LOW','MEDIUM','HIGH'].includes(confidence))blockers.push('FREIGHT_CONFIDENCE_REQUIRED');
  const actualKg=positive(input.actualWeightKg)?Number(input.actualWeightKg):null;
  const volumeCm3=positive(input.volumeCm3)?Number(input.volumeCm3):null;
  const volumetricDivisor=positive(input.volumetricDivisor)?Number(input.volumetricDivisor):null;
  const ratePerKg=positive(input.ratePerKgRon)?Number(input.ratePerKgRon):null;
  const minPerUnit=nonNegative(input.minimumPerUnitRon)?Number(input.minimumPerUnitRon):null;
  const fallback=positive(input.categoryFallbackPerUnitRon)?Number(input.categoryFallbackPerUnitRon):null;
  let chargeableKg=null,method=null,freightPerUnitRon=null;
  if(ratePerKg!==null&&(actualKg!==null||(volumeCm3!==null&&volumetricDivisor!==null))){
    const volumetricKg=volumeCm3!==null&&volumetricDivisor!==null?volumeCm3/volumetricDivisor:null;
    chargeableKg=Math.max(actualKg??0,volumetricKg??0);
    if(chargeableKg>0){freightPerUnitRon=Math.max(chargeableKg*ratePerKg,minPerUnit??0);method='WEIGHT_OR_VOLUMETRIC';}
  }else if(fallback!==null){freightPerUnitRon=fallback;method='CATEGORY_FALLBACK';}
  if(freightPerUnitRon===null)blockers.push('FREIGHT_ESTIMATE_UNRESOLVED');
  if(blockers.length)return block('FREIGHT',blockers);
  return{schemaVersion:'MPR_SCREENING_ASSUMPTION_RESOLUTION_V1',type:'FREIGHT',status:'RESOLVED',evidenceClass:'SCREENING_ASSUMPTION',value:round(freightPerUnitRon,2),unit:'RON_PER_UNIT',method,chargeableWeightKg:chargeableKg===null?null:round(chargeableKg,4),sourceRef,confidence,truthPolicy:{assumptionIsQuote:false,assumptionIsConfirmedCost:false,unknownEqualsZero:false}};
}

export function resolveDutyTaxProfile(input={}){
  const blockers=[];
  const sourceRef=clean(input.sourceRef);
  const confidence=clean(input.confidence).toUpperCase();
  if(!sourceRef)blockers.push('DUTY_SOURCE_REF_REQUIRED');
  if(!['LOW','MEDIUM','HIGH'].includes(confidence))blockers.push('DUTY_CONFIDENCE_REQUIRED');
  if(!finite(input.dutyRate)||Number(input.dutyRate)<0||Number(input.dutyRate)>=1)blockers.push('VALID_DUTY_RATE_REQUIRED');
  if(!finite(input.importVatRate)||Number(input.importVatRate)<0||Number(input.importVatRate)>=1)blockers.push('VALID_IMPORT_VAT_RATE_REQUIRED');
  if(blockers.length)return block('DUTY_TAX',blockers);
  return{schemaVersion:'MPR_SCREENING_ASSUMPTION_RESOLUTION_V1',type:'DUTY_TAX',status:'RESOLVED',evidenceClass:'SCREENING_ASSUMPTION',value:{dutyRate:Number(input.dutyRate),importVatRate:Number(input.importVatRate),classificationRef:clean(input.classificationRef)||null},sourceRef,confidence,truthPolicy:{classificationConfirmed:input.classificationConfirmed===true,assumptionIsConfirmedCost:false,unknownEqualsZero:false}};
}

export function resolveMarketplaceFeeProfile(input={}){
  const blockers=[];
  const sourceRef=clean(input.sourceRef);
  const confidence=clean(input.confidence).toUpperCase();
  if(!sourceRef)blockers.push('MARKETPLACE_FEE_SOURCE_REF_REQUIRED');
  if(!['LOW','MEDIUM','HIGH'].includes(confidence))blockers.push('MARKETPLACE_FEE_CONFIDENCE_REQUIRED');
  for(const key of ['commissionRate','adsReserveRate','returnsReserveRate','warrantyReserveRate','otherReserveRate'])if(!finite(input[key])||Number(input[key])<0||Number(input[key])>=1)blockers.push(`VALID_${key.toUpperCase()}_REQUIRED`);
  if(!nonNegative(input.fulfillmentPerUnitRon))blockers.push('VALID_FULFILLMENT_PER_UNIT_REQUIRED');
  if(blockers.length)return block('MARKETPLACE_FEES',blockers);
  return{schemaVersion:'MPR_SCREENING_ASSUMPTION_RESOLUTION_V1',type:'MARKETPLACE_FEES',status:'RESOLVED',evidenceClass:'SCREENING_ASSUMPTION',value:{marketplaceCommissionRate:Number(input.commissionRate),fulfillmentPerUnitRon:Number(input.fulfillmentPerUnitRon),adsReserveRate:Number(input.adsReserveRate),returnsReserveRate:Number(input.returnsReserveRate),warrantyReserveRate:Number(input.warrantyReserveRate),otherReserveRate:Number(input.otherReserveRate)},sourceRef,confidence,truthPolicy:{assumptionIsConfirmedFee:false,unknownEqualsZero:false}};
}
