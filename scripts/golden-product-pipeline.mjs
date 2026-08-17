import fs from 'node:fs/promises';

const FILE='market-intelligence-live.json';
const OUT='golden-pipeline-live.json';
const phase=String(process.argv.find(x=>x.startsWith('--phase='))?.split('=')[1]||'final').toLowerCase();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,num(v)));
const round=v=>Math.round(num(v)*10)/10;
const arr=v=>Array.isArray(v)?v:[];

function freeScore(p){
  const demand=clamp(p?.demand?.score);
  const gap=clamp(p?.marketGap?.score);
  const sourcing=clamp(p?.sourcing?.score);
  const economics=clamp(p?.economics?.score);
  const evidence=clamp(p?.evidenceCoverage?.coverageScore);
  const competition=clamp(p?.competition?.pressure);
  const launch=clamp(p?.launchScore?.score);
  return round(
    launch*0.26+
    demand*0.16+
    gap*0.18+
    sourcing*0.14+
    economics*0.12+
    evidence*0.08+
    (100-competition)*0.06
  );
}

function finalScore(p){
  const opportunity=clamp(p?.opportunityRanking?.score);
  const launch=clamp(p?.launchScore?.score);
  const confidence=clamp(p?.dataConfidence?.overall);
  const verifiedDemand=p?.keywordDemand?.verifiedSearchVolume===true?Math.min(100,35+Math.log10(Math.max(1,num(p?.keywordDemand?.searchVolume)))*22):0;
  const pricing=p?.economics?.pricingVerified?100:35;
  const supplier=num(p?.chinaIntelligenceV2?.sources||p?.sourcing?.sources)>0?65:20;
  const reviews=num(p?.reviewIntelligenceV2?.sourceCount||p?.reviews?.sourceCount)>0?65:20;
  return round(opportunity*0.28+launch*0.22+confidence*0.18+verifiedDemand*0.14+pricing*0.08+supplier*0.06+reviews*0.04);
}

function stageFor(p,index,total){
  if(p?.testBuyDecision?.status==='TEST_BUY')return 'TEST_READY';
  if(phase==='prepaid'){
    if(index<15)return 'PROMISING';
    return 'DISCOVERED';
  }
  const verified=p?.keywordDemand?.verifiedSearchVolume===true;
  const confidence=num(p?.dataConfidence?.overall);
  const blockers=arr(p?.testBuyDecision?.blockers).length;
  if(index<3&&verified&&confidence>=40)return 'FINALIST';
  if(index<5&&verified)return 'VALIDATE';
  if(index<15)return 'PROMISING';
  return 'DISCOVERED';
}

let data;
try{data=JSON.parse(await fs.readFile(FILE,'utf8'));}catch{console.log('Golden Pipeline: market intelligence missing; skipped.');process.exit(0)}
const products=arr(data.products);
const ranked=products.map(p=>({p,score:phase==='prepaid'?freeScore(p):finalScore(p)})).sort((a,b)=>b.score-a.score||num(b.p?.launchScore?.score)-num(a.p?.launchScore?.score));
const items=ranked.map((row,index)=>{
  const p=row.p;
  const stage=stageFor(p,index,ranked.length);
  const paidPriority=index<15?index+1:null;
  const deepPriority=stage==='FINALIST'?index+1:stage==='VALIDATE'?index+1:null;
  p.goldenPipeline={
    version:'1.0',
    phase,
    stage,
    rank:index+1,
    score:row.score,
    paidDataEligible:index<15,
    paidDataPriority:paidPriority,
    deepValidationEligible:['VALIDATE','FINALIST','TEST_READY'].includes(stage),
    updatedAt:new Date().toISOString()
  };
  return {
    name:p.name,
    cat:p.cat,
    rank:index+1,
    score:row.score,
    stage,
    keywordVerified:p?.keywordDemand?.verifiedSearchVolume===true,
    confidence:round(p?.dataConfidence?.overall),
    launchScore:round(p?.launchScore?.score),
    opportunityScore:round(p?.opportunityRanking?.score),
    paidDataEligible:index<15,
    paidDataPriority:paidPriority,
    deepValidationEligible:['VALIDATE','FINALIST','TEST_READY'].includes(stage),
    blockers:arr(p?.testBuyDecision?.blockers).slice(0,4)
  };
});

const stats={
  total:items.length,
  discovered:items.filter(x=>x.stage==='DISCOVERED').length,
  promising:items.filter(x=>x.stage==='PROMISING').length,
  validate:items.filter(x=>x.stage==='VALIDATE').length,
  finalists:items.filter(x=>x.stage==='FINALIST').length,
  testReady:items.filter(x=>x.stage==='TEST_READY').length,
  paidEligible:items.filter(x=>x.paidDataEligible).length,
  deepValidationEligible:items.filter(x=>x.deepValidationEligible).length
};

data.goldenPipeline={
  version:'1.0',
  phase,
  updatedAt:new Date().toISOString(),
  policy:'DISCOVERED → PROMISING → VALIDATE → FINALIST → TEST_READY. Paid data is allocated only to the highest-ranked survivors, never evenly across all products.',
  quotas:{promising:15,validate:5,finalists:3},
  stats
};
data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
await fs.writeFile(OUT,JSON.stringify({version:'1.0',phase,updatedAt:new Date().toISOString(),policy:data.goldenPipeline.policy,quotas:data.goldenPipeline.quotas,stats,items},null,2)+'\n');
console.log(`Golden Pipeline ${phase}: ${stats.total} total · ${stats.promising} promising · ${stats.validate} validate · ${stats.finalists} finalists · ${stats.testReady} test-ready · ${stats.paidEligible} paid-eligible.`);
