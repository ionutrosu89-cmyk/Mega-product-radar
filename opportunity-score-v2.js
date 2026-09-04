const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function scoreOpportunity(input={},options={}){
  const blockers=[];
  const econ=input.economics?.scenarios?.conservative;
  const match=finite(input.matchConfidence)?Number(input.matchConfidence):null;
  if(match===null||match<80)blockers.push('MATCH_BELOW_80');
  if(input.criticalImportBlocker===true)blockers.push('CRITICAL_IMPORT_BLOCKER');
  if(!econ)blockers.push('CONSERVATIVE_ECONOMICS_REQUIRED');
  const roi=econ&&finite(econ.roi)?Number(econ.roi):null;
  const margin=econ&&finite(econ.netMargin)?Number(econ.netMargin):null;
  const profit=econ&&finite(econ.profitPerUnitRon)?Number(econ.profitPerUnitRon):null;
  const profitFloor=finite(options.profitFloorRon)?Number(options.profitFloorRon):10;
  if(roi===null||roi<0.8)blockers.push('ROI_BELOW_80_PCT');
  if(margin===null||margin<0.25)blockers.push('MARGIN_BELOW_25_PCT');
  if(profit===null||profit<profitFloor)blockers.push('PROFIT_BELOW_FLOOR');

  const economicsScore=econ?clamp((roi||0)*35+(margin||0)*80+Math.min(30,Math.max(0,profit||0))):0;
  const demandScore=finite(input.demand?.demandScore)?Number(input.demand.demandScore):0;
  const competitionScore=finite(input.competition?.competitionOpportunityScore)?Number(input.competition.competitionOpportunityScore):0;
  const matchScore=match===null?0:clamp(match);
  const logisticsScore=finite(input.logisticsScore)?Number(input.logisticsScore):50;
  const supplierQualityScore=finite(input.supplierListingQualityScore)?Number(input.supplierListingQualityScore):50;
  const components={economics:round(economicsScore),demand:round(demandScore),competition:round(competitionScore),match:round(matchScore),logistics:round(logisticsScore),supplierListingQuality:round(supplierQualityScore)};
  const weighted={economics:components.economics*.4,demand:components.demand*.25,competition:components.competition*.15,match:components.match*.1,logistics:components.logistics*.05,supplierListingQuality:components.supplierListingQuality*.05};
  const opportunityScore=round(Object.values(weighted).reduce((a,b)=>a+b,0));
  const confidenceInputs=[input.demand?.confidenceScore,input.competition?.confidenceScore,input.matchEvidenceCoverage!==undefined?Number(input.matchEvidenceCoverage)*100:null,input.logisticsConfidence,input.supplierPriceConfidenceScore].filter(finite).map(Number);
  const confidenceScore=confidenceInputs.length?round(confidenceInputs.reduce((a,b)=>a+b,0)/confidenceInputs.length):0;
  const eligible=blockers.length===0;
  const highPriority=eligible&&roi>=1.5&&margin>=0.35&&demandScore>=50&&match>=90;
  return {schemaVersion:'MPR_OPPORTUNITY_SCORE_V2',eligible,opportunityScore,confidenceScore,band:highPriority?'HIGH_PRIORITY':eligible?'SHORTLIST_ELIGIBLE':'BLOCKED',components,weightedContributions:Object.fromEntries(Object.entries(weighted).map(([k,v])=>[k,round(v)])),blockers:[...new Set(blockers)],thresholds:{roi:0.8,netMargin:0.25,profitFloorRon:profitFloor,highPriorityRoi:1.5,highPriorityMargin:0.35,highPriorityMatch:90},truthPolicy:{lowConfidenceMayMasqueradeAsHighQuality:false,negotiationIncluded:false,purchaseAuthorized:false}};
}

export function buildHumanReviewQueue(rows=[],options={}){
  const scored=(Array.isArray(rows)?rows:[]).map((row,index)=>({...row,_index:index,score:scoreOpportunity(row,options)}));
  return scored.filter(x=>x.score.eligible).sort((a,b)=>b.score.opportunityScore-a.score.opportunityScore||b.score.confidenceScore-a.score.confidenceScore||a._index-b._index).slice(0,100);
}
