import {productHistoryMetrics} from './public-collection-history.js';

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function scoreRankVelocity(v){const x=n(v);if(x===null)return 0;return clamp(x<=0?0:x>=5?100:x/5*100);}
function scoreReviewVelocity(v){const x=n(v);if(x===null)return 0;return clamp(x<=0?0:x>=20?100:x/20*100);}
function scorePersistence(v){const x=n(v);return x===null?0:clamp(x);}
function scoreObservationDepth(count){const x=n(count)||0;return clamp(x>=8?100:x/8*100);}

export function earlyTrendSignal(metrics={}){
  if((metrics.observationCount||0)<2)return{eligible:false,signal:'INSUFFICIENT_HISTORY',score:null,confidence:0,purchaseAuthorized:false};
  const rankScore=scoreRankVelocity(metrics.rankVelocityPerDay);
  const reviewScore=scoreReviewVelocity(metrics.reviewVelocityPerDay);
  const persistenceScore=scorePersistence(metrics.top100PersistencePct);
  const depthScore=scoreObservationDepth(metrics.observationCount);
  const score=Number((rankScore*0.45+reviewScore*0.25+persistenceScore*0.15+depthScore*0.15).toFixed(1));
  const days=n(metrics.daysObserved)||0;
  const isNew=days<=14;
  const risingFast=(n(metrics.rankVelocityPerDay)||0)>=1;
  const strongPersistence=(n(metrics.top100PersistencePct)||0)>=75;
  let signal='WATCH';
  if(isNew&&risingFast&&score>=65)signal='NEW_AND_ACCELERATING';
  else if(risingFast&&score>=70)signal='RISING_FAST';
  else if(strongPersistence&&(n(metrics.top10PersistencePct)||0)>=50)signal='PERSISTENT_BESTSELLER';
  else if((n(metrics.rankVelocityPerDay)||0)<0)signal='COOLING';
  const confidence=Number(clamp(depthScore*0.6+Math.min(100,days/30*100)*0.4).toFixed(1));
  return{eligible:true,signal,score,confidence,components:{rankVelocity:rankScore,reviewVelocity:reviewScore,persistence:persistenceScore,observationDepth:depthScore},salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false};
}

export function buildEarlyTrendRadar(history=[]){
  const identities=[...new Set((history||[]).map(x=>x.identity).filter(Boolean))];
  const rows=[];
  for(const identity of identities){
    const metrics=productHistoryMetrics(history,identity);
    const trend=earlyTrendSignal(metrics);
    if(!trend.eligible)continue;
    rows.push({identity,...metrics,trendScore:trend.score,trendConfidence:trend.confidence,signal:trend.signal,components:trend.components});
  }
  const priority={NEW_AND_ACCELERATING:0,RISING_FAST:1,PERSISTENT_BESTSELLER:2,WATCH:3,COOLING:4};
  rows.sort((a,b)=>(priority[a.signal]??9)-(priority[b.signal]??9)||b.trendScore-a.trendScore||b.trendConfidence-a.trendConfidence);
  return{
    totalTracked:identities.length,
    eligible:rows.length,
    newAndAccelerating:rows.filter(x=>x.signal==='NEW_AND_ACCELERATING').length,
    risingFast:rows.filter(x=>x.signal==='RISING_FAST').length,
    persistentBestsellers:rows.filter(x=>x.signal==='PERSISTENT_BESTSELLER').length,
    rows,
    policy:'EARLY_TREND_INTELLIGENCE_NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}
