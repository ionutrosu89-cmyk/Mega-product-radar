const round=(v,d=2)=>Number(Number(v).toFixed(d));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

const ACTIONABLE_FEATURES=new Map([
  ['category','DIRECT_CATEGORY_OR_CANONICAL_TAXONOMY'],
  ['productType','DIRECT_PRODUCT_TYPE'],
  ['primaryFunction','DIRECT_PRIMARY_FUNCTION'],
  ['packCount','DIRECT_PACK_COUNT'],
  ['material','DIRECT_MATERIAL'],
  ['dimensions','DIRECT_SUPPLIER_DIMENSIONS'],
  ['unitWeightGrams','DIRECT_SUPPLIER_UNIT_WEIGHT'],
  ['formFactor','DIRECT_FORM_FACTOR'],
  ['technicalSpecs','DISTINCTIVE_TECHNICAL_SPECS']
]);

function coveragePenalty(coverage){
  return coverage>=0.85?1:coverage>=0.7?0.95:coverage>=0.55?0.85:coverage>=0.4?0.7:0.5;
}

function confidence(rawPoints,observedWeight){
  const coverage=clamp(observedWeight/100,0,1);
  return round(clamp(rawPoints*coveragePenalty(coverage),0,100),2);
}

function powerset(items){
  const out=[];
  for(let mask=1;mask<(1<<items.length);mask++){
    const subset=[];
    for(let i=0;i<items.length;i++)if(mask&(1<<i))subset.push(items[i]);
    out.push(subset);
  }
  return out;
}

export function analyzeEnrichmentReachability(row,{screeningThreshold=80}={}){
  const match=row?.match??{};
  const hardMismatches=Array.isArray(match.hardMismatches)?match.hardMismatches:[];
  const evidence=Array.isArray(match.evidence)?match.evidence:[];
  const rawPoints=round(evidence.reduce((s,e)=>s+Number(e.points??0),0),2);
  const observedWeight=Number(match.observedFeatureWeight??evidence.filter(e=>e.status!=='UNKNOWN').reduce((s,e)=>s+Number(e.weight??0),0));
  const currentConfidence=Number(match.matchConfidence??confidence(rawPoints,observedWeight));

  const enrichable=evidence.flatMap(e=>{
    if(!ACTIONABLE_FEATURES.has(e.feature))return [];
    if(!['UNKNOWN','PARTIAL'].includes(e.status))return [];
    const weight=Number(e.weight??0),points=Number(e.points??0);
    const recoverable=round(Math.max(0,weight-points),2);
    if(recoverable<=0)return [];
    return [{
      feature:e.feature,
      currentStatus:e.status,
      currentPoints:round(points,2),
      weight,
      maxRecoverablePoints:recoverable,
      requiredEvidence:ACTIONABLE_FEATURES.get(e.feature),
      addsObservedWeight:e.status==='UNKNOWN'?weight:0
    }];
  });

  const optimisticRaw=round(rawPoints+enrichable.reduce((s,x)=>s+x.maxRecoverablePoints,0),2);
  const optimisticObserved=Math.min(100,observedWeight+enrichable.reduce((s,x)=>s+x.addsObservedWeight,0));
  const optimisticConfidence=hardMismatches.length?0:confidence(optimisticRaw,optimisticObserved);
  const reachable=hardMismatches.length===0&&currentConfidence<screeningThreshold&&optimisticConfidence>=screeningThreshold;

  let minimumEvidenceSet=[];
  if(reachable&&enrichable.length){
    const sets=powerset(enrichable).map(set=>{
      const raw=rawPoints+set.reduce((s,x)=>s+x.maxRecoverablePoints,0);
      const observed=observedWeight+set.reduce((s,x)=>s+x.addsObservedWeight,0);
      return {set,confidence:confidence(raw,observed),recoverable:set.reduce((s,x)=>s+x.maxRecoverablePoints,0)};
    }).filter(x=>x.confidence>=screeningThreshold);
    sets.sort((a,b)=>a.set.length-b.set.length||a.recoverable-b.recoverable||b.confidence-a.confidence);
    minimumEvidenceSet=sets[0]?.set??[];
  }

  const technical=evidence.find(e=>e.feature==='technicalSpecs');
  const distinctiveSpecRisk=technical?.status==='PARTIAL'||technical?.status==='UNKNOWN';
  const titleEvidence=evidence.find(e=>e.feature==='semanticTitle');
  const semanticTitleSimilarity=Number(titleEvidence?.similarity??match.semanticTitleSimilarity??0);

  return {
    amazonAsin:row?.amazonAsin??null,
    supplierListingKey:row?.supplierListingKey??null,
    marketplaceTitle:row?.marketplaceTitle??null,
    supplierTitle:row?.supplierTitle??null,
    currentMatchConfidence:currentConfidence,
    currentMatchClass:match.matchClass??null,
    hardMismatches,
    rawPoints,
    observedFeatureWeight:observedWeight,
    optimisticMatchConfidence:optimisticConfidence,
    reachableUnderOptimisticEvidence:reachable,
    minimumEvidenceSet:minimumEvidenceSet.map(x=>({feature:x.feature,requiredEvidence:x.requiredEvidence,maxRecoverablePoints:x.maxRecoverablePoints})),
    allActionableGaps:enrichable,
    distinctiveSpecRisk,
    semanticTitleSimilarity:round(semanticTitleSimilarity,4),
    truthPolicy:{optimisticConfidenceIsNotObservedMatch:true,minimumEvidenceSetDoesNotAssumeEvidenceWillMatch:true,hardMismatchIsNotEnrichable:true,unknownEqualsZero:false,screeningThreshold}
  };
}

export function buildReachableEnrichmentQueue(rows=[],options={}){
  const screeningThreshold=Number(options.screeningThreshold??80);
  const analyses=(Array.isArray(rows)?rows:[]).map(r=>analyzeEnrichmentReachability(r,{screeningThreshold}));
  const discardedHardMismatch=analyses.filter(x=>x.hardMismatches.length>0);
  const alreadyEligible=analyses.filter((x,i)=>x.hardMismatches.length===0&&Number(rows[i]?.match?.matchConfidence??0)>=screeningThreshold);
  const queue=analyses.filter(x=>x.reachableUnderOptimisticEvidence);
  queue.sort((a,b)=>
    Number(a.distinctiveSpecRisk)-Number(b.distinctiveSpecRisk)||
    a.minimumEvidenceSet.length-b.minimumEvidenceSet.length||
    b.semanticTitleSimilarity-a.semanticTitleSimilarity||
    b.currentMatchConfidence-a.currentMatchConfidence
  );
  return {
    schemaVersion:'MPR_REACHABLE_ENRICHMENT_QUEUE_V1',
    generatedAt:new Date().toISOString(),
    screeningThreshold,
    inputPairCount:analyses.length,
    discardedHardMismatchCount:discardedHardMismatch.length,
    alreadyEligibleCount:alreadyEligible.length,
    reachableCandidateCount:queue.length,
    queue:queue.map((x,i)=>({...x,priority:i+1})),
    truthPolicy:{optimisticCeilingIsNotMatchEvidence:true,queueEntryIsNotScreeningEligible:true,hardMismatchesExcluded:true,unknownEqualsZero:false,matchingThresholdRelaxed:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false}
  };
}
