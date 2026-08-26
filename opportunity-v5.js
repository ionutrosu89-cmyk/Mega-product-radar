const text=v=>String(v??'').trim();
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));

export const OPPORTUNITY_WEIGHTS_V5=Object.freeze({globalDemand:20,trend:15,romaniaGap:25,importability:10,supplier:10,economics:15,evidence:5});
export const OPPORTUNITY_PRETEST_GATES_V5=Object.freeze(['trend','romaniaGap','importability','supplier','economics']);

function sameProduct(id,envelope){const x=text(envelope?.canonicalProductId).toLowerCase();return Boolean(id&&x&&id===x);}
function scoreOf(envelope,...keys){for(const k of keys){const n=Number(envelope?.[k]);if(Number.isFinite(n))return clamp(n);}return null;}
function confidenceOf(envelope){const n=Number(envelope?.confidence);return Number.isFinite(n)?clamp(n):null;}
function gateStatus(envelope){return text(envelope?.gateStatus||envelope?.status).toUpperCase()||'UNKNOWN';}

function globalDemandComponent(envelope={}){
  const score=scoreOf(envelope,'score','demandScore','globalDemandScore');
  const confidence=confidenceOf(envelope);
  return {name:'globalDemand',score,confidence,status:gateStatus(envelope),evidenceClass:text(envelope.evidenceClass).toUpperCase()||'UNKNOWN'};
}
function evidenceComponent(envelopes=[]){
  const conf=envelopes.map(confidenceOf).filter(Number.isFinite);
  if(!conf.length)return {name:'evidence',score:null,confidence:null,status:'UNKNOWN',evidenceClass:'DERIVED'};
  const avg=conf.reduce((a,b)=>a+b,0)/conf.length;
  return {name:'evidence',score:Number(avg.toFixed(2)),confidence:Number(avg.toFixed(2)),status:'DERIVED',evidenceClass:'DERIVED'};
}

export function analyzeOpportunityV5({canonicalProductId=null,globalDemand={},trend={},romaniaGap={},importability={},supplier={},economics={}}={}){
  const id=text(canonicalProductId).toLowerCase()||null;
  const raw={globalDemand,trend,romaniaGap,importability,supplier,economics};
  const identityMismatches=[];
  for(const [name,e] of Object.entries(raw)){
    if(e&&Object.keys(e).length&&!sameProduct(id,e))identityMismatches.push(name);
  }
  const components={
    globalDemand:globalDemandComponent(globalDemand),
    trend:{name:'trend',score:scoreOf(trend,'trendScore','score'),confidence:confidenceOf(trend),status:gateStatus(trend),evidenceClass:text(trend.evidenceClass).toUpperCase()||'DERIVED'},
    romaniaGap:{name:'romaniaGap',score:scoreOf(romaniaGap,'gapScore','score'),confidence:confidenceOf(romaniaGap),status:gateStatus(romaniaGap),evidenceClass:text(romaniaGap.evidenceClass).toUpperCase()||'DERIVED'},
    importability:{name:'importability',score:gateStatus(importability)==='PASS'?100:gateStatus(importability)==='REVIEW'?50:gateStatus(importability)==='BLOCKED'?0:null,confidence:confidenceOf(importability),status:gateStatus(importability),evidenceClass:text(importability.evidenceClass).toUpperCase()||'DERIVED'},
    supplier:{name:'supplier',score:scoreOf(supplier,'confidence','score'),confidence:confidenceOf(supplier),status:gateStatus(supplier),evidenceClass:text(supplier.evidenceClass).toUpperCase()||'DERIVED'},
    economics:{name:'economics',score:scoreOf(economics,'confidence','score'),confidence:confidenceOf(economics),status:gateStatus(economics),evidenceClass:text(economics.evidenceClass).toUpperCase()||'DERIVED'}
  };
  components.evidence=evidenceComponent(Object.values(raw));

  const weighted=[],missingComponents=[];
  for(const [name,weight] of Object.entries(OPPORTUNITY_WEIGHTS_V5)){
    const c=components[name];
    if(!c||!Number.isFinite(c.score)){missingComponents.push(name);continue;}
    weighted.push({name,weight,score:c.score,weightedPoints:c.score*weight/100});
  }
  const knownWeight=weighted.reduce((s,x)=>s+x.weight,0);
  const score=knownWeight===100?Number(weighted.reduce((s,x)=>s+x.weightedPoints,0).toFixed(2)):null;
  const componentConfidences=Object.values(components).map(x=>x?.confidence).filter(Number.isFinite);
  const confidence=componentConfidences.length?Number((componentConfidences.reduce((a,b)=>a+b,0)/componentConfidences.length).toFixed(2)):0;

  const blockers=[];
  if(!id)blockers.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(identityMismatches.length)blockers.push('CROSS_PRODUCT_EVIDENCE_REJECTED');
  if(missingComponents.length)blockers.push('OPPORTUNITY_COMPONENTS_INCOMPLETE');
  const statuses=Object.fromEntries(OPPORTUNITY_PRETEST_GATES_V5.map(k=>[k,components[k]?.status||'UNKNOWN']));
  if(statuses.importability==='BLOCKED')blockers.push('IMPORTABILITY_BLOCKED');
  for(const k of OPPORTUNITY_PRETEST_GATES_V5){if(!['PASS'].includes(statuses[k]))blockers.push(`${k.toUpperCase()}_NOT_PASS`);}

  const allPretestPass=id&&identityMismatches.length===0&&missingComponents.length===0&&OPPORTUNITY_PRETEST_GATES_V5.every(k=>statuses[k]==='PASS');
  let recommendation='DISCOVERED';
  if(id&&score!==null)recommendation='PROMISING';
  if(id&&(missingComponents.length||identityMismatches.length||!allPretestPass))recommendation='VALIDATE';
  if(allPretestPass&&confidence>=60&&score!==null&&score>=60)recommendation='FINALIST';
  if(components.importability.status==='BLOCKED')recommendation='VALIDATE';
  if(id&&confidence<50&&recommendation!=='DISCOVERED')recommendation='VALIDATE';

  return Object.freeze({
    schemaVersion:'MPR_OPPORTUNITY_V5',canonicalProductId:id,opportunityScore:score,confidence,recommendation,
    components:Object.freeze(components),weightedComponents:Object.freeze(weighted),knownWeight,missingComponents:Object.freeze(missingComponents),identityMismatches:Object.freeze(identityMismatches),pretestGateStatuses:Object.freeze(statuses),blockers:Object.freeze([...new Set(blockers)]),
    finalistEligible:recommendation==='FINALIST',testReadyEligible:false,buyReadyEligible:false,legacyRecommendationAuthoritative:false,verifiedSales:null,salesEvidenceClass:'NOT_INFERRED_BY_OPPORTUNITY_ENGINE',
    purchaseAuthorized:false,automaticPurchaseAllowed:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'OPPORTUNITY_SCORE_AND_CONFIDENCE_SEPARATE; LOW_CONFIDENCE_REMAINS_VALIDATE; MISSING_COMPONENTS_NEVER_DEFAULT_TO_ZERO_OR_PASS; ALL_PRETEST_GATES_MUST_PASS_FOR_FINALIST; HARD_BLOCKERS_OVERRIDE_SCORE; CROSS_PRODUCT_EVIDENCE_REJECTED; TEST_READY_AND_BUY_READY_REQUIRE_REAL_TEST_EVIDENCE_AND_CANONICAL_DECISION_AUTHORITY; LEGACY_BUY_NEVER_OVERRIDES_CANONICAL_BLOCKERS'
  });
}

export function opportunityWeightAuditV5(){
  const total=Object.values(OPPORTUNITY_WEIGHTS_V5).reduce((a,b)=>a+b,0);
  return Object.freeze({weights:OPPORTUNITY_WEIGHTS_V5,total,valid:total===100});
}
