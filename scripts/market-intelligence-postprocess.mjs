import fs from 'node:fs/promises';

const INPUT='discovery-live.json';
const OUTPUT='market-intelligence-live.json';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function scoreProfit(product){
  const e=product?.discoveryAnalysis?.economics||{};
  const margin=num(e.margin), roi=num(e.roi), profit=num(e.profit);
  const pricingVerified=String(product?.pricingStatus||'').toUpperCase().includes('VERIFIED');
  let score=0;
  score+=clamp((margin/30)*40,0,40);
  score+=clamp((roi/80)*35,0,35);
  score+=clamp((profit/40)*25,0,25);
  if(!pricingVerified) score=Math.min(score,72);
  return {score:round(score),margin:round(margin),roi:round(roi),profit:round(profit),pricingVerified,pricingStatus:product?.pricingStatus||'UNKNOWN'};
}

function scoreMarketGap(product){
  const checks=num(product?.checks);
  const foreign=num(product?.foreignPresence);
  const foreignResults=num(product?.foreignResults);
  const ro=num(product?.romaniaPresence);
  const roResults=num(product?.romaniaResults);
  const evidenceReady=checks>=6 && foreign>0;
  let score=clamp(45+foreign*12+Math.min(20,foreignResults*1.5)-ro*20-Math.min(25,roResults*2));
  if(!evidenceReady) score=Math.min(score,45);
  const label=!evidenceReady?'DATE INSUFICIENTE':score>=75?'GAP PUTERNIC':score>=55?'GAP MODERAT':'GAP SLAB';
  return {score:round(score),label,evidenceReady,checks,foreignPresence:foreign,foreignResults,romaniaPresence:ro,romaniaResults:roResults};
}

function scoreDemand(product){
  const checks=num(product?.checks);
  const foreign=num(product?.foreignPresence);
  const foreignResults=num(product?.foreignResults);
  const social=num(product?.socialPresence);
  const socialResults=num(product?.socialResults);
  const reviews=num(product?.reviewIntel?.sourceCount);
  const trend=product?.trendWindows||{};
  const trendSignals=[trend.d7,trend.d30,trend.d90].filter(v=>v!==null&&v!==undefined).length;
  let score=foreign*15+Math.min(30,foreignResults*2)+social*8+Math.min(15,socialResults)+reviews*5+trendSignals*4;
  if(checks<6) score=Math.min(score,40);
  return {score:round(clamp(score)),confidence:checks>=12?'RIDICATĂ':checks>=6?'MEDIE':'SCĂZUTĂ',checks,foreignPresence:foreign,socialPresence:social,reviewSources:reviews,trendSignals};
}

function scoreCompetition(product){
  const ro=num(product?.romaniaPresence);
  const roResults=num(product?.romaniaResults);
  const pressure=clamp(ro*35+Math.min(65,roResults*7));
  return {pressure:round(pressure),label:pressure>=70?'RIDICATĂ':pressure>=35?'MEDIE':'REDUSĂ',romaniaPresence:ro,romaniaResults:roResults};
}

function scoreSourcing(product){
  const hunter=product?.supplierHunter||{};
  const sources=num(hunter.sourceCount||product?.chinaPresence);
  const chinaResults=num(product?.chinaResults);
  const readiness=String(hunter.readiness||'NONE').toUpperCase();
  let score=sources*22+Math.min(25,chinaResults*2);
  if(readiness==='STRONG'||readiness==='READY') score+=30;
  else if(readiness==='PARTIAL') score+=15;
  score=clamp(score);
  return {score:round(score),readiness,sources,chinaResults,requiresManualCommercialCheck:hunter.requiresManualCommercialCheck!==false,items:Array.isArray(hunter.sources)?hunter.sources:[]};
}

function reviewSummary(product){
  const r=product?.reviewIntel||{};
  return {confidence:r.confidence||'INSUFFICIENT',sourceCount:num(r.sourceCount),snippetCount:num(r.snippetCount),negativeThemes:Array.isArray(r.negativeThemes)?r.negativeThemes:[],validation:r.validation||'Review intelligence bazat pe dovezi disponibile.'};
}

function keywordProxy(product,demand,gap){
  const proxy=clamp(demand.score*0.65+gap.score*0.2+num(product?.socialPresence)*5);
  return {score:round(proxy),provider:'OPEN_WEB_PROXY',verifiedSearchVolume:false,label:'Proxy cerere keyword',note:'Nu reprezintă volum verificat de căutări. Structura este pregătită pentru integrare DataForSEO fără schimbarea UI.'};
}

function launch(product,demand,gap,competition,sourcing,profit,reviews){
  const quality=String(product?.discoveryAnalysis?.quality?.level||product?.sourceStatus||'PARTIAL').toUpperCase();
  const reviewEvidence=reviews.sourceCount>0;
  const enoughEvidence=gap.evidenceReady && demand.checks>=6 && sourcing.sources>0 && profit.margin>0 && profit.roi>0;
  let score=demand.score*0.22+gap.score*0.24+(100-competition.pressure)*0.12+sourcing.score*0.18+profit.score*0.24;
  if(!reviewEvidence) score-=6;
  if(quality.includes('PARTIAL')) score=Math.min(score,58);
  if(!enoughEvidence) score=Math.min(score,49);
  score=clamp(score);
  let verdict='CERCETEAZĂ';
  if(enoughEvidence && reviewEvidence && score>=80 && profit.margin>=20 && profit.roi>=45 && sourcing.score>=55) verdict='CANDIDAT CUMPĂRĂ';
  else if(enoughEvidence && score>=65 && profit.margin>=15 && profit.roi>=30) verdict='CANDIDAT TEST';
  else if(score<40) verdict='RESPINGE / AȘTEAPTĂ';
  return {score:round(score),verdict,enoughEvidence,reviewEvidence,quality,note:'Launch Score este un strat de prioritizare și nu modifică pragurile comerciale existente TEST/CUMPĂRĂ.'};
}

const discovery=await readJson(INPUT,{products:[]});
const products=(Array.isArray(discovery.products)?discovery.products:[]).map(product=>{
  const demand=scoreDemand(product);
  const marketGap=scoreMarketGap(product);
  const competition=scoreCompetition(product);
  const sourcing=scoreSourcing(product);
  const profit=scoreProfit(product);
  const reviews=reviewSummary(product);
  const keywordDemand=keywordProxy(product,demand,marketGap);
  const launchScore=launch(product,demand,marketGap,competition,sourcing,profit,reviews);
  return {
    name:product.name,
    cat:product.cat||'Altele',
    imageUrl:product.imageUrl||'',
    imageSourceUrl:product.imageSourceUrl||'',
    sourceStatus:product.sourceStatus||'PARTIAL',
    suggestedStage:product.suggestedStage||'RESEARCH',
    checkedAt:product.checkedAt||discovery.updatedAt||null,
    economics:profit,
    demand,
    marketGap,
    competition,
    sourcing,
    reviews,
    keywordDemand,
    launchScore,
    sourceEvidence:product.evidence||'',
    sourcingLinks:Array.isArray(product.sourcing)?product.sourcing:[],
    rawOpportunityScore:num(product?.discoveryAnalysis?.score)
  };
}).sort((a,b)=>b.launchScore.score-a.launchScore.score);

const stats={
  total:products.length,
  buyCandidates:products.filter(p=>p.launchScore.verdict==='CANDIDAT CUMPĂRĂ').length,
  testCandidates:products.filter(p=>p.launchScore.verdict==='CANDIDAT TEST').length,
  strongGaps:products.filter(p=>p.marketGap.label==='GAP PUTERNIC').length,
  evidenceReady:products.filter(p=>p.launchScore.enoughEvidence).length,
  partial:products.filter(p=>String(p.sourceStatus).toUpperCase().includes('PARTIAL')).length
};

const output={
  version:'1.0',
  engine:'Mega Product Radar Market Intelligence',
  updatedAt:new Date().toISOString(),
  sourceUpdatedAt:discovery.updatedAt||null,
  mode:'STRICT_EVIDENCE_FIRST',
  dataPolicy:'Scorurile sunt calculate exclusiv din dovezile existente. Volumele de căutare și vânzările nu sunt inventate; keyword demand rămâne proxy până la integrarea unui furnizor precum DataForSEO.',
  providerReadiness:{dataForSEO:{ready:true,enabled:false,purpose:['keyword volume RO','SERP RO','Google Shopping','cross-market demand']},apify:{ready:true,enabled:false,purpose:['dynamic marketplace enrichment','fallback scraping']}},
  stats,
  products
};
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`Market Intelligence: ${products.length} produse, ${stats.testCandidates} TEST candidates, ${stats.buyCandidates} BUY candidates, ${stats.evidenceReady} cu dovezi suficiente.`);
