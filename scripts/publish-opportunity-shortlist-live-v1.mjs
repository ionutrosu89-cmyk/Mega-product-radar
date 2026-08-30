import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath=process.argv[2]||'artifacts/opportunity-shortlist-live.json';
const outputPath=process.argv[3]||'opportunity-shortlist-live.json';
const source=JSON.parse(await fs.readFile(inputPath,'utf8'));

const cleanText=v=>String(v??'').trim();
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const positiveInt=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
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
const candidates=[];
if(source.status==='SHORTLISTED'){
  if(!Array.isArray(source.candidates)||source.candidates.length!==1)throw new Error('EXACTLY_ONE_SHORTLIST_CANDIDATE_REQUIRED');
  const x=source.candidates[0];
  const metrics={roi:finite(x?.metrics?.roi),netMargin:finite(x?.metrics?.netMargin),netProfitRon:finite(x?.metrics?.netProfitRon)};
  if(Object.values(metrics).some(v=>v===null))throw new Error('CONSERVATIVE_METRICS_REQUIRED');
  if(x.shortlistPromoted!==true||x.finalistPromoted!==false||x.purchaseAuthorized!==false)throw new Error('SHORTLIST_AUTHORITY_BREACH');
  candidates.push({
    rank:finite(x.rank),
    target:{marketplace:cleanText(x?.target?.marketplace),asin:cleanText(x?.target?.asin)},
    decision:'SHORTLIST_CANDIDATE',
    metrics,
    thresholds:{roi:finite(x?.thresholds?.roi),netMargin:finite(x?.thresholds?.netMargin)},
    evidence:{economicsStatus:cleanText(x?.evidence?.economicsStatus),rankingScenario:'CONSERVATIVE'},
    shortlistPromoted:true,
    finalistPromoted:false,
    purchaseAuthorized:false
  });
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
  candidates,
  integrity:{
    persistenceClass:'SANITIZED_REPO_LIVE_HANDOFF',
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
console.log(JSON.stringify({schemaVersion:output.schemaVersion,status:output.status,candidates:output.candidates.length,blockers:output.blockers.length,rankingWorkflowRunId:upstream.rankingWorkflowRunId},null,2));
