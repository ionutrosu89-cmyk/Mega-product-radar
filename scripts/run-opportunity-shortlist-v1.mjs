import fs from 'node:fs/promises';
import path from 'node:path';

const rankingPath=process.argv[2]||'artifacts/ranking/opportunity-ranking-live.json';
const outPath=process.argv[3]||'artifacts/opportunity-shortlist-live.json';
const sourceRankingRunId=process.argv[4]||null;
const ranking=JSON.parse(await fs.readFile(rankingPath,'utf8'));

const source={rankingWorkflowRunId:sourceRankingRunId?Number(sourceRankingRunId):null,economicsWorkflowRunId:ranking?.source?.economicsWorkflowRunId??null,opportunityPackWorkflowRunId:ranking?.source?.opportunityPackWorkflowRunId??null,rematchWorkflowRunId:ranking?.source?.rematchWorkflowRunId??null};
const common={schemaVersion:'MPR_OPPORTUNITY_SHORTLIST_LIVE_V1',generatedAt:new Date().toISOString(),rankingScenario:'CONSERVATIVE',source,purchaseAuthorized:false,truthPolicy:{...(ranking.truthPolicy||{}),rankedCandidateRequired:true,shortlistDoesNotAuthorizeFinalist:true,shortlistCandidateIsNotPurchaseAuthorization:true,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,unknownEqualsZero:false}};

if(ranking.status!=='RANKED'){
  const blockers=(ranking.blockers?.length?ranking.blockers:['RANKED_CANDIDATE_REQUIRED']);
  const output={...common,status:'BLOCKED_UPSTREAM_RANKING',decision:'VALIDATE',blockers,candidates:[],reason:'Shortlist requires a candidate admitted by the fail-closed opportunity ranking gate.'};
  await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,decision:output.decision,blockers:output.blockers,source},null,2));
  process.exit(0);
}

if(ranking.rankingScenario!=='CONSERVATIVE')throw new Error('CONSERVATIVE_RANKING_REQUIRED');
if(!Number.isInteger(source.rankingWorkflowRunId)||source.rankingWorkflowRunId<=0)throw new Error('RANKING_PROVENANCE_REQUIRED');
if(!Number.isInteger(source.economicsWorkflowRunId)||source.economicsWorkflowRunId<=0)throw new Error('ECONOMICS_PROVENANCE_REQUIRED');
if(!Array.isArray(ranking.candidates)||ranking.candidates.length!==1)throw new Error('EXACTLY_ONE_RANKING_CANDIDATE_REQUIRED');
const ranked=ranking.candidates[0];
if(ranked.rank!==1||ranked.decision!=='RANKING_CANDIDATE'||ranked.shortlistEligible!==true||ranked.shortlistPromoted!==false)throw new Error('INVALID_RANKING_CANDIDATE');
for(const key of ['roi','netMargin','netProfitRon'])if(!Number.isFinite(Number(ranked?.metrics?.[key])))throw new Error(`INVALID_CONSERVATIVE_METRIC:${key}`);

const candidate={...ranked,decision:'SHORTLIST_CANDIDATE',shortlistEligible:true,shortlistPromoted:true,finalistPromoted:false,purchaseAuthorized:false,evidence:{...(ranked.evidence||{}),rankingStatus:ranking.status,rankingScenario:'CONSERVATIVE'}};
const output={...common,status:'SHORTLISTED',decision:'SHORTLIST_CANDIDATE',blockers:[],candidates:[candidate],shortlist:{method:'SEPARATE_FAIL_CLOSED_GATE_FROM_RANKING',candidateCount:1},reason:'The ranked candidate is admitted to the shortlist only. This does not create finalist status or purchase authority.'};
await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:output.status,decision:output.decision,candidate,source},null,2));
