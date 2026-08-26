const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const STRONG=new Set(['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED']);

export const IMPORTABILITY_CRITICAL_FACTS_V2=Object.freeze(['productType','isLiquid','regulatedOrSpecialAuthorization','dangerousGoods','airFreightSuitable','unitWeightKg','packedDimensionsCm','hasBattery']);

function normalizeEvidence(raw,key){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {key,value:null,evidenceClass:'UNKNOWN',observedAt:null,source:null,sourceUrl:null,strong:false,known:false};
  const evidenceClass=upper(raw.evidenceClass)||'UNKNOWN';
  const value=raw.value===undefined?null:raw.value;
  return {key,value,evidenceClass,observedAt:text(raw.observedAt)||null,source:text(raw.source)||null,sourceUrl:text(raw.sourceUrl)||null,strong:STRONG.has(evidenceClass),known:value!==null&&value!==undefined&&value!==''};
}

function dimsValue(e){
  if(!e.known||typeof e.value!=='object')return null;
  const length=num(e.value.length),width=num(e.value.width),height=num(e.value.height);
  if([length,width,height].some(v=>v===null||v<=0))return null;
  return {length,width,height,volumeCm3:Number((length*width*height).toFixed(2))};
}

function stale(e,now,maxAgeDays=180){
  if(!e.observedAt)return false;
  const t=Date.parse(e.observedAt),n=Date.parse(now);
  return Number.isFinite(t)&&Number.isFinite(n)&&n-t>maxAgeDays*86400000;
}

export function analyzeImportabilityV2({canonicalProductId=null,facts={},now=new Date().toISOString(),limits={}}={}){
  const id=text(canonicalProductId).toLowerCase()||null;
  const weightLimit=num(limits.maxUnitWeightKg)??2;
  const volumeLimit=num(limits.maxPackedVolumeCm3)??15000;
  const evidence=Object.fromEntries(IMPORTABILITY_CRITICAL_FACTS_V2.map(k=>[k,normalizeEvidence(facts[k],k)]));
  const dims=dimsValue(evidence.packedDimensionsCm);
  const weight=num(evidence.unitWeightKg.value);
  const hardBlockers=[],softRisks=[],unknowns=[],evidenceProblems=[];

  if(!id)unknowns.push('CANONICAL_PRODUCT_ID_REQUIRED');
  for(const key of IMPORTABILITY_CRITICAL_FACTS_V2){
    const e=evidence[key];
    if(!e.known)unknowns.push(`${key.toUpperCase()}_UNKNOWN`);
    else if(!e.strong)evidenceProblems.push(`${key.toUpperCase()}_WEAK_EVIDENCE`);
    if(e.known&&stale(e,now))evidenceProblems.push(`${key.toUpperCase()}_STALE_EVIDENCE`);
  }
  if(evidence.packedDimensionsCm.known&&!dims)evidenceProblems.push('PACKED_DIMENSIONS_INVALID');
  if(evidence.unitWeightKg.known&&(weight===null||weight<=0))evidenceProblems.push('UNIT_WEIGHT_INVALID');

  if(evidence.isLiquid.value===true)hardBlockers.push('LIQUID_PRODUCT');
  if(evidence.regulatedOrSpecialAuthorization.value===true)hardBlockers.push('REGULATED_OR_SPECIAL_AUTHORIZATION');
  if(evidence.dangerousGoods.value===true)hardBlockers.push('DANGEROUS_GOODS');
  if(evidence.airFreightSuitable.value===false)hardBlockers.push('AIR_FREIGHT_UNSUITABLE');
  if(weight!==null&&weight>weightLimit)hardBlockers.push('UNIT_WEIGHT_ABOVE_LIMIT');
  if(dims?.volumeCm3>volumeLimit)hardBlockers.push('PACKED_VOLUME_ABOVE_LIMIT');

  if(evidence.hasBattery.value===true)softRisks.push('BATTERY_LOGISTICS_REVIEW_REQUIRED');
  if(weight!==null&&weight>weightLimit*0.75&&weight<=weightLimit)softRisks.push('WEIGHT_NEAR_LIMIT');
  if(dims&&dims.volumeCm3>volumeLimit*0.75&&dims.volumeCm3<=volumeLimit)softRisks.push('VOLUME_NEAR_LIMIT');

  const criticalEvidenceComplete=Boolean(id&&unknowns.length===0&&evidenceProblems.length===0);
  let status='UNKNOWN_FAIL_CLOSED';
  if(hardBlockers.length)status='BLOCKED';
  else if(criticalEvidenceComplete&&softRisks.length===0)status='PASS';
  else if(criticalEvidenceComplete)status='REVIEW';

  return Object.freeze({
    schemaVersion:'MPR_IMPORTABILITY_V2',canonicalProductId:id,status,decisionEligible:Boolean(id),criticalEvidenceComplete,
    hardBlockers:Object.freeze(hardBlockers),softRisks:Object.freeze(softRisks),unknowns:Object.freeze(unknowns),evidenceProblems:Object.freeze(evidenceProblems),
    metrics:Object.freeze({unitWeightKg:weight,packedVolumeCm3:dims?.volumeCm3??null,weightLimitKg:weightLimit,volumeLimitCm3:volumeLimit}),
    evidence:Object.freeze(evidence),importabilityPassed:status==='PASS',supplierValidationEligible:['PASS','REVIEW'].includes(status),
    canPromoteToFinalist:false,canPromoteToTestReady:false,canPromoteToBuyReady:false,purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'CANONICAL_PRODUCT_ID_REQUIRED; CRITICAL_UNKNOWN_FAILS_CLOSED; STRONG_PROVENANCE_REQUIRED; HARD_BLOCKERS_OVERRIDE_SCORE; SOFT_RISK_REQUIRES_REVIEW; IMPORTABILITY_NEVER_AUTHORIZES_PURCHASE'
  });
}

export function adaptImportabilityV1ProfileToV2(profile={}){
  const f=profile.facts||{},observedAt=text(profile.observedAt)||null,source=text(profile.source)||'LEGACY_IMPORTABILITY_PROFILE',evidenceClass=upper(profile.evidenceClass)||'UNKNOWN';
  const wrap=value=>({value,evidenceClass,observedAt,source,sourceUrl:text(profile.sourceUrl)||null});
  const dimensions=f.packedDimensionsCm||null;
  return Object.freeze({canonicalProductId:text(profile.canonicalProductId)||null,facts:{productType:wrap(f.productTypeConfirmed===true?(f.productType||'CONFIRMED'):null),isLiquid:wrap(f.isLiquid),regulatedOrSpecialAuthorization:wrap(f.regulatedOrSpecialAuthorization),dangerousGoods:wrap(f.dangerousGoods),airFreightSuitable:wrap(f.airFreightSuitable),unitWeightKg:wrap(f.weightConfirmed===true?f.unitWeightKg:null),packedDimensionsCm:wrap(f.dimensionsConfirmed===true?dimensions:null),hasBattery:wrap(f.hasBattery)}});
}
