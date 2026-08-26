const text=v=>String(v??'').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const normCategory=v=>text(v).replace(/\s+/g,' ').toLowerCase();

function direction(delta){return delta>0?'IMPROVING':delta<0?'WORSENING':'FLAT';}

export function buildLeaderBsrHistory({baseline={},current={},minimumIntervalHours=24}={}){
  const minHours=Math.max(24,Number(minimumIntervalHours)||24);
  const baselineObservedAt=iso(baseline.observedAt);
  const currentObservedAt=iso(current.generatedAt)||iso(current.observedAt);
  const baselineRows=Array.isArray(baseline.observations)?baseline.observations:[];
  const currentRows=Array.isArray(current.observations)?current.observations:[];
  if(baseline.schemaVersion!=='MPR_AMAZON_LEADER_BSR_BASELINE_V1'||!baselineObservedAt){
    return{ok:false,status:'BLOCKED',error:'BASELINE_INVALID',rows:[],categoryRows:[],blocked:[],paidCallsTriggered:0,purchaseAuthorized:false};
  }
  if(current.schemaVersion!=='MPR_AMAZON_LEADER_BSR_SNAPSHOT_V1'||!currentObservedAt){
    return{ok:false,status:'BLOCKED',error:'CURRENT_SNAPSHOT_INVALID',rows:[],categoryRows:[],blocked:[],paidCallsTriggered:0,purchaseAuthorized:false};
  }
  if(current.policy?.providerSpendEur!==0||current.policy?.paidCallsTriggered!==0||current.policy?.purchaseAuthorized!==false){
    return{ok:false,status:'BLOCKED',error:'CURRENT_SNAPSHOT_POLICY_INVALID',rows:[],categoryRows:[],blocked:[],paidCallsTriggered:0,purchaseAuthorized:false};
  }

  const elapsedHours=(Date.parse(currentObservedAt)-Date.parse(baselineObservedAt))/36e5;
  if(!Number.isFinite(elapsedHours)||elapsedHours<minHours){
    return{ok:false,status:'TOO_EARLY',error:'MINIMUM_24H_INTERVAL_NOT_MET',elapsedHours:Number.isFinite(elapsedHours)?Number(elapsedHours.toFixed(4)):null,minimumIntervalHours:minHours,rows:[],categoryRows:[],blocked:[],paidCallsTriggered:0,purchaseAuthorized:false};
  }

  const previous=new Map();
  for(const o of baselineRows){
    const asin=text(o.asin||o.externalId).toUpperCase();
    for(const e of Array.isArray(o.bsrEntries)?o.bsrEntries:[]){
      const rank=num(e.rank),category=text(e.category);
      if(!asin||rank===null||rank<1||!category)continue;
      previous.set(`${asin}|${normCategory(category)}`,{asin,category,rank});
    }
  }

  const categoryRows=[];const blocked=[];
  for(const o of currentRows){
    const asin=text(o.asin||o.externalId).toUpperCase();
    for(const e of Array.isArray(o.bsrEntries)?o.bsrEntries:[]){
      const latestRank=num(e.rank),category=text(e.category);
      if(!asin||latestRank===null||latestRank<1||!category)continue;
      const p=previous.get(`${asin}|${normCategory(category)}`);
      if(!p){blocked.push({externalId:asin,category,error:'SAME_CATEGORY_BASELINE_MISSING'});continue;}
      const rankDelta=p.rank-latestRank;
      const rankVelocityPerDay=rankDelta/(elapsedHours/24);
      categoryRows.push({
        platform:'AMAZON',externalId:asin,category,
        previousRank:p.rank,latestRank,rankDelta,
        rankVelocityPerDay:Number(rankVelocityPerDay.toFixed(6)),
        direction:direction(rankDelta),previousObservedAt:baselineObservedAt,latestObservedAt:currentObservedAt,
        elapsedHours:Number(elapsedHours.toFixed(4)),intervalEligible:true,
        evidenceClass:'LONGITUDINAL_EXPLICIT_PRODUCT_BSR_CATEGORY',
        salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
      });
    }
  }

  const grouped=new Map();
  for(const r of categoryRows){if(!grouped.has(r.externalId))grouped.set(r.externalId,[]);grouped.get(r.externalId).push(r);}
  const rows=[];
  for(const [externalId,items] of grouped){
    const signs=new Set(items.map(x=>Math.sign(x.rankDelta)));
    const conflict=signs.has(1)&&signs.has(-1);
    const aggregateVelocity=conflict?null:Number((items.reduce((s,x)=>s+x.rankVelocityPerDay,0)/items.length).toFixed(6));
    rows.push({
      platform:'AMAZON',externalId,
      previousObservedAt:baselineObservedAt,latestObservedAt:currentObservedAt,
      elapsedHours:Number(elapsedHours.toFixed(4)),intervalEligible:true,
      comparableCategoryCount:items.length,categories:items.map(x=>({category:x.category,previousRank:x.previousRank,latestRank:x.latestRank,rankDelta:x.rankDelta,rankVelocityPerDay:x.rankVelocityPerDay,direction:x.direction})),
      categorySignalsConflict:conflict,
      rankVelocityPerDay:aggregateVelocity,
      latestRank:items.length===1?items[0].latestRank:null,
      trendEvidenceClass:conflict?'LONGITUDINAL_PUBLIC_RANKING_CONFLICT':'LONGITUDINAL_PUBLIC_RANKING',
      evidenceClass:'LONGITUDINAL_EXPLICIT_PRODUCT_BSR',
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    });
  }
  rows.sort((a,b)=>a.externalId.localeCompare(b.externalId));
  categoryRows.sort((a,b)=>a.externalId.localeCompare(b.externalId)||a.category.localeCompare(b.category));
  return{
    ok:true,status:rows.length?'RANK_HISTORY_READY':'NO_COMPARABLE_CATEGORY_RANKS',
    elapsedHours:Number(elapsedHours.toFixed(4)),minimumIntervalHours:minHours,
    eligibleProductCount:rows.filter(x=>x.trendEvidenceClass==='LONGITUDINAL_PUBLIC_RANKING'&&x.rankVelocityPerDay!==null).length,
    conflictProductCount:rows.filter(x=>x.categorySignalsConflict).length,
    comparableCategoryCount:categoryRows.length,rows,categoryRows,blocked,blockedCount:blocked.length,
    policy:'SAME_ASIN_AND_SAME_CATEGORY_ONLY; MINIMUM_24H; ALL_CATEGORY_RANKS_PRESERVED; MIXED_CATEGORY_DIRECTION_FAILS_CLOSED; RANKING_IS_NOT_VERIFIED_SALES',
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,paidCallsTriggered:0,purchaseAuthorized:false
  };
}
