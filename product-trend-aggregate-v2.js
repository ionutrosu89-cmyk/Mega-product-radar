const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const text=v=>String(v??'').trim();

const POSITIVE=new Set(['EARLY_SIGNAL','EMERGING_TREND','PERSISTENT_TREND']);
const NEGATIVE=new Set(['EARLY_DECLINE','DECLINING']);
const REVIEW_ONLY=new Set(['SPIKE_OR_REVERSAL','MIXED_OR_STABLE','EARLY_MIXED','INSUFFICIENT_HISTORY','NO_VALID_OBSERVATIONS']);

function weightedMean(rows,key){
  const usable=rows.filter(x=>Number.isFinite(Number(x[key]))&&Number(x.confidence)>0);
  if(!usable.length)return null;
  const weight=usable.reduce((s,x)=>s+Number(x.confidence),0);
  if(weight<=0)return null;
  return Number((usable.reduce((s,x)=>s+Number(x[key])*Number(x.confidence),0)/weight).toFixed(2));
}

function surfaceConsensus(rows=[]){
  const decisive=rows.filter(x=>POSITIVE.has(x.status)||NEGATIVE.has(x.status));
  if(!decisive.length)return {agreement:null,positive:0,negative:0,conflicted:false};
  const positive=decisive.filter(x=>POSITIVE.has(x.status)).length;
  const negative=decisive.filter(x=>NEGATIVE.has(x.status)).length;
  const majority=Math.max(positive,negative);
  const agreement=Number(((majority/decisive.length)*100).toFixed(2));
  return {agreement,positive,negative,conflicted:positive>0&&negative>0};
}

function aggregateStatus(rows,score,consensus){
  if(!rows.length)return 'NO_VALID_OBSERVATIONS';
  if(consensus.conflicted)return 'MIXED_OR_CONFLICTED';
  if(rows.some(x=>x.status==='SPIKE_OR_REVERSAL')&&!rows.some(x=>x.status==='PERSISTENT_TREND'))return 'SPIKE_OR_REVERSAL';
  if(rows.some(x=>x.status==='PERSISTENT_TREND')&&consensus.negative===0)return 'PERSISTENT_TREND';
  if(rows.some(x=>x.status==='EMERGING_TREND')&&consensus.negative===0)return 'EMERGING_TREND';
  if(rows.every(x=>['INSUFFICIENT_HISTORY','NO_VALID_OBSERVATIONS'].includes(x.status)))return 'INSUFFICIENT_HISTORY';
  if((score??50)<=40&&consensus.positive===0)return 'DECLINING';
  if((score??50)>=60&&consensus.negative===0)return 'EARLY_SIGNAL';
  return 'MIXED_OR_STABLE';
}

export function aggregateProductTrend(analyses=[],canonicalProductId=null){
  const id=text(canonicalProductId||analyses.find(x=>x?.canonicalProductId)?.canonicalProductId).toLowerCase()||null;
  const rows=(analyses||[]).filter(x=>x&&text(x.canonicalProductId).toLowerCase()===id&&x.decisionEligible!==false);
  if(!id||!rows.length)return Object.freeze({schemaVersion:'MPR_PRODUCT_TREND_AGGREGATE_V2',canonicalProductId:id,status:'INSUFFICIENT_HISTORY',trendScore:null,confidence:0,surfaceCount:0,decisionEligible:false,reasons:Object.freeze(['CANONICAL_BOUND_SURFACE_ANALYSIS_REQUIRED']),salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,autoPromoteOpportunityStage:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});

  const trendScore=weightedMean(rows,'trendScore');
  const baseConfidence=weightedMean(rows,'confidence')??0;
  const consensus=surfaceConsensus(rows);
  const unknownOrReview=rows.filter(x=>REVIEW_ONLY.has(x.status)).length;
  const conflictPenalty=consensus.conflicted?25:0;
  const reviewPenalty=Math.min(15,unknownOrReview*5);
  const corroborationBonus=consensus.agreement===100&&rows.length>=2?Math.min(10,rows.length*2):0;
  const confidence=clamp(baseConfidence-conflictPenalty-reviewPenalty+corroborationBonus);
  const status=aggregateStatus(rows,trendScore,consensus);

  return Object.freeze({
    schemaVersion:'MPR_PRODUCT_TREND_AGGREGATE_V2',canonicalProductId:id,status,trendScore,confidence,surfaceCount:rows.length,decisionEligible:true,
    surfaceConsensusPct:consensus.agreement,positiveSurfaceCount:consensus.positive,negativeSurfaceCount:consensus.negative,conflicted:consensus.conflicted,
    surfaces:Object.freeze(rows.map(x=>Object.freeze({seriesKey:x.seriesKey,surface:x.surface||null,status:x.status,trendScore:x.trendScore,confidence:x.confidence}))),
    reasons:Object.freeze(consensus.conflicted?['CONFLICTING_CANONICAL_SURFACES_REQUIRE_REVIEW']:status==='PERSISTENT_TREND'?['MULTI_SURFACE_CANONICAL_TREND_SUPPORT']:['PRODUCT_TREND_IS_DERIVED_FROM_CANONICAL_SURFACES']),
    evidenceClass:'DERIVED',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,autoPromoteOpportunityStage:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false,
    policy:'CANONICAL_PRODUCT_ID_ONLY; SURFACES_ARE_CORROBORATION_NOT INDEPENDENT SALES; CONFLICT_LOWERS_CONFIDENCE; NO_CROSS_MARKET_INFERENCE; NO_VERIFIED_SALES_INFERENCE'
  });
}

export function aggregateTrendReportByProduct(report={}){
  const rows=Array.isArray(report.analyses)?report.analyses:[];
  const ids=[...new Set(rows.map(x=>text(x.canonicalProductId).toLowerCase()).filter(Boolean))];
  const products=ids.map(id=>aggregateProductTrend(rows,id)).sort((a,b)=>(b.trendScore??-1)-(a.trendScore??-1)||b.confidence-a.confidence||a.canonicalProductId.localeCompare(b.canonicalProductId));
  const unboundSeries=rows.filter(x=>!x.canonicalProductId||x.decisionEligible===false).length;
  return Object.freeze({schemaVersion:'MPR_PRODUCT_TREND_AGGREGATE_V2_REPORT',productCount:products.length,unboundSeries,products:Object.freeze(products),policy:'ONE_PRODUCT_AGGREGATE_PER_CANONICAL_PRODUCT_ID; UNBOUND_SERIES_NEVER_ENTER_DECISION_AGGREGATE',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});
}
