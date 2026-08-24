const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const iso=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString():null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function resolveNow(history=[],now){
  const explicit=iso(now);
  if(explicit)return explicit;
  const times=(history||[]).map(x=>Date.parse(x?.observedAt)).filter(Number.isFinite);
  return times.length?new Date(Math.max(...times)).toISOString():null;
}

function daysBetween(a,b){
  const x=Date.parse(a),y=Date.parse(b);
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return Math.max(0,(y-x)/86400000);
}

export function detectNewEntrant(history=[],identity,{now,lookbackDays=7,topThreshold=100}={}){
  const rows=(history||[]).filter(x=>x?.identity===identity&&n(x?.sourceRank)!==null).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  if(!rows.length)return{identity,eligible:false,status:'NO_RANKING_HISTORY',newEntrant:false,purchaseAuthorized:false};
  const asOf=resolveNow(history,now);
  if(!asOf)return{identity,eligible:false,status:'AS_OF_REQUIRED',newEntrant:false,purchaseAuthorized:false};
  const first=rows[0],latest=rows.at(-1);
  const firstSeenAt=iso(first.observedAt),lastSeenAt=iso(latest.observedAt);
  const ageDays=daysBetween(firstSeenAt,asOf);
  const firstRank=n(first.sourceRank),latestRank=n(latest.sourceRank);
  const rankDelta=firstRank!==null&&latestRank!==null?firstRank-latestRank:null;
  const inLookback=ageDays!==null&&ageDays<=lookbackDays;
  const currentlyInTop=latestRank!==null&&latestRank<=topThreshold;
  const newEntrant=inLookback&&currentlyInTop;
  const observationDepth=rows.length;
  const depthScore=clamp(observationDepth>=5?100:observationDepth/5*100);
  const freshnessScore=ageDays===null?0:clamp((1-ageDays/Math.max(1,lookbackDays))*100);
  const rankScore=latestRank===null?0:clamp((1-(latestRank-1)/Math.max(1,topThreshold))*100);
  const score=newEntrant?Number((freshnessScore*0.45+rankScore*0.35+depthScore*0.20).toFixed(1)):null;
  const confidence=Number(clamp(depthScore*0.7+(rows.length>=2?30:0)).toFixed(1));
  return{
    identity,eligible:true,status:newEntrant?'NEW_ENTRANT':'NOT_NEW_ENTRANT',newEntrant,
    firstSeenAt,lastSeenAt,ageDays:Number((ageDays??0).toFixed(2)),firstRank,latestRank,rankDelta,observationCount:observationDepth,
    score,confidence,accelerating:newEntrant&&rankDelta!==null&&rankDelta>0,
    evidenceClass:'MPR_FIRST_OBSERVED_IN_RANKING',newProductClaim:false,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
}

export function buildNewEntrantsFeed(history=[],options={}){
  const identities=[...new Set((history||[]).map(x=>x?.identity).filter(Boolean))];
  const rows=identities.map(identity=>detectNewEntrant(history,identity,options)).filter(x=>x.eligible&&x.newEntrant);
  rows.sort((a,b)=>Number(b.accelerating)-Number(a.accelerating)||(b.score??-Infinity)-(a.score??-Infinity)||(a.latestRank??Infinity)-(b.latestRank??Infinity));
  return{
    trackedProducts:identities.length,newEntrants:rows.length,acceleratingEntrants:rows.filter(x=>x.accelerating).length,rows,
    semantics:'FIRST_OBSERVED_BY_MPR_IN_RANKING_NOT_PROOF_OF_PRODUCT_LAUNCH',paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false
  };
}
