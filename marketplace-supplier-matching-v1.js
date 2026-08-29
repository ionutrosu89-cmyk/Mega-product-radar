import {buildProductFingerprint,fingerprintHardMismatches} from './product-fingerprint-v1.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=(v,d=2)=>Number(v.toFixed(d));
const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9ăâîșşțţ]+/giu,' ').replace(/\s+/g,' ').trim();
const known=v=>v!==null&&v!==undefined&&v!=='';

function tokens(v){
  return new Set(norm(v).split(' ').filter(t=>t.length>=2));
}

export function tokenJaccardSimilarity(a,b){
  const A=tokens(a),B=tokens(b);
  if(!A.size||!B.size)return null;
  let intersection=0;
  for(const t of A)if(B.has(t))intersection++;
  const union=new Set([...A,...B]).size;
  return union?round(intersection/union,4):null;
}

function exactKnown(a,b){
  if(!known(a)||!known(b))return null;
  return norm(a)===norm(b);
}

function numericSimilarity(a,b,tolerancePct){
  if(!known(a)||!known(b))return null;
  const x=Number(a),y=Number(b);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||y<=0)return null;
  const delta=Math.abs(x-y)/Math.max(x,y);
  if(delta<=tolerancePct)return 1;
  return clamp(1-(delta-tolerancePct)/(Math.max(0.0001,1-tolerancePct)),0,1);
}

function dimensionSimilarity(a=[],b=[],tolerancePct=0.08){
  if(!Array.isArray(a)||!Array.isArray(b)||!a.length||!b.length||a.length!==b.length)return null;
  const sims=a.map((v,i)=>numericSimilarity(v,b[i],tolerancePct));
  if(sims.some(v=>v===null))return null;
  return sims.reduce((s,v)=>s+v,0)/sims.length;
}

function technicalSpecSimilarity(a={},b={}){
  const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])];
  const comparable=keys.filter(k=>known(a?.[k])&&known(b?.[k]));
  if(!comparable.length)return null;
  let total=0;
  for(const k of comparable){
    const av=a[k],bv=b[k];
    if(typeof av==='number'&&typeof bv==='number')total+=numericSimilarity(av,bv,0.05)??0;
    else total+=exactKnown(av,bv)?1:0;
  }
  return total/comparable.length;
}

function appendCategoryCriticalMismatches(a,b,mismatches){
  const push=code=>{if(!mismatches.includes(code))mismatches.push(code);};
  if(exactKnown(a.category,b.category)===false)push('CATEGORY_MISMATCH');
  if(exactKnown(a.formFactor,b.formFactor)===false)push('FORM_FACTOR_MISMATCH');
  if(known(a.capacityMl)&&known(b.capacityMl)&&(numericSimilarity(a.capacityMl,b.capacityMl,0.05)??0)<1)push('CAPACITY_MISMATCH');
  if(known(a.powerWatts)&&known(b.powerWatts)&&(numericSimilarity(a.powerWatts,b.powerWatts,0.1)??0)<1)push('POWER_MISMATCH');
  if(known(a.voltage)&&known(b.voltage)&&Number(a.voltage)!==Number(b.voltage))push('VOLTAGE_MISMATCH');
}

const FEATURES=Object.freeze([
  {key:'category',weight:10,score:(a,b)=>exactKnown(a.category,b.category)===null?null:(exactKnown(a.category,b.category)?1:0)},
  {key:'productType',weight:15,score:(a,b)=>exactKnown(a.productType,b.productType)===null?null:(exactKnown(a.productType,b.productType)?1:0)},
  {key:'primaryFunction',weight:8,score:(a,b)=>exactKnown(a.primaryFunction,b.primaryFunction)===null?null:(exactKnown(a.primaryFunction,b.primaryFunction)?1:0)},
  {key:'packCount',weight:15,score:(a,b)=>!known(a.packCount)||!known(b.packCount)?null:(a.packCount===b.packCount?1:0)},
  {key:'material',weight:15,score:(a,b)=>exactKnown(a.material,b.material)===null?null:(exactKnown(a.material,b.material)?1:0)},
  {key:'dimensions',weight:15,score:(a,b)=>dimensionSimilarity(a.dimensions?.orientationIndependentCm,b.dimensions?.orientationIndependentCm,0.08)},
  {key:'unitWeightGrams',weight:5,score:(a,b)=>numericSimilarity(a.unitWeightGrams,b.unitWeightGrams,0.15)},
  {key:'formFactor',weight:5,score:(a,b)=>exactKnown(a.formFactor,b.formFactor)===null?null:(exactKnown(a.formFactor,b.formFactor)?1:0)},
  {key:'technicalSpecs',weight:7,score:(a,b)=>technicalSpecSimilarity(a.technicalSpecs,b.technicalSpecs)},
  {key:'semanticTitle',weight:5,score:(a,b)=>tokenJaccardSimilarity(a.sourceTitle,b.sourceTitle)}
]);

export function classifyMatchConfidence(score,{hardMismatch=false}={}){
  if(hardMismatch)return 'REJECTED_MATCH';
  if(score>=95)return 'NEAR_EXACT_MATCH';
  if(score>=90)return 'HIGH_CONFIDENCE_MATCH';
  if(score>=80)return 'ACCEPTABLE_SCREENING_MATCH';
  if(score>=60)return 'POSSIBLE_MATCH_REVIEW_REQUIRED';
  return 'REJECTED_MATCH';
}

export function matchMarketplaceToSupplier(marketplaceInput={},supplierInput={},options={}){
  const marketplace=marketplaceInput.schemaVersion==='MPR_PRODUCT_FINGERPRINT_V1'?marketplaceInput:buildProductFingerprint(marketplaceInput);
  const supplier=supplierInput.schemaVersion==='MPR_PRODUCT_FINGERPRINT_V1'?supplierInput:buildProductFingerprint(supplierInput);
  const tolerances={dimensionPct:Number(options.dimensionPct??0.08),weightPct:Number(options.weightPct??0.15)};
  const hardMismatches=[...fingerprintHardMismatches(marketplace,supplier,tolerances)];
  appendCategoryCriticalMismatches(marketplace,supplier,hardMismatches);

  const evidence=[];
  let earned=0;
  let observedWeight=0;
  for(const feature of FEATURES){
    const similarity=feature.score(marketplace,supplier);
    if(similarity===null){
      evidence.push({feature:feature.key,weight:feature.weight,status:'UNKNOWN',similarity:null,points:0});
      continue;
    }
    const points=feature.weight*clamp(similarity,0,1);
    earned+=points;
    observedWeight+=feature.weight;
    evidence.push({feature:feature.key,weight:feature.weight,status:similarity>=0.999?'MATCH':similarity<=0.001?'MISMATCH':'PARTIAL',similarity:round(similarity,4),points:round(points,2)});
  }

  const rawScore=round(earned,2);
  const coverage=round(observedWeight/100,4);
  const coveragePenalty=coverage>=0.85?1:coverage>=0.7?0.95:coverage>=0.55?0.85:coverage>=0.4?0.7:0.5;
  const confidence=hardMismatches.length?0:round(clamp(rawScore*coveragePenalty,0,100),2);
  const matchClass=classifyMatchConfidence(confidence,{hardMismatch:hardMismatches.length>0});
  const screeningEconomicsEligible=hardMismatches.length===0&&confidence>=Number(options.screeningThreshold??80);

  return {
    schemaVersion:'MPR_MARKETPLACE_SUPPLIER_MATCH_V1',
    marketplaceCanonicalProductId:marketplace.canonicalProductId,
    supplierCanonicalProductId:supplier.canonicalProductId,
    matchConfidence:confidence,
    matchClass,
    screeningEconomicsEligible,
    hardMismatches,
    evidenceCoverage:coverage,
    observedFeatureWeight:observedWeight,
    evidence,
    semanticTitleSimilarity:tokenJaccardSimilarity(marketplace.sourceTitle,supplier.sourceTitle),
    truthPolicy:{
      precisionFirst:true,
      similarTitleMayOverrideHardMismatch:false,
      unknownFeatureCountsAsMatch:false,
      unknownFeatureCountsAsZero:false,
      screeningEconomicsMinimumConfidence:Number(options.screeningThreshold??80),
      highConfidenceRequiresManualPrecisionCalibration:true
    }
  };
}

export const MatchingEngineV1Policy=Object.freeze({
  defaultScreeningThreshold:80,
  precisionBeforeRecall:true,
  hardMismatchForcesRejection:true,
  semanticSimilarityAloneIsSufficient:false,
  unknownIsMatch:false,
  unknownIsZero:false
});
