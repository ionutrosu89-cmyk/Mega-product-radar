import crypto from 'node:crypto';

const text=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const positiveNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const nonNegativeNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const stringOrNull=v=>{const s=text(v);return s||null;};
const uniqSorted=a=>[...new Set((Array.isArray(a)?a:[]).map(stringOrNull).filter(Boolean))].sort();
const round=(v,d=3)=>v===null?null:Number(v.toFixed(d));

function normalizeDimensions(input={}){
  const lengthCm=positiveNumber(input.lengthCm);
  const widthCm=positiveNumber(input.widthCm);
  const heightCm=positiveNumber(input.heightCm);
  const diameterCm=positiveNumber(input.diameterCm);
  const values=[lengthCm,widthCm,heightCm].filter(v=>v!==null).sort((a,b)=>b-a).map(v=>round(v));
  return {
    lengthCm:lengthCm===null?null:round(lengthCm),
    widthCm:widthCm===null?null:round(widthCm),
    heightCm:heightCm===null?null:round(heightCm),
    diameterCm:diameterCm===null?null:round(diameterCm),
    orientationIndependentCm:values
  };
}

export function buildProductFingerprint(input={}){
  const packCount=positiveNumber(input.packCount);
  const fingerprint={
    schemaVersion:'MPR_PRODUCT_FINGERPRINT_V1',
    category:stringOrNull(input.category),
    productType:stringOrNull(input.productType),
    primaryFunction:stringOrNull(input.primaryFunction),
    packCount:packCount===null?null:Math.trunc(packCount),
    material:stringOrNull(input.material),
    dimensions:normalizeDimensions(input.dimensions||{}),
    unitWeightGrams:positiveNumber(input.unitWeightGrams),
    capacityMl:positiveNumber(input.capacityMl),
    powerWatts:positiveNumber(input.powerWatts),
    voltage:positiveNumber(input.voltage),
    targetUser:stringOrNull(input.targetUser),
    formFactor:stringOrNull(input.formFactor),
    regulatoryClass:stringOrNull(input.regulatoryClass),
    brandDependence:stringOrNull(input.brandDependence),
    technicalSpecs:Object.fromEntries(Object.entries(input.technicalSpecs||{}).map(([k,v])=>[text(k),typeof v==='number'?v:stringOrNull(v)]).filter(([k,v])=>k&&v!==null).sort(([a],[b])=>a.localeCompare(b))),
    variantAttributes:Object.fromEntries(Object.entries(input.variantAttributes||{}).map(([k,v])=>[text(k),stringOrNull(v)]).filter(([k,v])=>k&&v).sort(([a],[b])=>a.localeCompare(b))),
    tags:uniqSorted(input.tags),
    sourceTitle:stringOrNull(input.sourceTitle)
  };

  const identityCritical={
    category:fingerprint.category,
    productType:fingerprint.productType,
    primaryFunction:fingerprint.primaryFunction,
    packCount:fingerprint.packCount,
    material:fingerprint.material,
    dimensions:fingerprint.dimensions.orientationIndependentCm,
    unitWeightGrams:fingerprint.unitWeightGrams===null?null:round(fingerprint.unitWeightGrams),
    capacityMl:fingerprint.capacityMl===null?null:round(fingerprint.capacityMl),
    powerWatts:fingerprint.powerWatts===null?null:round(fingerprint.powerWatts),
    voltage:fingerprint.voltage===null?null:round(fingerprint.voltage),
    targetUser:fingerprint.targetUser,
    formFactor:fingerprint.formFactor,
    regulatoryClass:fingerprint.regulatoryClass,
    brandDependence:fingerprint.brandDependence,
    technicalSpecs:fingerprint.technicalSpecs
  };
  const serialized=JSON.stringify(identityCritical);
  const identityHash=crypto.createHash('sha256').update(serialized).digest('hex');
  const completenessFields=[identityCritical.category,identityCritical.productType,identityCritical.packCount,identityCritical.material,identityCritical.dimensions.length?true:null];
  const completeness=round(completenessFields.filter(v=>v!==null&&v!==undefined).length/completenessFields.length,3);
  return {...fingerprint,identityCritical,identityHash,canonicalProductId:`pf1_${identityHash.slice(0,24)}`,identityCompleteness:completeness};
}

export function fingerprintHardMismatches(a={},b={},tolerance={dimensionPct:0.08,weightPct:0.15}){
  const mismatches=[];
  const fa=a.schemaVersion==='MPR_PRODUCT_FINGERPRINT_V1'?a:buildProductFingerprint(a);
  const fb=b.schemaVersion==='MPR_PRODUCT_FINGERPRINT_V1'?b:buildProductFingerprint(b);
  if(fa.packCount!==null&&fb.packCount!==null&&fa.packCount!==fb.packCount)mismatches.push('PACK_COUNT_MISMATCH');
  if(fa.material&&fb.material&&fa.material!==fb.material)mismatches.push('MATERIAL_MISMATCH');
  if(fa.productType&&fb.productType&&fa.productType!==fb.productType)mismatches.push('PRODUCT_TYPE_MISMATCH');
  if(fa.regulatoryClass&&fb.regulatoryClass&&fa.regulatoryClass!==fb.regulatoryClass)mismatches.push('REGULATORY_CLASS_MISMATCH');
  const da=fa.dimensions.orientationIndependentCm,db=fb.dimensions.orientationIndependentCm;
  if(da.length&&db.length&&da.length===db.length){
    const bad=da.some((v,i)=>Math.abs(v-db[i])/Math.max(v,db[i])>Number(tolerance.dimensionPct));
    if(bad)mismatches.push('DIMENSION_MISMATCH');
  }
  if(fa.unitWeightGrams!==null&&fb.unitWeightGrams!==null){
    const delta=Math.abs(fa.unitWeightGrams-fb.unitWeightGrams)/Math.max(fa.unitWeightGrams,fb.unitWeightGrams);
    if(delta>Number(tolerance.weightPct))mismatches.push('UNIT_WEIGHT_MISMATCH');
  }
  return mismatches;
}

export const ProductFingerprintTruthPolicy=Object.freeze({
  similarIsSameProduct:false,
  unknownEqualsZero:false,
  differentPackSizesMayMerge:false,
  descriptiveTitleMayOverrideHardMismatch:false
});
