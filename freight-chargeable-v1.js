const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>finite(v)?Number(v):null;
const round=(v,d=4)=>Number(Number(v).toFixed(d));

export const FREIGHT_MODES_V1=Object.freeze({
  EXPRESS_AIR:'EXPRESS_AIR',
  AIR_CARGO:'AIR_CARGO',
  RAIL:'RAIL',
  SEA_CBM:'SEA_CBM',
  QUOTE_TOTAL:'QUOTE_TOTAL'
});

export function cartonVolume({lengthCm,widthCm,heightCm,cartons=1}={}){
  const l=n(lengthCm),w=n(widthCm),h=n(heightCm),c=n(cartons);
  if([l,w,h,c].some(v=>v===null)||l<=0||w<=0||h<=0||c<=0)return {known:false,volumeCm3:null,volumeM3:null};
  const volumeCm3=l*w*h*c;
  return {known:true,volumeCm3:round(volumeCm3,2),volumeM3:round(volumeCm3/1_000_000,6)};
}

export function volumetricWeightKg({lengthCm,widthCm,heightCm,cartons=1,divisor}={}){
  const volume=cartonVolume({lengthCm,widthCm,heightCm,cartons});
  const d=n(divisor);
  if(!volume.known||d===null||d<=0)return {known:false,kg:null};
  return {known:true,kg:round(volume.volumeCm3/d,3)};
}

export function chargeableWeightKg(input={}){
  const actual=n(input.actualGrossWeightKg);
  const volumetric=volumetricWeightKg(input);
  if(actual===null||actual<=0||!volumetric.known)return {known:false,actualKg:actual,volumetricKg:volumetric.kg,chargeableKg:null,basis:'UNKNOWN'};
  const chargeable=Math.max(actual,volumetric.kg);
  return {known:true,actualKg:round(actual,3),volumetricKg:volumetric.kg,chargeableKg:round(chargeable,3),basis:actual>=volumetric.kg?'ACTUAL_WEIGHT':'VOLUMETRIC_WEIGHT'};
}

export function calculateFreightCost(input={}){
  const mode=String(input.mode||'QUOTE_TOTAL').toUpperCase();
  const quote=n(input.quotedFreightRon);
  if(mode==='QUOTE_TOTAL'){
    if(quote===null||quote<0)return {status:'UNKNOWN',mode,costRon:null,blockers:['FREIGHT_QUOTE_REQUIRED']};
    return {status:'CALCULATED',mode,costRon:round(quote,2),basis:'VERIFIED_TOTAL_QUOTE',chargeableWeight:null,volume:null,blockers:[]};
  }
  const volume=cartonVolume(input);
  if(mode==='SEA_CBM'){
    const rate=n(input.rateRonPerCbm);
    if(!volume.known||rate===null||rate<0)return {status:'UNKNOWN',mode,costRon:null,volume,blockers:[!volume.known?'CARTON_DIMENSIONS_REQUIRED':'RATE_PER_CBM_REQUIRED']};
    return {status:'CALCULATED',mode,costRon:round(volume.volumeM3*rate,2),basis:'CBM',volume,chargeableWeight:null,blockers:[]};
  }
  const cw=chargeableWeightKg(input);
  const rate=n(input.rateRonPerChargeableKg);
  if(!cw.known||rate===null||rate<0){
    const blockers=[];
    if(n(input.actualGrossWeightKg)===null)blockers.push('ACTUAL_GROSS_WEIGHT_REQUIRED');
    if(!volume.known)blockers.push('CARTON_DIMENSIONS_REQUIRED');
    if(n(input.divisor)===null)blockers.push('VOLUMETRIC_DIVISOR_REQUIRED');
    if(rate===null)blockers.push('RATE_PER_CHARGEABLE_KG_REQUIRED');
    return {status:'UNKNOWN',mode,costRon:null,chargeableWeight:cw,volume,blockers};
  }
  return {status:'CALCULATED',mode,costRon:round(cw.chargeableKg*rate,2),basis:cw.basis,chargeableWeight:cw,volume,blockers:[]};
}
