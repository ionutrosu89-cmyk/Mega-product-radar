import fs from 'node:fs/promises';
import { roProductName } from '../product-ro.js';

const FILE='market-intelligence-live.json';
const CACHE_FILE='dataforseo-cache.json';
const BUDGET_FILE='paid-budget-live.json';
const login=String(process.env.DATAFORSEO_LOGIN||'').trim();
const password=String(process.env.DATAFORSEO_PASSWORD||'').trim();
const enabled=!!(login&&password);
const trialMode=String(process.env.DATAFORSEO_TRIAL_MODE||'true').toLowerCase()!=='false';
const maxKeywords=Math.max(1,Math.min(1000,Number(process.env.DATAFORSEO_MAX_KEYWORDS||(trialMode?10:15))||10));
const maxRequestCostUsd=Math.max(0.01,Number(process.env.DATAFORSEO_MAX_REQUEST_COST_USD||(trialMode?0.10:0.25))||0.10);
const maxDailyCostUsd=Math.max(maxRequestCostUsd,Number(process.env.DATAFORSEO_MAX_DAILY_COST_USD||(trialMode?0.30:1.00))||0.30);
const maxMonthlyCostUsd=Math.max(maxDailyCostUsd,Number(process.env.DATAFORSEO_MAX_MONTHLY_COST_USD||(trialMode?5.00:20.00))||5.00);
const cacheTtlDays=Math.max(1,Number(process.env.DATAFORSEO_CACHE_TTL_DAYS||7)||7);
const now=new Date();

function cleanKeyword(value=''){
  return String(value||'').replace(/[\u{1F300}-\u{1FAFF}]/gu,' ').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().split(' ').slice(0,10).join(' ').slice(0,80).trim();
}
function key(value=''){return cleanKeyword(value).toLocaleLowerCase('ro-RO');}
function num(v){return Number.isFinite(Number(v))?Number(v):null;}
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function sameUtcDay(a,b){return a&&b&&a.getUTCFullYear()===b.getUTCFullYear()&&a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()===b.getUTCDate();}
function sameUtcMonth(a,b){return a&&b&&a.getUTCFullYear()===b.getUTCFullYear()&&a.getUTCMonth()===b.getUTCMonth();}
function fresh(entry){const at=new Date(entry?.checkedAt||0);return Number.isFinite(at.getTime())&&now-at<cacheTtlDays*86400000;}
function applyRow(product,keyword,row,provider='DATAFORSEO_GOOGLE_ADS_CACHE'){
  const searchVolume=num(row.search_volume??row.searchVolume);
  const monthlyRaw=Array.isArray(row.monthly_searches)?row.monthly_searches:Array.isArray(row.monthlySearches)?row.monthlySearches:[];
  const monthly=monthlyRaw.map(x=>({year:num(x.year),month:num(x.month),searchVolume:num(x.search_volume??x.searchVolume)})).filter(x=>x.searchVolume!==null);
  product.keywordDemand={...(product.keywordDemand||{}),provider,verifiedSearchVolume:searchVolume!==null,keyword,searchVolume,competition:row.competition||null,competitionIndex:num(row.competition_index??row.competitionIndex),cpc:num(row.cpc),lowTopOfPageBid:num(row.low_top_of_page_bid??row.lowTopOfPageBid),highTopOfPageBid:num(row.high_top_of_page_bid??row.highTopOfPageBid),monthlySearches:monthly,checkedAt:row.checkedAt||new Date().toISOString(),note:'Volum și competiție Google Ads pentru România prin DataForSEO. Cache-ul este reutilizat pentru a evita costuri duplicate.'};
}

let data=await readJson(FILE,null);
if(!data){console.log('DataForSEO keywords: Market Intelligence dataset missing; skipped.');process.exit(0)}
const cache=await readJson(CACHE_FILE,{version:'1.0',keywords:{}});
cache.keywords=cache.keywords&&typeof cache.keywords==='object'?cache.keywords:{};
const budget=await readJson(BUDGET_FILE,{version:'1.0',events:[]});
budget.events=Array.isArray(budget.events)?budget.events:[];
const dailyUsed=budget.events.filter(e=>sameUtcDay(new Date(e.at),now)).reduce((s,e)=>s+Number(e.costUsd||0),0);
const monthlyUsed=budget.events.filter(e=>sameUtcMonth(new Date(e.at),now)).reduce((s,e)=>s+Number(e.costUsd||0),0);

if(!enabled){
  data.providerReadiness={...(data.providerReadiness||{}),dataForSEO:{...(data.providerReadiness?.dataForSEO||{}),ready:true,enabled:false,status:'CREDENTIALS_NOT_CONFIGURED',budgetGuard:{maxKeywords,maxRequestCostUsd,maxDailyCostUsd,maxMonthlyCostUsd,cacheTtlDays,dailyUsedUsd:dailyUsed,monthlyUsedUsd:monthlyUsed}}};
  await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
  console.log('DataForSEO keywords: disabled, no credentials configured; $0 usage.');
  process.exit(0);
}

const products=Array.isArray(data.products)?data.products:[];
const candidates=products.slice().sort((a,b)=>{
  const ae=a?.goldenPipeline?.paidDataEligible===true?1:0,be=b?.goldenPipeline?.paidDataEligible===true?1:0;
  if(ae!==be)return be-ae;
  const ap=Number(a?.goldenPipeline?.paidDataPriority||9999),bp=Number(b?.goldenPipeline?.paidDataPriority||9999);
  if(ap!==bp)return ap-bp;
  return Number(b?.goldenPipeline?.score||b?.launchScore?.score||0)-Number(a?.goldenPipeline?.score||a?.launchScore?.score||0);
}).filter(p=>p?.goldenPipeline?.paidDataEligible!==false);

const keywordToProducts=new Map();
for(const product of candidates){
  const keyword=cleanKeyword(roProductName(product.name));
  if(!keyword)continue;
  const k=key(keyword);
  if(!keywordToProducts.has(k))keywordToProducts.set(k,{keyword,products:[]});
  keywordToProducts.get(k).products.push(product);
  if(keywordToProducts.size>=maxKeywords)break;
}

let cacheHits=0;
const toQuery=[];
for(const [k,entry] of keywordToProducts){
  const cached=cache.keywords[k];
  if(cached&&fresh(cached)){
    for(const product of entry.products)applyRow(product,entry.keyword,cached,'DATAFORSEO_GOOGLE_ADS_CACHE');
    cacheHits+=entry.products.length;
  }else toQuery.push(entry.keyword);
}

let requestCost=0,apiEnriched=0,skippedForBudget=false;
const remainingDaily=Math.max(0,maxDailyCostUsd-dailyUsed);
const remainingMonthly=Math.max(0,maxMonthlyCostUsd-monthlyUsed);
if(toQuery.length&&remainingDaily>=maxRequestCostUsd&&remainingMonthly>=maxRequestCostUsd){
  const auth=Buffer.from(`${login}:${password}`).toString('base64');
  const endpoint='https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
  const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/json'},body:JSON.stringify([{location_name:'Romania',language_name:'Romanian',keywords:toQuery,search_partners:false,include_adult_keywords:false,sort_by:'relevance',tag:trialMode?'mega-product-radar-ro-trial':'mega-product-radar-ro'}])});
  if(!response.ok)throw new Error(`DataForSEO HTTP ${response.status}`);
  const payload=await response.json();
  if(Number(payload?.status_code)!==20000)throw new Error(`DataForSEO API ${payload?.status_code||'UNKNOWN'} ${payload?.status_message||''}`.trim());
  const task=Array.isArray(payload?.tasks)?payload.tasks[0]:null;
  if(task&&Number(task.status_code)!==20000)throw new Error(`DataForSEO task ${task.status_code} ${task.status_message||''}`.trim());
  requestCost=num(payload?.cost)??num(task?.cost)??0;
  if(requestCost>maxRequestCostUsd)throw new Error(`BUDGET_GUARD: request cost $${requestCost} exceeded configured cap $${maxRequestCostUsd}`);
  if(dailyUsed+requestCost>maxDailyCostUsd)throw new Error(`BUDGET_GUARD: daily cost would exceed $${maxDailyCostUsd}`);
  if(monthlyUsed+requestCost>maxMonthlyCostUsd)throw new Error(`BUDGET_GUARD: monthly cost would exceed $${maxMonthlyCostUsd}`);
  const rows=Array.isArray(task?.result)?task.result:[];
  const byKeyword=new Map(rows.map(row=>[key(row.keyword),row]));
  for(const keyword of toQuery){
    const k=key(keyword),row=byKeyword.get(k);
    if(!row)continue;
    cache.keywords[k]={keyword:row.keyword||keyword,searchVolume:num(row.search_volume),competition:row.competition||null,competitionIndex:num(row.competition_index),cpc:num(row.cpc),lowTopOfPageBid:num(row.low_top_of_page_bid),highTopOfPageBid:num(row.high_top_of_page_bid),monthlySearches:Array.isArray(row.monthly_searches)?row.monthly_searches.map(x=>({year:num(x.year),month:num(x.month),searchVolume:num(x.search_volume)})):[],checkedAt:now.toISOString()};
    for(const product of keywordToProducts.get(k)?.products||[]){applyRow(product,keyword,cache.keywords[k]);apiEnriched++;}
  }
  budget.events.push({at:now.toISOString(),provider:'DATAFORSEO_GOOGLE_ADS',costUsd:requestCost,keywordCount:toQuery.length,trialMode});
}else if(toQuery.length){skippedForBudget=true;}

budget.events=budget.events.filter(e=>now-new Date(e.at)<100*86400000).slice(-500);
budget.updatedAt=now.toISOString();
budget.guard={maxRequestCostUsd,maxDailyCostUsd,maxMonthlyCostUsd,cacheTtlDays};
budget.usage={dailyUsd:Number((dailyUsed+requestCost).toFixed(4)),monthlyUsd:Number((monthlyUsed+requestCost).toFixed(4))};
cache.updatedAt=now.toISOString();
cache.ttlDays=cacheTtlDays;

data.stats={...(data.stats||{}),keywordVerified:products.filter(p=>p.keywordDemand?.verifiedSearchVolume).length};
data.providerReadiness={...(data.providerReadiness||{}),dataForSEO:{...(data.providerReadiness?.dataForSEO||{}),ready:true,enabled:true,status:skippedForBudget?'BUDGET_GUARD_PAUSED':'ACTIVE',trialMode,lastKeywordEnrichmentAt:now.toISOString(),lastRequestCostUsd:requestCost,lastKeywordCount:toQuery.length,lastEnrichedProducts:apiEnriched,cacheHits,budgetGuard:{maxKeywords,maxRequestCostUsd,maxDailyCostUsd,maxMonthlyCostUsd,cacheTtlDays,dailyUsedUsd:budget.usage.dailyUsd,monthlyUsedUsd:budget.usage.monthlyUsd}}};
data.updatedAt=now.toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2)+'\n');
await fs.writeFile(BUDGET_FILE,JSON.stringify(budget,null,2)+'\n');
console.log(`DataForSEO keywords: ${apiEnriched} API enriched + ${cacheHits} cache hits; ${toQuery.length} paid keywords; API cost $${requestCost}; daily $${budget.usage.dailyUsd}/$${maxDailyCostUsd}; monthly $${budget.usage.monthlyUsd}/$${maxMonthlyCostUsd}; trial=${trialMode}; paused=${skippedForBudget}.`);
