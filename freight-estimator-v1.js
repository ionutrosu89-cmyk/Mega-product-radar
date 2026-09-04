const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const clean=v=>String(v??'').trim();
const round=(v,d=4)=>Number(Number(v).toFixed(d));

const DEFAULT_PROFILES=Object.freeze({
  SMALL_LIGHT:{maxWeightKg:0.5,maxVolumeCm3:5000,airRonPerKg:42,seaRonPerCbm:780,minAirRonPerUnit:8,minSeaRonPerUnit:3,handlingRonPerUnit:2},
  MEDIUM:{maxWeightKg:2,maxVolumeCm3:20000,airRonPerKg:38,seaRonPerCbm:700,minAirRonPerUnit:14,minSeaRonPerUnit:5,handlingRonPerUnit:3},
  BULKY:{maxWeightKg:10,maxVolumeCm3:100000,airRonPerKg:34,seaRonPerCbm:620,minAirRonPerUnit:30,minSeaRonPerUnit:10,handlingRonPerUnit:5},
  OVERSIZE:{maxWeightKg:Infinity,maxVolumeCm3:Infinity,airRonPerKg:32,seaRonPerCbm:580,minAirRonPerUnit:50,minSeaRonPerUnit:18,handlingRonPerUnit:8}
});

function dimensions(input={}){
  const l=positive(input.lengthCm)?Number(input.lengthCm):null;
  const w=positive(input.widthCm)?Number(input.widthCm):null;
  const h=positive(input.heightCm)?Number(input.heightCm):null;
  return {lengthCm:l,widthCm:w,heightCm:h,complete:l!==null&&w!==null&&h!==null,volumeCm3:l!==null&&w!==null&&h!==null?l*w*h:null};
}

function selectProfile({actualWeightKg,volumeCm3}={}){
  for(const [name,p] of Object.entries(DEFAULT_PROFILES)){
    const weightOk=actualWeightKg===null||actualWeightKg<=p.maxWeightKg;
    const volumeOk=volumeCm3===null||volumeCm3<=p.maxVolumeCm3;
    if(weightOk&&volumeOk)return{name,...p};
  }
  return{name:'OVERSIZE',...DEFAULT_PROFILES.OVERSIZE};
}

export function estimateFreightPerUnit(input={}){
  const blockers=[];
  const actualWeightKg=positive(input.actualWeightKg)?Number(input.actualWeightKg):positive(input.unitWeightGrams)?Number(input.unitWeightGrams)/1000:null;
  const d=dimensions(input.packedDimensions||input.dimensions||{});
  const volumetricDivisor=positive(input.volumetricDivisorCm3PerKg)?Number(input.volumetricDivisorCm3PerKg):6000;
  const volumetricWeightKg=d.volumeCm3!==null?d.volumeCm3/volumetricDivisor:null;
  const chargeableWeightKg=actualWeightKg!==null||volumetricWeightKg!==null?Math.max(actualWeightKg||0,volumetricWeightKg||0):null;
  const profile=selectProfile({actualWeightKg,volumeCm3:d.volumeCm3});
  const mode=clean(input.mode).toUpperCase()||'AIR';
  if(!['AIR','SEA'].includes(mode))blockers.push('UNSUPPORTED_FREIGHT_MODE');

  let freightRon=null,rule=null,confidence='LOW';
  if(!blockers.length&&mode==='AIR'){
    if(chargeableWeightKg!==null){
      freightRon=Math.max(profile.minAirRonPerUnit,chargeableWeightKg*profile.airRonPerKg)+profile.handlingRonPerUnit;
      rule='AIR_CHARGEABLE_WEIGHT';
      confidence=actualWeightKg!==null&&d.complete?'HIGH':'MEDIUM';
    }else{
      freightRon=profile.minAirRonPerUnit+profile.handlingRonPerUnit;
      rule='AIR_CATEGORY_PROFILE_FLOOR';
      confidence='LOW';
    }
  }
  if(!blockers.length&&mode==='SEA'){
    if(d.volumeCm3!==null){
      freightRon=Math.max(profile.minSeaRonPerUnit,(d.volumeCm3/1e6)*profile.seaRonPerCbm)+profile.handlingRonPerUnit;
      rule='SEA_UNIT_VOLUME';
      confidence=d.complete?'MEDIUM':'LOW';
    }else{
      freightRon=profile.minSeaRonPerUnit+profile.handlingRonPerUnit;
      rule='SEA_CATEGORY_PROFILE_FLOOR';
      confidence='LOW';
    }
  }

  return {
    schemaVersion:'MPR_FREIGHT_ESTIMATE_V1',
    status:blockers.length?'BLOCKED':'ESTIMATED',
    blockers,
    evidenceClass:'SCREENING_ESTIMATE',
    mode,
    profile:profile.name,
    actualWeightKg:actualWeightKg===null?null:round(actualWeightKg),
    volumetricWeightKg:volumetricWeightKg===null?null:round(volumetricWeightKg),
    chargeableWeightKg:chargeableWeightKg===null?null:round(chargeableWeightKg),
    packedVolumeCm3:d.volumeCm3===null?null:round(d.volumeCm3,2),
    freightPerUnitRon:freightRon===null?null:round(freightRon,2),
    rule,
    confidence,
    assumptionRef:freightRon===null?null:`FREIGHT_PROFILE_V1:${mode}:${profile.name}`,
    truthPolicy:{estimatedFreightIsConfirmedFreight:false,unknownDimensionsMayUseConservativeProfile:true,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

export const FreightEstimatorV1Policy=Object.freeze({
  defaultMode:'AIR',
  volumetricDivisorCm3PerKg:6000,
  unknownUsesConservativeProfileFloor:true,
  estimatedIsConfirmed:false
});
