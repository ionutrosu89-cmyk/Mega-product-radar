import {calculateFreightCost} from './freight-chargeable-v1.js';
import {resolveCarrierDivisor} from './carrier-profiles-v1.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function compareFreightOptions({options=[],carton={}}={}){
  const rows=(Array.isArray(options)?options:[]).map((option,index)=>{
    const carrierCode=String(option.carrierCode||'').toUpperCase();
    const divisor=resolveCarrierDivisor(carrierCode,option.volumetricDivisor).divisor;
    const result=calculateFreightCost({
      mode:option.mode||'QUOTE_TOTAL',
      quotedFreightRon:option.quotedFreightRon,
      lengthCm:option.lengthCm??carton.lengthCm,
      widthCm:option.widthCm??carton.widthCm,
      heightCm:option.heightCm??carton.heightCm,
      cartons:option.cartons??carton.cartons??1,
      actualGrossWeightKg:option.actualGrossWeightKg??carton.actualGrossWeightKg,
      divisor,
      rateRonPerChargeableKg:option.rateRonPerChargeableKg,
      rateRonPerCbm:option.rateRonPerCbm
    });
    const evidenceRef=String(option.evidenceRef||'').trim();
    const evidenceClass=String(option.evidenceClass||'UNKNOWN').toUpperCase();
    const strong=['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED'].includes(evidenceClass);
    const usable=result.status==='CALCULATED'&&strong&&Boolean(evidenceRef);
    return Object.freeze({
      id:String(option.id||`freight-${index+1}`),
      carrierCode:carrierCode||null,
      service:String(option.service||'').trim()||null,
      mode:String(option.mode||'QUOTE_TOTAL').toUpperCase(),
      result,
      evidenceClass,
      evidenceRef:evidenceRef||null,
      usableForDecision:usable,
      costRon:result.status==='CALCULATED'?round(result.costRon):null,
      chargeableWeightKg:result.chargeableWeight?.chargeableKg??null,
      basis:result.basis??null,
      blockers:[
        ...(result.blockers||[]),
        ...(!strong?['FREIGHT_EVIDENCE_NOT_STRONG']:[]),
        ...(!evidenceRef?['FREIGHT_EVIDENCE_REF_REQUIRED']:[])
      ]
    });
  });
  const usable=rows.filter(x=>x.usableForDecision).sort((a,b)=>a.costRon-b.costRon);
  return Object.freeze({
    schemaVersion:'MPR_FREIGHT_COMPARISON_V1',
    status:usable.length?'READY':'UNKNOWN_FAIL_CLOSED',
    options:Object.freeze(rows),
    cheapestVerified:usable[0]||null,
    verifiedOptionCount:usable.length,
    policy:'Only evidence-backed carrier/forwarder rates or verified total quotes may be used for decision economics. The cheapest unknown or weak option is never selected.'
  });
}
