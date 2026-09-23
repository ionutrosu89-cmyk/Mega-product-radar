import fs from 'node:fs/promises';
import path from 'node:path';
import {parseAmazonPublicRankingHtml} from '../amazon-public-ranking-snapshot-v1.js';
import {classifyPublicBrandGate} from '../brand-policy-v1.js';

const targets=JSON.parse(await fs.readFile(new URL('../data/amazon-niche-slice-targets-v1.json',import.meta.url),'utf8'));
const out=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)||'artifacts/amazon-niche-slices-latest.json';
if(targets.targets.length!==25||new Set(targets.targets.map(x=>x.nicheId)).size!==25)throw new Error('Expected 25 distinct niche targets');
const observedAt=new Date().toISOString();
const results=[];
for(const target of targets.targets){
  const pages=[];
  for(const page of [1,2]){
    const url=page===1?target.url:`${target.url}?pg=2`;
    try{
      const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',accept:'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(15000)});
      const parsed=parseAmazonPublicRankingHtml({html:await response.text(),sourceUrl:url,observedAt,categoryKey:`amazon:${target.nicheId}:category-slice`,categoryLabel:target.category});
      pages.push({page,status:response.ok&&parsed.ok?'RANKING_EVIDENCE_CAPTURED':'NO_USABLE_RANKING_EVIDENCE',httpStatus:response.status,diagnostics:parsed.diagnostics,observations:parsed.observations});
    }catch(error){pages.push({page,status:'FETCH_FAILED',error:String(error?.message||error),observations:[]});}
  }
  const seen=new Set();
  const observations=pages.flatMap(p=>p.observations).filter(row=>{
    const key=`${row.sourceRank}|${row.externalId}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>a.sourceRank-b.sourceRank).map(row=>({...row,brandGate:classifyPublicBrandGate({name:row.title}).brandPolicyClass,reviewStatus:'PENDING',nicheMatchStatus:'PENDING'}));
  const result={...target,status:pages.every(p=>p.status==='RANKING_EVIDENCE_CAPTURED')?'RANKING_EVIDENCE_CAPTURED':'PARTIAL_OR_NO_RANKING_EVIDENCE',pages:pages.map(({observations:_,...page})=>({...page,rankEvidenceCount:_.length})),rankEvidenceCount:observations.length,brandUnknownCount:observations.filter(row=>row.brandGate==='UNKNOWN_REVIEW').length,brandExcludedCount:observations.filter(row=>row.brandGate==='ESTABLISHED_EXCLUDE').length,observations};
  results.push(result);
  console.log(`${target.nicheId}: ${result.status} (${result.rankEvidenceCount} explicit ranks; ${result.brandUnknownCount} pending brand review)`);
}
const report={schema:'MPR_AMAZON_NICHE_SLICES_LOCAL_V1',observedAt,market:'AMAZON_US',status:'INTERNAL_RESEARCH_NOT_PUBLICATION',targetCount:targets.targets.length,rankingCategoryCount:results.filter(row=>row.rankEvidenceCount>=25).length,rankedObservationCount:results.reduce((sum,row)=>sum+row.rankEvidenceCount,0),results,policy:{categorySliceIsNotNicheCoverage:true,brandUnknownRequiresHumanReview:true,sourceRankIsNotUnitSales:true,publicDisplayRightsNotGranted:true,missingRanksMustNotBeInferred:true}};
const reviewQueue=results.flatMap(result=>result.observations.filter(row=>row.brandGate==='UNKNOWN_REVIEW').slice(0,25).map(row=>({nicheId:result.nicheId,category:result.category,sourceRank:row.sourceRank,asin:row.externalId,title:row.title,amazonUrl:`https://www.amazon.com/dp/${row.externalId}`,observedAt:row.observedAt,brandReview:'PENDING',nicheReview:'PENDING',aliexpressMatch:'NOT_CHECKED',ebayMatch:'NOT_CHECKED',googleDemand:'NOT_CHECKED',romaniaComparable:'NOT_CHECKED',rankCoverageCaveat:row.sourceRank>30?'RANKS_31_TO_50_NOT_CAPTURED':''})));
report.reviewQueueCount=reviewQueue.length;
report.reviewQueueStatus='PROVISIONAL_CANDIDATES_NOT_VALIDATED_TOP_25';
const csvCell=value=>{
  const raw=String(value??'');
  const safe=/^[\s]*[=+\-@]/.test(raw)?`'${raw}`:raw;
  return `"${safe.replace(/"/g,'""')}"`;
};
const columns=Object.keys(reviewQueue[0]||{});
const csv=[columns.join(','),...reviewQueue.map(row=>columns.map(column=>csvCell(row[column])).join(','))].join('\n')+'\n';
const csvOut=out.replace(/\.json$/i,'-review-queue.csv');
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
await fs.writeFile(csvOut,csv);
console.log(JSON.stringify({targetCount:report.targetCount,rankingCategoryCount:report.rankingCategoryCount,rankedObservationCount:report.rankedObservationCount,reviewQueueCount:report.reviewQueueCount,out,csvOut}));
