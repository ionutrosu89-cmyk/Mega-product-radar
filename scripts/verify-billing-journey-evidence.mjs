import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const REQUIRED_STAGES=['FREE_BASELINE','DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
const PAID_STAGE_PLAN={DISCOVER_ACTIVE:'DISCOVER',RADAR_ACTIVE:'RADAR',LAUNCH_ACTIVE:'LAUNCH',CANCEL_SCHEDULED:'LAUNCH'};
const ACTIVE_STATUSES=new Set(['active','trialing']);
const ENDED_STATUSES=new Set(['canceled','unpaid','incomplete_expired','deleted']);

function text(value){return String(value??'').trim();}
function timestamp(value){const ms=Date.parse(text(value));return Number.isFinite(ms)?ms:null;}

export function verifyBillingJourneyEvidence(input={}){
  const errors=[];
  if(text(input.schema)!=='MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1')errors.push('INVALID_SCHEMA');
  if(text(input.environment).toUpperCase()!=='SANDBOX')errors.push('NOT_SANDBOX_EVIDENCE');
  const workspaceId=text(input.workspaceId);
  if(!workspaceId)errors.push('WORKSPACE_ID_REQUIRED');
  const checkpoints=Array.isArray(input.checkpoints)?input.checkpoints:[];
  const byStage=new Map();
  for(const row of checkpoints){
    const stage=text(row?.stage).toUpperCase();
    if(!stage)continue;
    if(byStage.has(stage))errors.push(`DUPLICATE_STAGE:${stage}`);
    else byStage.set(stage,row);
  }
  for(const stage of REQUIRED_STAGES)if(!byStage.has(stage))errors.push(`MISSING_STAGE:${stage}`);

  let previousTime=null;
  let subscriptionId=null;
  const lifecycleEventIds=new Set();
  for(const stage of REQUIRED_STAGES){
    const row=byStage.get(stage);
    if(!row)continue;
    const observedAt=timestamp(row.observedAt);
    if(observedAt===null)errors.push(`INVALID_OBSERVED_AT:${stage}`);
    else if(previousTime!==null&&observedAt<previousTime)errors.push(`OUT_OF_ORDER:${stage}`);
    if(observedAt!==null)previousTime=observedAt;
    if(workspaceId&&text(row.workspaceId)!==workspaceId)errors.push(`WORKSPACE_MISMATCH:${stage}`);

    const plan=text(row.workspacePlan).toUpperCase()||'FREE';
    const status=text(row.subscriptionStatus).toLowerCase();
    const providerId=text(row.providerSubscriptionId);
    const activeCount=Number(row.activeSubscriptionCount);
    const eventId=text(row.lastStripeEventId);

    if(stage==='FREE_BASELINE'){
      if(plan!=='FREE')errors.push('FREE_BASELINE_NOT_FREE');
      if(Number.isFinite(activeCount)&&activeCount!==0)errors.push('FREE_BASELINE_ACTIVE_SUBSCRIPTION');
      continue;
    }

    if(stage==='ENDED_FREE'){
      if(plan!=='FREE')errors.push('ENDED_NOT_FREE');
      if(status&&!ENDED_STATUSES.has(status))errors.push('ENDED_STATUS_NOT_TERMINAL');
      if(Number.isFinite(activeCount)&&activeCount!==0)errors.push('ENDED_ACTIVE_SUBSCRIPTION_REMAINS');
      if(subscriptionId&&providerId&&providerId!==subscriptionId)errors.push('ENDED_SUBSCRIPTION_ID_CHANGED');
      if(!eventId)errors.push('ENDED_WEBHOOK_EVENT_REQUIRED');
      else if(lifecycleEventIds.has(eventId))errors.push('ENDED_WEBHOOK_EVENT_REUSED');
      continue;
    }

    const expectedPlan=PAID_STAGE_PLAN[stage];
    if(plan!==expectedPlan)errors.push(`PLAN_MISMATCH:${stage}`);
    if(!ACTIVE_STATUSES.has(status))errors.push(`PAID_STATUS_NOT_ACTIVE:${stage}`);
    if(!providerId)errors.push(`SUBSCRIPTION_ID_REQUIRED:${stage}`);
    else if(!subscriptionId)subscriptionId=providerId;
    else if(providerId!==subscriptionId)errors.push(`SUBSCRIPTION_ID_CHANGED:${stage}`);
    if(!Number.isFinite(activeCount)||activeCount!==1)errors.push(`ACTIVE_SUBSCRIPTION_COUNT_NOT_ONE:${stage}`);
    if(!eventId)errors.push(`WEBHOOK_EVENT_REQUIRED:${stage}`);
    else if(lifecycleEventIds.has(eventId))errors.push(`WEBHOOK_EVENT_REUSED:${stage}`);
    else lifecycleEventIds.add(eventId);
    if(stage==='CANCEL_SCHEDULED'&&row.cancelAtPeriodEnd!==true)errors.push('CANCEL_NOT_SCHEDULED');
    if(stage!=='CANCEL_SCHEDULED'&&row.cancelAtPeriodEnd===true)errors.push(`UNEXPECTED_CANCEL_FLAG:${stage}`);
  }

  const checkout= input.checkout||{};
  if(text(checkout.mode).toUpperCase()!=='SUBSCRIPTION')errors.push('CHECKOUT_MODE_NOT_SUBSCRIPTION');
  if(text(checkout.currency).toUpperCase()!=='EUR')errors.push('CHECKOUT_CURRENCY_NOT_EUR');
  if(checkout.realMoney===true)errors.push('REAL_MONEY_EVIDENCE_REJECTED');

  return {
    ok:errors.length===0,
    verdict:errors.length===0?'GO':'NO-GO',
    schema:'MPR_BILLING_JOURNEY_EVIDENCE_VERDICT_V1',
    checks:{
      requiredStagesPresent:REQUIRED_STAGES.every(stage=>byStage.has(stage)),
      oneSubscriptionAcrossPaidJourney:Boolean(subscriptionId)&&!errors.some(error=>error.startsWith('SUBSCRIPTION_ID_CHANGED')),
      webhookEvidenceUnique:!errors.some(error=>error.includes('WEBHOOK_EVENT_REUSED')),
      sandboxOnly:!errors.includes('NOT_SANDBOX_EVIDENCE')&&!errors.includes('REAL_MONEY_EVIDENCE_REJECTED')
    },
    errors
  };
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
