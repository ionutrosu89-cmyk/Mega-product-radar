import {normalizeRankingObservation,sourceIdentity,crossPlatformMatchHint} from './public-rankings-acquisition.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const lower=v=>text(v).toLowerCase();

function platformKey(record={}){
  const id=sourceIdentity(record);
  if(id)return id;
  return `${text(record.platform).toUpperCase()}:TITLE:${lower(record.title)}`;
}

function newest(a,b){
  const ta=Date.parse(a?.observedAt||'')||0,tb=Date.parse(b?.observedAt||'')||0;
  return tb>=ta?b:a;
}

export function seedGlobalProductUniverse(rawObservations=[]){
  const normalized=[];const rejected=[];
  for(const raw of rawObservations||[]){
    const r=normalizeRankingObservation(raw);
    if(!r.ok){rejected.push({input:raw,error:r.error});continue;}
    normalized.push(r.record);
  }

  const samePlatform=new Map();
  for(const r of normalized){
    const key=platformKey(r);
    const current=samePlatform.get(key);
    samePlatform.set(key,current?newest(current,r):r);
  }
  const unique=[...samePlatform.values()];

  const crossPlatformReview=[];
  for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
    if(unique[i].platform===unique[j].platform)continue;
    const hint=crossPlatformMatchHint(unique[i],unique[j]);
    if(hint.candidate)crossPlatformReview.push({left:platformKey(unique[i]),right:platformKey(unique[j]),...hint});
  }

  const byPlatform={};
  for(const r of unique)byPlatform[r.platform]=(byPlatform[r.platform]||0)+1;
  const bySurface={};
  for(const r of unique){const k=`${r.platform}:${r.surface}`;bySurface[k]=(bySurface[k]||0)+1;}

  return {
    rawCount:(rawObservations||[]).length,
    acceptedObservationCount:normalized.length,
    rejectedCount:rejected.length,
    uniqueProductObservationCount:unique.length,
    duplicateObservationCount:Math.max(0,normalized.length-unique.length),
    products:unique,
    rejected,
    crossPlatformReview,
    stats:{byPlatform,bySurface},
    policy:'SOURCE_ID_DEDUPE_ONLY_CROSS_PLATFORM_REQUIRES_REVIEW',
    salesPolicy:'PUBLIC_RANKINGS_ARE_NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  };
}

export function buildUniverseMilestoneStatus(seedResult={},milestones=[1000,5000,10000,50000,100000]){
  const count=Number(seedResult?.uniqueProductObservationCount)||0;
  const rows=(milestones||[]).map(Number).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b).map(target=>({target,reached:count>=target,remaining:Math.max(0,target-count)}));
  return {current:count,milestones:rows,next:rows.find(x=>!x.reached)||null};
}

export function planSourceMix({amazon=0,ebay=0,alibaba=0,target=10000}={}){
  const counts={AMAZON:Math.max(0,Number(amazon)||0),EBAY:Math.max(0,Number(ebay)||0),ALIBABA:Math.max(0,Number(alibaba)||0)};
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const goal=Math.max(1,Number(target)||10000);
  const maxShare=total?Math.max(...Object.values(counts))/total:0;
  return {
    counts,total,target:goal,remaining:Math.max(0,goal-total),
    concentrationPct:Number((maxShare*100).toFixed(1)),
    diversificationStatus:total===0?'EMPTY':maxShare<=0.7?'HEALTHY':'TOO_CONCENTRATED',
    recommendation:total===0?'START_WITH_MULTIPLE_SOURCES':maxShare>0.7?'ADD_MORE_NON_DOMINANT_PLATFORM_DATA':'CONTINUE_BREADTH_FIRST',
    purchaseAuthorized:false
  };
}
