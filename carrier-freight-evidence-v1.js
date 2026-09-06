const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const strongClass=v=>['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED','OFFICIAL_PUBLISHED'].includes(String(v||'').toUpperCase());

export function buildCarrierFreightEvidence(input={}){
  const blockers=[];
  if(!String(input.carrier||'').trim())blockers.push('CARRIER_REQUIRED');
  if(!String(input.service||'').trim())blockers.push('SERVICE_REQUIRED');
  if(!finite(input.baseRateRon)||Number(input.baseRateRon)<0)blockers.push('BASE_RATE_REQUIRED');
  if(!strongClass(input.baseRateEvidenceClass)||!String(input.baseRateEvidenceRef||'').trim())blockers.push('BASE_RATE_EVIDENCE_REQUIRED');
  if(!finite(input.fuelSurchargePct)||Number(input.fuelSurchargePct)<0)blockers.push('CURRENT_FUEL_SURCHARGE_REQUIRED');
  if(!finite(input.processingFeeRon)||Number(input.processingFeeRon)<0)blockers.push('PROCESSING_FEE_REQUIRED');
  if(!finite(input.otherSurchargesRon)||Number(input.otherSurchargesRon)<0)blockers.push('OTHER_SURCHARGES_EXPLICIT_REQUIRED');
  if(!String(input.surchargeEvidenceRef||'').trim())blockers.push('SURCHARGE_EVIDENCE_REF_REQUIRED');
  if(!finite(input.chargeableWeightKg)||Number(input.chargeableWeightKg)<=0)blockers.push('CHARGEABLE_WEIGHT_REQUIRED');

  const base=finite(input.baseRateRon)?Number(input.baseRateRon):null;
  const fuel=base!==null&&finite(input.fuelSurchargePct)?base*Number(input.fuelSurchargePct)/100:null;
  const processing=finite(input.processingFeeRon)?Number(input.processingFeeRon):null;
  const other=finite(input.otherSurchargesRon)?Number(input.otherSurchargesRon):null;
  const complete=blockers.length===0;
  const total=complete?base+fuel+processing+other:null;

  return Object.freeze({
    schemaVersion:'MPR_CARRIER_FREIGHT_EVIDENCE_V1',
    status:complete?'COMPLETE_VERIFIED_FREIGHT':'PARTIAL_BENCHMARK_ONLY',
    decisionUsable:complete,
    carrier:String(input.carrier||'').trim()||null,
    service:String(input.service||'').trim()||null,
    chargeableWeightKg:finite(input.chargeableWeightKg)?Number(input.chargeableWeightKg):null,
    baseRateRon:base===null?null:round(base),
    fuelSurchargePct:finite(input.fuelSurchargePct)?Number(input.fuelSurchargePct):null,
    fuelSurchargeRon:fuel===null?null:round(fuel),
    processingFeeRon:processing===null?null:round(processing),
    otherSurchargesRon:other===null?null:round(other),
    fullyLoadedFreightRon:total===null?null:round(total),
    evidence:{
      baseRateEvidenceClass:String(input.baseRateEvidenceClass||'UNKNOWN').toUpperCase(),
      baseRateEvidenceRef:String(input.baseRateEvidenceRef||'').trim()||null,
      surchargeEvidenceRef:String(input.surchargeEvidenceRef||'').trim()||null,
      observedAt:String(input.observedAt||'').trim()||null
    },
    blockers:Object.freeze(blockers),
    purchaseAuthorized:false,
    policy:'Published carrier list rates are screening benchmarks only until current fuel and all applicable surcharges are explicit. Unknown surcharges never become zero.'
  });
}
