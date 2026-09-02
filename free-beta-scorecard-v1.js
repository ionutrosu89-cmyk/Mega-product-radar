const upper=value=>String(value??'').trim().toUpperCase();
const pct=(part,total)=>total>0?Math.round(part/total*1000)/10:null;
const timestamp=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:null;};

export const FREE_BETA_TARGETS=Object.freeze({
  invitedUsers:25,
  activatedUsers:15,
  onboardingUsers:10,
  top25SearchUsers:8,
  productDecisionUsers:5,
  feedbackUsers:5,
  willingnessToPayUsers:3,
  willingnessToPayRatePct:20,
  decisionChangingUsers:3,
  criticalIncidents:0
});

const countMetric=(key,label,value,target)=>Object.freeze({key,label,value,target,comparison:'GTE',samples:value,status:value>=target?'PASS':'FAIL'});
const eventName=(event,name)=>upper(event?.event_name)===name;
const eventMeta=event=>event?.metadata&&typeof event.metadata==='object'?event.metadata:{};
const feedbackMeta=row=>row?.metadata&&typeof row.metadata==='object'?row.metadata:{};

function linkedCohort(participants=[]){
  return participants.filter(row=>row?.user_id&&row?.workspace_id&&['ACTIVATED','COMPLETED'].includes(upper(row.status)));
}

function eligibleEvidence(participants,events,feedback){
  const starts=new Map(linkedCohort(participants).map(row=>[row.workspace_id,timestamp(row.activated_at)]));
  const eligibleEvent=event=>{
    if(!starts.has(event?.workspace_id))return false;
    const at=timestamp(event?.created_at),start=starts.get(event.workspace_id);
    return at!==null&&(start===null||at>=start);
  };
  const eligibleFeedback=row=>{
    if(!starts.has(row?.workspace_id))return false;
    const at=timestamp(row?.created_at),start=starts.get(row.workspace_id);
    return at===null||start===null||at>=start;
  };
  return {events:events.filter(eligibleEvent),feedback:feedback.filter(eligibleFeedback)};
}

const workspacesWith=(rows,predicate)=>new Set(rows.filter(predicate).map(row=>row.workspace_id).filter(Boolean));

function wtpMetric(feedback,activatedCount){
  const answered=workspacesWith(feedback,row=>typeof row?.would_pay==='boolean'||typeof feedbackMeta(row).wouldPay29==='boolean');
  const yes=workspacesWith(feedback,row=>row?.would_pay===true||feedbackMeta(row).wouldPay29===true);
  const rate=pct(yes.size,activatedCount);
  const eligible=answered.size>0&&activatedCount>0;
  const passed=eligible&&(yes.size>=FREE_BETA_TARGETS.willingnessToPayUsers||rate>=FREE_BETA_TARGETS.willingnessToPayRatePct);
  return Object.freeze({key:'willingnessToPay',label:'Intenție de plată',value:yes.size,ratePct:rate,target:{users:FREE_BETA_TARGETS.willingnessToPayUsers,ratePct:FREE_BETA_TARGETS.willingnessToPayRatePct},comparison:'COUNT_OR_RATE',samples:answered.size,status:eligible?(passed?'PASS':'FAIL'):'UNKNOWN'});
}

function participantProgress(participant,evidence){
  const workspaceId=participant?.workspace_id||null;
  const linked=Boolean(participant?.user_id&&workspaceId&&['ACTIVATED','COMPLETED'].includes(upper(participant?.status)));
  const events=linked?evidence.events.filter(row=>row.workspace_id===workspaceId):[];
  const feedback=linked?evidence.feedback.filter(row=>row.workspace_id===workspaceId):[];
  const onboarding=events.some(row=>eventName(row,'ONBOARDING_COMPLETED'));
  const top25=events.some(row=>eventName(row,'TOP25_SEARCHED'));
  const productOpened=events.some(row=>eventName(row,'PRODUCT_OPENED')||eventName(row,'OPPORTUNITY_DETAIL_VIEW'));
  const decision=events.some(row=>eventName(row,'DECISION_REACHED')||eventName(row,'BETA_OPPORTUNITY_RATED'));
  const feedbackSubmitted=feedback.length>0;
  const wtpAnswered=feedback.some(row=>typeof row?.would_pay==='boolean'||typeof feedbackMeta(row).wouldPay29==='boolean');
  const decisionValueAnswered=feedback.some(row=>typeof feedbackMeta(row).decisionChanged==='boolean');
  const nextAction=!linked?'LINK_IDENTITY':!onboarding?'COMPLETE_ONBOARDING':!top25?'RUN_TOP25_SEARCH':!productOpened?'OPEN_PRODUCT':!decision?'REACH_PRODUCT_DECISION':!feedbackSubmitted?'SUBMIT_FEEDBACK':!wtpAnswered?'ANSWER_WTP':!decisionValueAnswered?'CONFIRM_DECISION_VALUE':'MONITOR';
  return Object.freeze({participantId:participant?.id||null,workspaceId,linked,status:upper(participant?.status)||'UNKNOWN',onboarding,top25,productOpened,decision,feedbackSubmitted,wtpAnswered,decisionValueAnswered,nextAction});
}

export function buildFreeBetaScorecardV1({participants=[],events=[],feedback=[],now=new Date().toISOString()}={}){
  const cohort=participants.filter(row=>['INVITED','ACTIVATED','COMPLETED','PAUSED'].includes(upper(row?.status)));
  const linked=linkedCohort(cohort);
  const evidence=eligibleEvidence(cohort,events,feedback);
  const onboarding=workspacesWith(evidence.events,row=>eventName(row,'ONBOARDING_COMPLETED'));
  const top25=workspacesWith(evidence.events,row=>eventName(row,'TOP25_SEARCHED'));
  const productOpened=workspacesWith(evidence.events,row=>eventName(row,'PRODUCT_OPENED')||eventName(row,'OPPORTUNITY_DETAIL_VIEW'));
  const decisions=workspacesWith(evidence.events,row=>eventName(row,'DECISION_REACHED')||eventName(row,'BETA_OPPORTUNITY_RATED'));
  const feedbackUsers=workspacesWith(evidence.feedback,()=>true);
  const decisionChanging=workspacesWith(evidence.feedback,row=>feedbackMeta(row).decisionChanged===true);
  const criticalIncidents=evidence.events.filter(row=>eventName(row,'CRITICAL_INCIDENT_RECORDED')).length;
  const metrics=Object.freeze({
    invitedUsers:countMetric('invitedUsers','Utilizatori invitați',cohort.length,FREE_BETA_TARGETS.invitedUsers),
    activatedUsers:countMetric('activatedUsers','Conturi activate',linked.length,FREE_BETA_TARGETS.activatedUsers),
    onboardingUsers:countMetric('onboardingUsers','Onboarding finalizat',onboarding.size,FREE_BETA_TARGETS.onboardingUsers),
    top25SearchUsers:countMetric('top25SearchUsers','Căutări Top 25 pe nișă reală',top25.size,FREE_BETA_TARGETS.top25SearchUsers),
    productDecisionUsers:countMetric('productDecisionUsers','Produse analizate până la decizie',decisions.size,FREE_BETA_TARGETS.productDecisionUsers),
    feedbackUsers:countMetric('feedbackUsers','Feedback complet',feedbackUsers.size,FREE_BETA_TARGETS.feedbackUsers),
    willingnessToPay:wtpMetric(evidence.feedback,linked.length),
    decisionChangingUsers:countMetric('decisionChangingUsers','Valoare decisivă confirmată',decisionChanging.size,FREE_BETA_TARGETS.decisionChangingUsers),
    criticalIncidents:Object.freeze({key:'criticalIncidents',label:'Incidente critice',value:criticalIncidents,target:0,comparison:'EQ',samples:criticalIncidents,status:criticalIncidents===0?'PASS':'FAIL'})
  });
  const progress=Object.freeze(cohort.map(row=>participantProgress(row,evidence)));
  const failed=Object.values(metrics).filter(metric=>metric.status==='FAIL').map(metric=>metric.key);
  const unknown=Object.values(metrics).filter(metric=>metric.status==='UNKNOWN').map(metric=>metric.key);
  let status='MEASURING';
  if(metrics.invitedUsers.status!=='PASS')status='BUILD_COHORT';
  else if(metrics.activatedUsers.status!=='PASS')status='ACTIVATE_COHORT';
  else if(unknown.length)status='MEASURING';
  else if(failed.length)status='ITERATE_FREE';
  else status='FREE_BETA_TARGETS_MET';
  return Object.freeze({schemaVersion:'MPR_FREE_BETA_SCORECARD_V1',status,investmentDecision:status==='FREE_BETA_TARGETS_MET'?'ELIGIBLE_FOR_HUMAN_INVESTMENT_REVIEW':status,participantCount:cohort.length,linkedParticipantCount:linked.length,metrics,diagnostics:Object.freeze({linked:linked.length,unlinked:Math.max(0,cohort.length-linked.length),onboarding:onboarding.size,top25:top25.size,productOpened:productOpened.size,decisions:decisions.size,feedback:feedbackUsers.size,decisionChanging:decisionChanging.size}),participantProgress:progress,unknown:Object.freeze(unknown),failed:Object.freeze(failed),automaticLaunchAllowed:false,purchaseAuthorized:false,generatedAt:new Date(timestamp(now)??Date.now()).toISOString()});
}
