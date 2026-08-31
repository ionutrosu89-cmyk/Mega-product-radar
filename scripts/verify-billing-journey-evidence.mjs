import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const REQUIRED_STAGES=['FREE_BASELINE','DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
const PAID_STAGE_PLAN={DISCOVER_ACTIVE:'DISCOVER',RADAR_ACTIVE:'RADAR',LAUNCH_ACTIVE:'LAUNCH',CANCEL_SCHEDULED:'LAUNCH'};
const ACTIVE_STATUSES=new Set(['active','trialing']);
const ENDED_STATUSES=new Set(['canceled','unpaid','incomplete_expired','deleted']);

function text(value){return String(value??'').trim();}
function timestamp(value){const ms=Date.parse(text(value));return Number.isFinite(ms)?ms:null;}
function finiteNumber(value){const number=Number(value);return Number.isFinite(number)?number:null;}

export function verifyBillingJourneyProgress(input={},options={}){
  const requireComplete=options.requireComplete===true;
  const errors=[];
  if(text(input.schema)!=='MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1')errors.push('INVALID_SCHEMA');
  if(text(input.environment).toUpperCase()!=='SANDBOX')errors.push('NOT_SANDBOX_EVIDENCE');
  const workspaceId=text(input.workspaceId);
  if(!workspaceId)errors.push('WORKSPACE_ID_REQUIRED');

  const checkout=input.checkout||{};
  if(text(checkout.mode).toUpperCase()!=='SUBSCRIPTION')errors.push('CHECKOUT_MODE_NOT_SUBSCRIPTION');
  if(text(checkout.currency).toUpperCase()!=='EUR')errors.push('CHECKOUT_CURRENCY_NOT_EUR');
  if(checkout.realMoney!==false)errors.push(checkout.realMoney===true?'REAL_MONEY_EVIDENCE_REJECTED':'CHECKOUT_REAL_MONEY_FLAG_REQUIRED');

  const checkpoints=Array.isArray(input.checkpoints)?input.checkpoints:[];
  if(checkpoints.length>REQUIRED_STAGES.length)errors.push('TOO_MANY_CHECKPOINTS');
  if(requireComplete&&checkpoints.length!==REQUIRED_STAGES.length){
    for(let index=checkpoints.length;index<REQUIRED_STAGES.length;index++)errors.push(`MISSING_STAGE:${REQUIRED_STAGES[index]}`);
  }

  let previousTime=null;
  let subscriptionId=null;
  const lifecycleEventIds=new Set();
  for(let index=0;index<Math.min(checkpoints.length,REQUIRED_STAGES.length);index++){
    const row=checkpoints[index]||{};
    const expectedStage=REQUIRED_STAGES[index];
    const stage=text(row.stage).toUpperCase();
    if(stage!==expectedStage){errors.push(`STAGE_ORDER_MISMATCH:${expectedStage}`);continue;}

    const observedAt=timestamp(row.observedAt);
    if(observedAt===null)errors.push(`INVALID_OBSERVED_AT:${stage}`);
    else if(previousTime!==null&&observedAt<previousTime)errors.push(`OUT_OF_ORDER:${stage}`);
    if(observedAt!==null)previousTime=observedAt;
    if(workspaceId&&text(row.workspaceId)!==workspaceId)errors.push(`WORKSPACE_MISMATCH:${stage}`);

    const plan=text(row.workspacePlan).toUpperCase()||'FREE';
    const status=text(row.subscriptionStatus).toLowerCase();
    const providerId=text(row.providerSubscriptionId);
    const activeCount=finiteNumber(row.activeSubscriptionCount);
    const eventId=text(row.lastStripeEventId);

    if(stage==='FREE_BASELINE'){
      if(plan!=='FREE')errors.push('FREE_BASELINE_NOT_FREE');
      if(activeCount===null)errors.push('FREE_BASELINE_ACTIVE_COUNT_REQUIRED');
      else if(activeCount!==0)errors.push('FREE_BASELINE_ACTIVE_SUBSCRIPTION');
      if(row.cancelAtPeriodEnd!==false)errors.push('FREE_BASELINE_CANCEL_FLAG_INVALID');
      if(status&&status!=='none'&&!ENDED_STATUSES.has(status))errors.push('FREE_BASELINE_STATUS_NOT_INACTIVE');
      continue;
    }

    if(stage==='ENDED_FREE'){
      if(plan!=='FREE')errors.push('ENDED_NOT_FREE');
      if(!ENDED_STATUSES.has(status))errors.push('ENDED_STATUS_NOT_TERMINAL');
      if(activeCount===null)errors.push('ENDED_ACTIVE_COUNT_REQUIRED');
      else if(activeCount!==0)errors.push('ENDED_ACTIVE_SUBSCRIPTION_REMAINS');
      if(row.cancelAtPeriodEnd!==false)errors.push('ENDED_CANCEL_FLAG_INVALID');
      if(!subscriptionId)errors.push('ENDED_WITHOUT_PAID_SUBSCRIPTION');
      if(!providerId)errors.push('ENDED_SUBSCRIPTION_ID_REQUIRED');
      else if(subscriptionId&&providerId!==subscriptionId)errors.push('ENDED_SUBSCRIPTION_ID_CHANGED');
      if(!eventId)errors.push('ENDED_WEBHOOK_EVENT_REQUIRED');
      else if(lifecycleEventIds.has(eventId))errors.push('ENDED_WEBHOOK_EVENT_REUSED');
      else lifecycleEventIds.add(eventId);
      continue;
    }

    const expectedPlan=PAID_STAGE_PLAN[stage];
    if(plan!==expectedPlan)errors.push(`PLAN_MISMATCH:${stage}`);
    if(!ACTIVE_STATUSES.has(status))errors.push(`PAID_STATUS_NOT_ACTIVE:${stage}`);
    if(!providerId)errors.push(`SUBSCRIPTION_ID_REQUIRED:${stage}`);
    else if(!subscriptionId)subscriptionId=providerId;
    else if(providerId!==subscriptionId)errors.push(`SUBSCRIPTION_ID_CHANGED:${stage}`);
    if(activeCount===null||activeCount!==1)errors.push(`ACTIVE_SUBSCRIPTION_COUNT_NOT_ONE:${stage}`);
    if(!eventId)errors.push(`WEBHOOK_EVENT_REQUIRED:${stage}`);
    else if(lifecycleEventIds.has(eventId))errors.push(`WEBHOOK_EVENT_REUSED:${stage}`);
    else lifecycleEventIds.add(eventId);
    if(stage==='CANCEL_SCHEDULED'&&row.cancelAtPeriodEnd!==true)errors.push('CANCEL_NOT_SCHEDULED');
    if(stage!=='CANCEL_SCHEDULED'&&row.cancelAtPeriodEnd!==false)errors.push(`UNEXPECTED_CANCEL_FLAG:${stage}`);
  }

  return {
    ok:errors.length===0,
    verdict:errors.length===0?(requireComplete?'GO':'VALID'):'NO-GO',
    schema:requireComplete?'MPR_BILLING_JOURNEY_EVIDENCE_VERDICT_V1':'MPR_BILLING_JOURNEY_PROGRESS_VERDICT_V1',
    checkpointCount:checkpoints.length,
    nextStage:checkpoints.length<REQUIRED_STAGES.length?REQUIRED_STAGES[checkpoints.length]:null,
    checks:{
      stageOrderValid:!errors.some(error=>error.startsWith('STAGE_ORDER_MISMATCH')),
      oneSubscriptionAcrossPaidJourney:Boolean(subscriptionId)&&!errors.some(error=>error.includes('SUBSCRIPTION_ID_CHANGED')),
      webhookEvidenceUnique:!errors.some(error=>error.includes('WEBHOOK_EVENT_REUSED')),
      sandboxOnly:!errors.includes('NOT_SANDBOX_EVIDENCE')&&!errors.includes('REAL_MONEY_EVIDENCE_REJECTED'),
      complete:checkpoints.length===REQUIRED_STAGES.length
    },
    errors
  };
}

export function verifyBillingJourneyEvidence(input={}){
  return verifyBillingJourneyProgress(input,{requireComplete:true});
}

async function main(){
  const path=process.argv[2]||process.env.MPR_BILLING_JOURNEY_EVIDENCE;
  if(!path)throw new Error('Evidence JSON path is required');
  const input=JSON.parse(await readFile(path,'utf8'));
  const result=verifyBillingJourneyEvidence(input);
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error(JSON.stringify({ok:false,verdict:'NO-GO',error:String(error?.message||error)},null,2));process.exitCode=1;});
}

export {REQUIRED_STAGES};
