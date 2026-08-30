const PLAN_RANK={FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3};

function paidEntitlement(plan,status){
  const normalizedPlan=String(plan||'FREE').toUpperCase();
  const normalizedStatus=String(status||'unknown').toLowerCase();
  return ['active','trialing'].includes(normalizedStatus)&&PLAN_RANK[normalizedPlan]>0;
}

export function stripeEventOrderDecision({
  storedCreated=0,
  storedEventId=null,
  storedPlan='FREE',
  storedStatus='FOUNDATION',
  incomingCreated,
  incomingEventId,
  incomingPlan='FREE',
  incomingStatus='unknown'
}={}){
  const previousCreated=Number(storedCreated||0);
  const nextCreated=Number(incomingCreated);
  if(!Number.isFinite(nextCreated)||nextCreated<=0)return {apply:false,reason:'INVALID_EVENT_TIME'};
  if(previousCreated>nextCreated)return {apply:false,reason:'STALE'};
  if(previousCreated<nextCreated||!storedEventId||String(storedEventId)===String(incomingEventId||''))return {apply:true,reason:'NEWER'};

  // Stripe event timestamps are second-granularity. When two distinct lifecycle
  // events share the same timestamp, fail closed: an ambiguous event may retain
  // or reduce entitlement, but it may never restore or increase paid access.
  const currentPaid=paidEntitlement(storedPlan,storedStatus);
  const incomingPaid=paidEntitlement(incomingPlan,incomingStatus);
  if(incomingPaid&&!currentPaid)return {apply:false,reason:'AMBIGUOUS_WOULD_GRANT'};
  const currentRank=PLAN_RANK[String(storedPlan||'FREE').toUpperCase()]??0;
  const incomingRank=PLAN_RANK[String(incomingPlan||'FREE').toUpperCase()]??0;
  if(incomingPaid&&currentPaid&&incomingRank>currentRank)return {apply:false,reason:'AMBIGUOUS_WOULD_UPGRADE'};
  return {apply:true,reason:'AMBIGUOUS_FAIL_CLOSED'};
}

export {paidEntitlement};
