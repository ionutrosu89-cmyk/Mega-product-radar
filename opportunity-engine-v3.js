const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function supplierScore(s={}){
  const q=num(s.quoteCount),confidence=num(s.benchmarkConfidence),coverage=num(s.documentationCoveragePct);
  if(q===null&&confidence===null&&coverage===null)return null;
  const qScore=q===null?0:clamp(q>=5?100:q/5*100);
  const cScore=confidence===null?0:clamp(confidence);
  const dScore=coverage===null?0:clamp(coverage);
  const present=[q===null?null:qScore,confidence===null?null:cScore,coverage===null?null:dScore].filter(x=>x!==null);
  return Number((present.reduce((a,b)=>a+b,0)/present.length).toFixed(1));
}

function economicsScore(e={}){
  const margin=num(e.marginPct),roi=num(e.roiPct),profit=num(e.profitPerUnit);
  if(margin===null&&roi===null&&profit===null)return null;
  const marginScore=margin===null?null:clamp(margin<=0?0:margin>=30?100:margin/30*100);
  const roiScore=roi===null?null:clamp(roi<=0?0:roi>=100?100:roi);
  const profitScore=profit===null?null:clamp(profit<=0?0:profit>=25?100:profit/25*100);
  const present=[marginScore,roiScore,profitScore].filter(x=>x!==null);
  return Number((present.reduce((a,b)=>a+b,0)/present.length).toFixed(1));
}

export function calculateOpportunityV3({trend={},romaniaGap={},supplier={},economics={}}={}){
  const trendScore=num(trend.score);
  const trendConfidence=num(trend.confidence);
  const gapScore=romaniaGap.status==='READY'?num(romaniaGap.score):null;
  const supplierIntelligence=supplierScore(supplier);
  const economicsIntelligence=economicsScore(economics);

  const blockers=[];
  if(trendScore===null)blockers.push('TREND_MISSING');
  if(trendConfidence===null||trendConfidence<40)blockers.push('TREND_CONFIDENCE_LOW');
  if(gapScore===null)blockers.push('ROMANIA_GAP_INCOMPLETE');

  if(blockers.length){
    return {
      status:'INCOMPLETE',marketOpportunityScore:null,commercialMaturityScore:null,tier:'UNKNOWN',blockers,
      components:{trend:trendScore,romaniaGap:gapScore,supplier:supplierIntelligence,economics:economicsIntelligence},
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    };
  }

  const marketRaw=trendScore*0.45+gapScore*0.55;
  const confidenceFactor=0.75+0.25*clamp(trendConfidence)/100;
  const marketOpportunityScore=Number(clamp(marketRaw*confidenceFactor).toFixed(1));

  const commercialParts=[supplierIntelligence,economicsIntelligence].filter(x=>x!==null);
  const commercialMaturityScore=commercialParts.length?Number((commercialParts.reduce((a,b)=>a+b,0)/commercialParts.length).toFixed(1)):null;

  let tier=marketOpportunityScore>=80?'BREAKOUT_CANDIDATE':marketOpportunityScore>=65?'HIGH_OPPORTUNITY':marketOpportunityScore>=50?'WATCH_PRIORITY':'LOW_PRIORITY';
  let commercialStatus='MARKET_ONLY';
  if(supplierIntelligence!==null&&economicsIntelligence!==null)commercialStatus='COMMERCIAL_CONTEXT_READY';
  else if(supplierIntelligence!==null||economicsIntelligence!==null)commercialStatus='COMMERCIAL_CONTEXT_PARTIAL';

  return {
    status:'READY',marketOpportunityScore,commercialMaturityScore,tier,commercialStatus,blockers:[],
    components:{trend:trendScore,romaniaGap:gapScore,supplier:supplierIntelligence,economics:economicsIntelligence},
    policy:'OPPORTUNITY_V3_PRIORITIZES_RESEARCH_IT_DOES_NOT_AUTHORIZE_PURCHASE',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
}

export function buildOpportunityRadarV3(rows=[]){
  const out=(rows||[]).map(row=>({
    productKey:row.productKey||row.identity||null,
    title:row.title||row.name||null,
    ...calculateOpportunityV3(row)
  }));
  out.sort((a,b)=>{
    if(a.status!==b.status)return a.status==='READY'?-1:1;
    const am=a.marketOpportunityScore??-1,bm=b.marketOpportunityScore??-1;
    if(bm!==am)return bm-am;
    return (b.commercialMaturityScore??-1)-(a.commercialMaturityScore??-1);
  });
  return {
    total:out.length,
    ready:out.filter(x=>x.status==='READY').length,
    breakout:out.filter(x=>x.tier==='BREAKOUT_CANDIDATE').length,
    highOpportunity:out.filter(x=>x.tier==='HIGH_OPPORTUNITY').length,
    rows:out,
    policy:'RADAR_INTELLIGENCE_ONLY',paidCallsTriggered:0,purchaseAuthorized:false
  };
}
