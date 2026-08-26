const upper=v=>String(v??'').trim().toUpperCase();
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null;
const ts=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null;};
const median=values=>{const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!xs.length)return null;const m=Math.floor(xs.length/2);return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;};

export const CLOSED_BETA_TARGETS=Object.freeze({
  participantMin:10,
  participantMax:15,
  activationRatePct:70,
  firstUsefulOpportunityMinutes:10,
  wauRatePct:50,
  usefulOpportunityRatePct:70,
  falsePositiveRatePct:20,
  romaniaGapUsefulRatePct:70,
  willingnessToPay29RatePct:30,
  week4RetentionRatePct:40
});

function metric({key,label,value,target,comparison,samples=0,eligible=true}){
  let status='UNKNOWN';
  if(eligible&&value!==null&&Number.isFinite(Number(value))){
    const n=Number(value);
    status=comparison==='LT'?(n<target?'PASS':'FAIL'):(comparison==='LTE'?(n<=target?'PASS':'FAIL'):(n>target?'PASS':'FAIL'));
  }
  return Object.freeze({key,label,value,target,comparison,samples,status});
}

function eventMeta(event){return event?.metadata&&typeof event.metadata==='object'?event.metadata:{};}
function linkedParticipants(participants=[]){return participants.filter(p=>p?.workspace_id&&['ACTIVATED','COMPLETED'].includes(upper(p.status)));}

export function buildClosedBetaScorecardV1({participants=[],events=[],feedback=[],now=new Date().toISOString()}={}){
  const nowMs=ts(now)??Date.now();
  const cohort=participants.filter(p=>['INVITED','ACTIVATED','COMPLETED','PAUSED'].includes(upper(p.status)));
  const activated=cohort.filter(p=>['ACTIVATED','COMPLETED'].includes(upper(p.status)));
  const linked=linkedParticipants(cohort);
  const linkedWorkspaceIds=new Set(linked.map(p=>p.workspace_id));

  const activationRate=pct(activated.length,cohort.length);
  const cohortSize=cohort.length;

  const usefulEvents=events.filter(e=>upper(e?.event_name)==='BETA_OPPORTUNITY_RATED'&&eventMeta(e).useful===true&&e?.workspace_id);
  const firstUsefulMinutes=[];
  for(const p of linked){
    const start=ts(p.activated_at);
    if(start===null)continue;
    const first=usefulEvents.filter(e=>e.workspace_id===p.workspace_id&&ts(e.created_at)!==null&&ts(e.created_at)>=start).sort((a,b)=>ts(a.created_at)-ts(b.created_at))[0];
    if(first)firstUsefulMinutes.push((ts(first.created_at)-start)/60000);
  }

  const sevenDaysAgo=nowMs-7*86400000;
  const linkedActive7d=new Set(events.filter(e=>linkedWorkspaceIds.has(e?.workspace_id)&&ts(e.created_at)!==null&&ts(e.created_at)>=sevenDaysAgo&&ts(e.created_at)<=nowMs).map(e=>e.workspace_id));
  const wauRate=pct(linkedActive7d.size,linked.length);

  const ratedEvents=events.filter(e=>upper(e?.event_name)==='BETA_OPPORTUNITY_RATED'&&typeof eventMeta(e).useful==='boolean');
  const usefulRate=pct(ratedEvents.filter(e=>eventMeta(e).useful===true).length,ratedEvents.length);
  const falsePositiveRate=pct(ratedEvents.filter(e=>eventMeta(e).falsePositive===true).length,ratedEvents.length);

  const romaniaFeedback=feedback.filter(f=>upper(f?.area)==='ROMANIA_GAP'&&finite(f?.rating)!==null);
  const romaniaGapUsefulRate=pct(romaniaFeedback.filter(f=>finite(f.rating)>=4).length,romaniaFeedback.length);

  const pay29Feedback=feedback.filter(f=>typeof f?.metadata?.wouldPay29==='boolean');
  const willingnessToPay29Rate=pct(pay29Feedback.filter(f=>f.metadata.wouldPay29===true).length,pay29Feedback.length);

  const eligibleWeek4=linked.filter(p=>{const start=ts(p.activated_at);return start!==null&&nowMs-start>=28*86400000;});
  let retainedWeek4=0;
  for(const p of eligibleWeek4){
    const start=ts(p.activated_at);const from=start+21*86400000;const to=start+28*86400000;
    if(events.some(e=>e.workspace_id===p.workspace_id&&ts(e.created_at)!==null&&ts(e.created_at)>=from&&ts(e.created_at)<=to))retainedWeek4++;
  }
  const week4RetentionRate=pct(retainedWeek4,eligibleWeek4.length);

  const metrics=Object.freeze({
    cohortSize:metric({key:'cohortSize',label:'Beta cohort size',value:cohortSize,target:CLOSED_BETA_TARGETS.participantMin,comparison:'GT',samples:cohortSize,eligible:cohortSize>0}),
    activationRate:metric({key:'activationRate',label:'Activation rate',value:activationRate,target:CLOSED_BETA_TARGETS.activationRatePct,comparison:'GT',samples:cohortSize,eligible:cohortSize>0}),
    firstUsefulOpportunityMinutes:metric({key:'firstUsefulOpportunityMinutes',label:'Median time to first useful opportunity',value:median(firstUsefulMinutes),target:CLOSED_BETA_TARGETS.firstUsefulOpportunityMinutes,comparison:'LT',samples:firstUsefulMinutes.length,eligible:firstUsefulMinutes.length>0}),
    wauRate:metric({key:'wauRate',label:'Weekly active beta participants',value:wauRate,target:CLOSED_BETA_TARGETS.wauRatePct,comparison:'GT',samples:linked.length,eligible:linked.length>0}),
    usefulOpportunityRate:metric({key:'usefulOpportunityRate',label:'Useful opportunity rating',value:usefulRate,target:CLOSED_BETA_TARGETS.usefulOpportunityRatePct,comparison:'GT',samples:ratedEvents.length,eligible:ratedEvents.length>0}),
    falsePositiveRate:metric({key:'falsePositiveRate',label:'False-positive rate',value:falsePositiveRate,target:CLOSED_BETA_TARGETS.falsePositiveRatePct,comparison:'LT',samples:ratedEvents.length,eligible:ratedEvents.length>0}),
    romaniaGapUsefulRate:metric({key:'romaniaGapUsefulRate',label:'Romania Gap usefulness',value:romaniaGapUsefulRate,target:CLOSED_BETA_TARGETS.romaniaGapUsefulRatePct,comparison:'GT',samples:romaniaFeedback.length,eligible:romaniaFeedback.length>0}),
    willingnessToPay29Rate:metric({key:'willingnessToPay29Rate',label:'Willingness to pay €29',value:willingnessToPay29Rate,target:CLOSED_BETA_TARGETS.willingnessToPay29RatePct,comparison:'GT',samples:pay29Feedback.length,eligible:pay29Feedback.length>0}),
    week4RetentionRate:metric({key:'week4RetentionRate',label:'Week-4 retention',value:week4RetentionRate,target:CLOSED_BETA_TARGETS.week4RetentionRatePct,comparison:'GT',samples:eligibleWeek4.length,eligible:eligibleWeek4.length>0})
  });

  const required=Object.values(metrics).filter(m=>m.key!=='cohortSize');
  const unknown=required.filter(m=>m.status==='UNKNOWN').map(m=>m.key);
  const failed=required.filter(m=>m.status==='FAIL').map(m=>m.key);
  const cohortReady=cohortSize>=CLOSED_BETA_TARGETS.participantMin&&cohortSize<=CLOSED_BETA_TARGETS.participantMax;
  const status=!cohortReady?'BUILD_COHORT':unknown.length?'MEASURING':failed.length?'CALIBRATE':'BETA_TARGETS_MET';

  return Object.freeze({schemaVersion:'MPR_CLOSED_BETA_SCORECARD_V1',status,cohortReady,participantCount:cohortSize,linkedParticipantCount:linked.length,metrics,unknown:Object.freeze(unknown),failed:Object.freeze(failed),automaticLaunchAllowed:false,purchaseAuthorized:false,generatedAt:new Date(nowMs).toISOString()});
}
