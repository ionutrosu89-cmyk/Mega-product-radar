import fs from 'node:fs/promises';
import path from 'node:path';

const economicsPath=process.argv[2]||'artifacts/economics/opportunity-economics-live.json';
const outPath=process.argv[3]||'artifacts/opportunity-ranking-live.json';
const sourceEconomicsRunId=process.argv[4]||null;
const economics=JSON.parse(await fs.readFile(economicsPath,'utf8'));

const source={economicsWorkflowRunId:sourceEconomicsRunId?Number(sourceEconomicsRunId):null,opportunityPackWorkflowRunId:economics?.source?.opportunityPackWorkflowRunId??null,rematchWorkflowRunId:economics?.source?.rematchWorkflowRunId??null};
const common={schemaVersion:'MPR_OPPORTUNITY_RANKING_LIVE_V1',generatedAt:new Date().toISOString(),rankingScenario:'CONSERVATIVE',source,purchaseAuthorized:false,truthPolicy:{...(economics.truthPolicy||{}),screenedEconomicsRequired:true,rankingDoesNotAuthorizeShortlist:true,rankingCandidateIsNotFinalist:true,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,unknownEqualsZero:false}};

if(economics.status!=='SCREENED'){
  const blockers=(economics.upstreamBlockers?.length?economics.upstreamBlockers:['SCREENED_ECONOMICS_REQUIRED']);
  const output={...common,status:'BLOCKED_UPSTREAM_ECONOMICS',decision:'VALIDATE',blockers,candidates:[],reason:'Opportunity ranking requires screened conservative economics.'};
  await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,decision:output.decision,blockers:output.blockers,source},null,2));
  process.exit(0);
}

const gate=economics.opportunityGate||{};
if(gate.qualifies!==true||gate.decision!=='SCREENING_OPPORTUNITY'){
  const output={...common,status:'REJECTED_CONSERVATIVE_ECONOMICS',decision:'REJECT',blockers:['CONSERVATIVE_ECONOMICS_THRESHOLD_NOT_MET'],candidates:[],reason:'Conservative screening thresholds were not met. Rejection is screening-only, not a permanent product verdict.'};
  await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,decision:output.decision,source},null,2));
  process.exit(0);
}

const conservative=economics?.economics?.scenarios?.conservative;
if(!conservative)throw new Error('CONSERVATIVE_SCENARIO_REQUIRED');
for(const key of ['roi','netMargin','netProfitRon'])if(!Number.isFinite(Number(conservative[key])))throw new Error(`INVALID_CONSERVATIVE_METRIC:${key}`);
if(economics.rankingScenario!=='CONSERVATIVE')throw new Error('CONSERVATIVE_RANKING_REQUIRED');
if(!Number.isInteger(source.opportunityPackWorkflowRunId)||source.opportunityPackWorkflowRunId<=0)throw new Error('OPPORTUNITY_PACK_PROVENANCE_REQUIRED');

const candidate={rank:1,target:economics.target||null,decision:'RANKING_CANDIDATE',shortlistEligible:true,shortlistPromoted:false,metrics:{roi:Number(conservative.roi),netMargin:Number(conservative.netMargin),netProfitRon:Number(conservative.netProfitRon)},thresholds:gate.thresholds||null,evidence:{economicsStatus:economics.status,rankingScenario:'CONSERVATIVE'}};
const output={...common,status:'RANKED',decision:'RANKING_CANDIDATE',candidates:[candidate],ranking:{method:'CONSERVATIVE_ROI_THEN_NET_MARGIN_THEN_NET_PROFIT',candidateCount:1},reason:'Candidate passed conservative screening and is eligible for the separate shortlist gate; no finalist or purchase authority is granted here.'};
await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:output.status,decision:output.decision,candidate,source},null,2));
