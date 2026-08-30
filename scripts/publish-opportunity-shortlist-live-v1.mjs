import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath=process.argv[2]||'artifacts/opportunity-shortlist-live.json';
const outputPath=process.argv[3]||'opportunity-shortlist-live.json';
const source=JSON.parse(await fs.readFile(inputPath,'utf8'));

const cleanText=v=>String(v??'').trim();
const finite=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const positiveInt=v=>{
  const n=finite(v);
  return Number.isInteger(n)&&n>0?n:null;
};
const allowedStatuses=new Set(['BLOCKED_UPSTREAM_RANKING','SHORTLISTED']);
if(!allowedStatuses.has(source.status))throw new Error('UNSUPPORTED_SHORTLIST_STATUS');
if(source.rankingScenario!=='CONSERVATIVE')throw new Error('CONSERVATIVE_SHORTLIST_REQUIRED');
if(source.purchaseAuthorized!==false||source?.truthPolicy?.unknownEqualsZero!==false)throw new Error('SHORTLIST_TRUTH_POLICY_BREACH');
if(source?.truthPolicy?.shortlistDoesNotAuthorizeFinalist!==true||source?.truthPolicy?.shortlistCandidateIsNotPurchaseAuthorization!==true)throw new Error('SHORTLIST_PROMOTION_POLICY_BREACH');

const upstream={
  rankingWorkflowRunId:positiveInt(source?.source?.rankingWorkflowRunId),
  economicsWorkflowRunId:positiveInt(source?.source?.economicsWorkflowRunId),
  opportunityPackWorkflowRunId:positiveInt(source?.source?.opportunityPackWorkflowRunId),
  rematchWorkflowRunId:positiveInt(source?.source?.rematchWorkflowRunId)
};
if(!upstream.rankingWorkflowRunId)throw new Error('RANKING_PROVENANCE_REQUIRED');

const blockers=(Array.isArray(source.blockers)?source.blockers:[]).map(cleanText).filter(Boolean).slice(0,20);
let candidateCount=0;
if(source.status==='SHORTLISTED'){
  if(!Array.isArray(source.candidates)||source.candidates.length!==1)throw new Error('EXACTLY_ONE_SHORTLIST_CANDIDATE_REQUIRED');
  const x=source.candidates[0];
  const metrics=[finite(x?.metrics?.roi),finite(x?.metrics?.netMargin),finite(x?.metrics?.netProfitRon)];
  if(metrics.some(v=>v===null))throw new Error('CONSERVATIVE_METRICS_REQUIRED');
  if(positiveInt(x?.rank)===null||!cleanText(x?.target?.marketplace)||!cleanText(x?.target?.asin))throw new Error('SHORTLIST_TARGET_REQUIRED');
  if(x.shortlistPromoted!==true||x.finalistPromoted!==false||x.purchaseAuthorized!==false)throw new Error('SHORTLIST_AUTHORITY_BREACH');
  candidateCount=1;
}else if(Array.isArray(source.candidates)&&source.candidates.length!==0){
  throw new Error('BLOCKED_SHORTLIST_HAS_CANDIDATES');
}

const output={
  schemaVersion:'MPR_OPPORTUNITY_SHORTLIST_DASHBOARD_V1',
  updatedAt:source.generatedAt||new Date().toISOString(),
  status:source.status,
  decision:source.status==='SHORTLISTED'?'SHORTLIST_CANDIDATE':'VALIDATE',
  blockers,
  source:upstream,
  summary:{candidateCount},
  integrity:{
    persistenceClass:'SANITIZED_REPO_LIVE_HANDOFF',
    paidOpportunityDataIncluded:false,
    privateSupplierEvidenceIncluded:false,
    shortlistIsFinalist:false,
    shortlistCanAuthorizePurchase:false,
    unknownEqualsZero:false,
    providerSpendUsd:0,
    paidCallsTriggered:0,
    purchaseAuthorized:false
  }
};

await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:output.schemaVersion,status:output.status,candidateCount:output.summary.candidateCount,blockers:output.blockers.length,rankingWorkflowRunId:upstream.rankingWorkflowRunId},null,2));
