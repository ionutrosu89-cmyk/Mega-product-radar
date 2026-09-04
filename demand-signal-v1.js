const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const clean=v=>String(v??'').trim();
const ageDays=(when,now)=>{const t=new Date(when).getTime(),n=new Date(now).getTime();return Number.isFinite(t)&&Number.isFinite(n)?Math.max(0,(n-t)/86400000):null;};

export function scoreDemandSignal(input={},options={}){
  const now=options.now||new Date().toISOString();
  const obs=Array.isArray(input.observations)?input.observations:[];
  if(!obs.length)return {schemaVersion:'MPR_DEMAND_SIGNAL_V1',demandClass:'INSUFFICIENT_DEMAND_EVIDENCE',demandScore:0,confidenceScore:0,blockers:['NO_DEMAND_OBSERVATIONS'],components:{},verifiedSales:false};
  const latest=[...obs].sort((a,b)=>String(b.observedAt||'').localeCompare(String(a.observedAt||'')))[0];
  const rank=finite(latest.rank)?Number(latest.rank):null;
  const reviews=finite(latest.reviewCount)?Number(latest.reviewCount):null;
  const visibility=finite(latest.visibilityScore)?Number(latest.visibilityScore):null;
  const markets=new Set(obs.map(x=>clean(x.marketplace)).filter(Boolean));
  const timestamps=obs.map(x=>new Date(x.observedAt).getTime()).filter(Number.isFinite).sort();
  const persistenceDays=timestamps.length>=2?(timestamps.at(-1)-timestamps[0])/86400000:0;
  const rankScore=rank===null?0:rank<=100?100:rank<=1000?85:rank<=10000?65:rank<=50000?40:20;
  const reviewScore=reviews===null?0:reviews>=1000?100:reviews>=300?80:reviews>=100?65:reviews>=30?45:reviews>=5?25:10;
  const visibilityScore=visibility===null?0:clamp(visibility);
  const persistenceScore=clamp(persistenceDays/30*100);
  const crossMarketScore=clamp(markets.size/3*100);
  const available=[rank!==null,reviews!==null,visibility!==null,timestamps.length>=2,markets.size>0].filter(Boolean).length;
  const score=round(rankScore*.3+reviewScore*.2+visibilityScore*.2+persistenceScore*.15+crossMarketScore*.15);
  const freshness=ageDays(latest.observedAt,now);
  const freshnessScore=freshness===null?0:freshness<=7?100:freshness<=14?75:freshness<=30?50:20;
  const confidence=round(clamp((available/5)*70+freshnessScore*.3));
  const demandClass=score>=75?'STRONG_DEMAND_SIGNAL':score>=50?'MODERATE_DEMAND_SIGNAL':score>=25?'WEAK_DEMAND_SIGNAL':'INSUFFICIENT_DEMAND_EVIDENCE';
  return {schemaVersion:'MPR_DEMAND_SIGNAL_V1',demandClass,demandScore:score,confidenceScore:confidence,components:{rankScore,reviewScore,visibilityScore,persistenceScore:round(persistenceScore),crossMarketScore:round(crossMarketScore),freshnessScore},observationCount:obs.length,marketplaceCount:markets.size,persistenceDays:round(persistenceDays),latestObservedAt:latest.observedAt||null,verifiedSales:false,truthPolicy:{rankIsVerifiedSales:false,reviewCountIsVerifiedSales:false,visibilityIsVerifiedSales:false,unknownEqualsZero:false}};
}
