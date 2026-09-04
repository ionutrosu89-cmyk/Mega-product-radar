import fs from 'node:fs';import path from 'node:path';
import {scoreDemandSignal} from '../demand-signal-v1.js';
import {scoreCompetition} from '../competition-signal-v1.js';
import {scoreOpportunity,buildHumanReviewQueue} from '../opportunity-score-v2.js';
import {buildOpportunityDashboardDataset} from '../opportunity-dashboard-dataset-v1.js';

const arg=(name,fallback)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const inputPath=arg('input','data/public-price-opportunity-v2-input.json');
const outPath=arg('out','artifacts/public-price-opportunity-v2.json');
const doc=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const rows=Array.isArray(doc.rows)?doc.rows:[];
const scored=rows.map((row,index)=>{
  const demand=scoreDemandSignal(row.demandInput||{observations:row.demandObservations||[]},{now:doc.generatedAt||new Date().toISOString()});
  const competition=scoreCompetition(row.competitionInput||{});
  const enriched={...row,demand,competition};
  const score=scoreOpportunity(enriched,{profitFloorRon:doc.profitFloorRon??10});
  return {...enriched,index,score,opportunityScore:score.opportunityScore,confidenceScore:score.confidenceScore};
});
const queue=buildHumanReviewQueue(scored,{profitFloorRon:doc.profitFloorRon??10});
const dashboard=buildOpportunityDashboardDataset(scored);
const output={schemaVersion:'MPR_PUBLIC_PRICE_OPPORTUNITY_V2_RUN',generatedAt:new Date().toISOString(),inputPath,rowCount:scored.length,eligibleCount:scored.filter(x=>x.score.eligible).length,highPriorityCount:scored.filter(x=>x.score.band==='HIGH_PRIORITY').length,humanReviewCount:queue.length,scored,humanReviewQueue:queue.map(x=>({id:x.id??x.canonicalProductId??x.index,opportunityScore:x.score.opportunityScore,confidenceScore:x.score.confidenceScore,band:x.score.band,blockers:x.score.blockers})),dashboard,policy:{networkCallsTriggered:0,paidCallsTriggered:0,providerSpend:0,negotiationIncluded:false,purchaseAuthorized:false}};
fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,rowCount:output.rowCount,eligibleCount:output.eligibleCount,highPriorityCount:output.highPriorityCount,humanReviewCount:output.humanReviewCount},null,2));
