import fs from 'node:fs/promises';

const AUDIT='stage0-budget-brain-live.json';
const MARKET='market-intelligence-live.json';
const BUDGET='paid-budget-cap.json';
const PROVIDER='provider-intelligence-live.json';
const OUT='stage0-kpi-live.json';
const now=new Date().toISOString();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const arr=v=>Array.isArray(v)?v:[];
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function norm(v=''){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function useful(p){
  if(!p)return false;
  const ro=p?.providerIntelligence?.romaniaDemand||p?.romaniaDemand||{};
  const kw=arr(p?.providerIntelligence?.romaniaKeywords);
  const kd=p?.keywordDemand||{};
  const providerBacked=ro.providerVerified===true||ro.readyForTestDemandGate===true;
  const positiveKeyword=kw.some(x=>num(x?.searchVolume)>0)||num(kd?.searchVolume)>0;
  const deepEvidence=Boolean(p?.providerIntelligence?.amazonMarket)||Boolean(p?.providerIntelligence?.rankedKeywords);
  return providerBacked||positiveKeyword||deepEvidence;
}

const audit=await read(AUDIT,null);
const market=await read(MARKET,{products:[]});
const budget=await read(BUDGET,{});
const provider=await read(PROVIDER,{});
const products=arr(market.products);
const targets=arr(audit?.targets);
const byKey=new Map(products.map(p=>[norm(p?.canonicalKey||p?.name),p]));
const evaluated=targets.map(t=>{
  const p=byKey.get(norm(t?.canonicalKey||t?.title));
  return {canonicalKey:norm(t?.canonicalKey||t?.title),title:t?.title||p?.name||'',useful:useful(p),romaniaDemandReady:Boolean(p?.romaniaDemand?.readyForTestDemandGate||p?.providerIntelligence?.romaniaDemand?.readyForTestDemandGate),keywordVolume:num(p?.keywordDemand?.searchVolume),hasAmazonEvidence:Boolean(p?.providerIntelligence?.amazonMarket),hasRankedKeywords:Boolean(p?.providerIntelligence?.rankedKeywords)};
});
const usefulCount=evaluated.filter(x=>x.useful).length;
const targetCount=targets.length;
const successPct=targetCount?Math.round(usefulCount/targetCount*1000)/10:0;
const providerRunCostUsd=num(provider?.stats?.accountedCostUsd??provider?.stats?.runCostUsd);
const latestKeywordEvent=arr((await read('paid-budget-live.json',{}))?.events).filter(e=>e?.provider==='DATAFORSEO_GOOGLE_ADS').at(-1);
const auditAt=new Date(audit?.updatedAt||0).getTime();
const keywordEventAt=new Date(latestKeywordEvent?.at||0).getTime();
const keywordRunCostUsd=keywordEventAt>=auditAt?num(latestKeywordEvent?.costUsd):0;
const runCostConservativeEur=Math.round((providerRunCostUsd+keywordRunCostUsd)*10000)/10000;
const costPerUseful=usefulCount?Math.round(runCostConservativeEur/usefulCount*10000)/10000:null;
const monthlySpentConservativeEur=num(budget?.spentUsd);
const criteria={minEnrichmentSuccessPct:50,maxCostPerUsefulEnrichmentEur:.50,maxStage0SpendEur:10,candidateTarget:100};
const checks={allowlistActive:audit?.status==='ACTIVE',candidateUniverseReady:products.length>=criteria.candidateTarget,enrichmentSuccess:successPct>=criteria.minEnrichmentSuccessPct,costEfficiency:costPerUseful!==null&&costPerUseful<=criteria.maxCostPerUsefulEnrichmentEur,stageBudgetSafe:monthlySpentConservativeEur<=criteria.maxStage0SpendEur,noCostAnomaly:num(provider?.stats?.costAnomalyCount)===0};
const pass=Object.values(checks).every(Boolean);
const verdict=pass?'STAGE0_HEALTHY_MANUAL_REVIEW':'HOLD_STAGE0';
const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const out={version:'1.0',updatedAt:now,verdict,manualPromotionRequired:true,metrics:{candidateProducts:products.length,targetCount,usefulEnrichments:usefulCount,enrichmentSuccessPct:successPct,runCostConservativeEur,costPerUsefulEnrichmentEur:costPerUseful,cumulativeTestSpendConservativeEur:monthlySpentConservativeEur},criteria,checks,blockers,evaluated,policy:'Stage 1 is never enabled automatically. This evaluator only reports whether Stage 0 has met the configured quality and cost thresholds; commercial TEST/BUY gates remain unchanged.'};
await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Stage 0 KPI: verdict=${verdict}, useful=${usefulCount}/${targetCount}, success=${successPct}%, runCost≈€${runCostConservativeEur}, cost/useful=${costPerUseful??'n/a'}.`);
