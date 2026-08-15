import fs from 'node:fs/promises';
import { roProductName } from '../product-ro.js';

const FILE='market-intelligence-live.json';
const login=String(process.env.DATAFORSEO_LOGIN||'').trim();
const password=String(process.env.DATAFORSEO_PASSWORD||'').trim();
const enabled=!!(login&&password);
const trialMode=String(process.env.DATAFORSEO_TRIAL_MODE||'true').toLowerCase()!=='false';
const maxKeywords=Math.max(1,Math.min(1000,Number(process.env.DATAFORSEO_MAX_KEYWORDS||(trialMode?10:250))||10));
const maxRequestCostUsd=Math.max(0.01,Number(process.env.DATAFORSEO_MAX_REQUEST_COST_USD||(trialMode?0.10:0.25))||0.10);

function cleanKeyword(value=''){
  return String(value||'').replace(/[\u{1F300}-\u{1FAFF}]/gu,' ').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().split(' ').slice(0,10).join(' ').slice(0,80).trim();
}
function key(value=''){return cleanKeyword(value).toLocaleLowerCase('ro-RO');}
function num(v){return Number.isFinite(Number(v))?Number(v):null;}

let data;
try{data=JSON.parse(await fs.readFile(FILE,'utf8'));}catch{console.log('DataForSEO keywords: Market Intelligence dataset missing; skipped.');process.exit(0)}
if(!enabled){data.providerReadiness={...(data.providerReadiness||{}),dataForSEO:{...(data.providerReadiness?.dataForSEO||{}),ready:true,enabled:false,status:'CREDENTIALS_NOT_CONFIGURED'}};await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');console.log('DataForSEO keywords: disabled, no credentials configured; $0 usage.');process.exit(0)}

const products=Array.isArray(data.products)?data.products:[];
const candidates=products.slice().sort((a,b)=>Number(b.opportunityRanking?.score||b.launchScore?.score||0)-Number(a.opportunityRanking?.score||a.launchScore?.score||0));
const keywordMap=new Map();
for(const product of candidates){const keyword=cleanKeyword(roProductName(product.name));if(keyword&&!keywordMap.has(key(keyword)))keywordMap.set(key(keyword),keyword);if(keywordMap.size>=maxKeywords)break}
const keywords=[...keywordMap.values()];
if(!keywords.length){console.log('DataForSEO keywords: no valid Romanian keywords; skipped.');process.exit(0)}

const auth=Buffer.from(`${login}:${password}`).toString('base64');
const endpoint='https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/json'},body:JSON.stringify([{location_name:'Romania',language_name:'Romanian',keywords,search_partners:false,include_adult_keywords:false,sort_by:'relevance',tag:trialMode?'mega-product-radar-ro-trial':'mega-product-radar-ro'}])});
if(!response.ok)throw new Error(`DataForSEO HTTP ${response.status}`);
const payload=await response.json();
if(Number(payload?.status_code)!==20000)throw new Error(`DataForSEO API ${payload?.status_code||'UNKNOWN'} ${payload?.status_message||''}`.trim());
const task=Array.isArray(payload?.tasks)?payload.tasks[0]:null;
if(task&&Number(task.status_code)!==20000)throw new Error(`DataForSEO task ${task.status_code} ${task.status_message||''}`.trim());
const cost=num(payload?.cost)??num(task?.cost)??0;
if(cost>maxRequestCostUsd)throw new Error(`BUDGET_GUARD: request cost $${cost} exceeded configured cap $${maxRequestCostUsd}`);
const rows=Array.isArray(task?.result)?task.result:[];
const byKeyword=new Map(rows.map(row=>[key(row.keyword),row]));
let enriched=0;
for(const product of products){const keyword=cleanKeyword(roProductName(product.name));const row=byKeyword.get(key(keyword));if(!row)continue;const searchVolume=num(row.search_volume);const monthly=Array.isArray(row.monthly_searches)?row.monthly_searches.map(x=>({year:num(x.year),month:num(x.month),searchVolume:num(x.search_volume)})).filter(x=>x.searchVolume!==null):[];product.keywordDemand={...(product.keywordDemand||{}),provider:'DATAFORSEO_GOOGLE_ADS',verifiedSearchVolume:searchVolume!==null,keyword,searchVolume,competition:row.competition||null,competitionIndex:num(row.competition_index),cpc:num(row.cpc),lowTopOfPageBid:num(row.low_top_of_page_bid),highTopOfPageBid:num(row.high_top_of_page_bid),monthlySearches:monthly,checkedAt:new Date().toISOString(),note:'Volum și competiție Google Ads pentru România prin DataForSEO. Aceste date nu modifică automat verdictul TEST/CUMPĂRĂ până la calibrarea motorului.'};enriched++}
data.stats={...(data.stats||{}),keywordVerified:products.filter(p=>p.keywordDemand?.verifiedSearchVolume).length};
data.providerReadiness={...(data.providerReadiness||{}),dataForSEO:{...(data.providerReadiness?.dataForSEO||{}),ready:true,enabled:true,status:'ACTIVE',trialMode,lastKeywordEnrichmentAt:new Date().toISOString(),lastRequestCostUsd:cost,lastKeywordCount:keywords.length,lastEnrichedProducts:enriched,budgetGuard:{maxKeywords,maxRequestCostUsd}}};data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');console.log(`DataForSEO keywords: ${enriched}/${products.length} products enriched; ${keywords.length} keywords; API reported cost $${cost}; trial=${trialMode}.`);
