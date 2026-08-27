import fs from 'node:fs/promises';
import {evaluateAggregateRankingTrust,applyRankingTrustCap} from '../ranking-eligibility-v1.js';

const FILE='market-intelligence-live.json';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;

async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function confidenceWeight(level=''){
  const v=String(level||'').toUpperCase();
  if(v.includes('RIDICAT')||v==='HIGH')return 1;
  if(v.includes('MEDI')||v==='MEDIUM')return .75;
  return .5;
}

function rankProduct(p){
  const demand=clamp(p?.demand?.score);
  const gap=clamp(p?.marketGap?.score);
  const competition=clamp(p?.competition?.pressure);
  const sourcing=clamp(p?.sourcing?.score);
  const economics=clamp(p?.economics?.score);
  const evidence=clamp(p?.evidenceCoverage?.coverageScore);
  const trendRaw=num(p?.trendIntelligence?.score);
  const trendNorm=clamp(50+trendRaw/2);
  const trendConfidence=confidenceWeight(p?.trendIntelligence?.confidence);
  const demandConfidence=confidenceWeight(p?.demand?.confidence);

  const components={
    demand:round(demand*0.18*demandConfidence),
    marketGap:round(gap*0.20),
    lowCompetition:round((100-competition)*0.12),
    sourcing:round(sourcing*0.15),
    economics:round(economics*0.15),
    evidence:round(evidence*0.10),
    trend:round(trendNorm*0.10*trendConfidence)
  };
  let score=Object.values(components).reduce((a,b)=>a+b,0);

  const blockers=[];
  const reasons=[];
  const evidenceReady=Boolean(p?.launchScore?.enoughEvidence);
  const trendSamples=num(p?.trendIntelligence?.sampleCount);
  const pricingVerified=Boolean(p?.economics?.pricingVerified);
  const competitorEvidence=num(p?.competitors?.evidenceMarkets)>0;
  const rankingTrust=evaluateAggregateRankingTrust(p);

  if(gap>=70)reasons.push('gap România–extern puternic');
  if(demand>=60)reasons.push('cerere externă relativ puternică');
  if(competition<=35)reasons.push('presiune concurențială RO redusă');
  if(sourcing>=55)reasons.push('sourcing China promițător');
  if(num(p?.economics?.roi)>=45)reasons.push('ROI estimat atractiv');
  if(['ACCELERATING','RISING'].includes(p?.trendIntelligence?.status))reasons.push('trend intern pozitiv');
  if(evidence>=70)reasons.push('acoperire bună a dovezilor');

  if(!evidenceReady){score=Math.min(score,64);blockers.push('dovezi comerciale insuficiente');}
  if(evidence<45){score=Math.min(score,58);blockers.push('acoperire redusă a surselor');}
  if(!pricingVerified){score=Math.min(score,72);blockers.push('preț/landed cost neverificat');}
  if(!competitorEvidence){score=Math.min(score,68);blockers.push('competiția RO nu este suficient observată');}
  if(trendSamples<2){score=Math.min(score,75);blockers.push('istoric insuficient pentru trend');}
  if(num(p?.economics?.margin)<=0||num(p?.economics?.roi)<=0){score=Math.min(score,45);blockers.push('economie nevalidată');}

  score=applyRankingTrustCap(score,rankingTrust);
  if(!rankingTrust.trustedEligible){
    blockers.push(rankingTrust.legacyResearchOrderingAllowed?'ranking fără semnal trustat Policy Kernel':'ranking evidence neverificat');
  }

  score=round(clamp(score));
  let tier='DE CERCETAT';
  if(score>=80&&evidenceReady&&evidence>=65&&rankingTrust.trustedEligible)tier='TOP OPORTUNITATE';
  else if(score>=68&&rankingTrust.trustedEligible)tier='URMĂREȘTE PRIORITAR';
  else if(score>=55)tier='DE VALIDAT';
  else if(score<40)tier='PRIORITATE MICĂ';

  return {
    score,
    tier,
    reasons:reasons.slice(0,5),
    blockers:[...new Set(blockers)].slice(0,5),
    components,
    evidenceReady,
    rankingTrust,
    policy:'Opportunity Ranking prioritizează ce merită analizat mai întâi. TOP/PRIORITAR necesită semnal de ranking acceptat de Policy Kernel, cu source rights, identitate exactă și proveniență. Datele de bootstrap/catalog pot ordona doar cercetarea și nu sunt semnal de ranking.'
  };
}

const data=await read(FILE,{products:[],stats:{}});
const products=Array.isArray(data.products)?data.products:[];
for(const p of products)p.opportunityRanking=rankProduct(p);
products.sort((a,b)=>num(b?.opportunityRanking?.score)-num(a?.opportunityRanking?.score)||num(b?.launchScore?.score)-num(a?.launchScore?.score));
products.forEach((p,i)=>{p.opportunityRanking.rank=i+1;});

data.stats=data.stats||{};
data.stats.topOpportunities=products.filter(p=>p?.opportunityRanking?.tier==='TOP OPORTUNITATE').length;
data.stats.priorityWatch=products.filter(p=>p?.opportunityRanking?.tier==='URMĂREȘTE PRIORITAR').length;
data.stats.validationQueue=products.filter(p=>p?.opportunityRanking?.tier==='DE VALIDAT').length;
data.stats.trustedRankingSignals=products.filter(p=>p?.opportunityRanking?.rankingTrust?.trustedEligible===true).length;
data.stats.legacyResearchOrdering=products.filter(p=>p?.opportunityRanking?.rankingTrust?.legacyResearchOrderingAllowed===true&&p?.opportunityRanking?.rankingTrust?.trustedEligible!==true).length;
data.opportunityRankingPolicy='Opportunity Ranking V2 este separat de Launch Score și verdictul comercial. TOP/PRIORITAR necesită ranking evidence acceptat de Policy Kernel. Bootstrap/catalogue evidence nu poate deveni ranking signal; legacy aggregates rămân doar research ordering și sunt plafonate fail-closed.';

await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log(`Opportunity Ranking V2: ${data.stats.topOpportunities||0} top, ${data.stats.priorityWatch||0} prioritar, ${data.stats.validationQueue||0} de validat, ${data.stats.trustedRankingSignals||0} cu semnal trustat.`);
