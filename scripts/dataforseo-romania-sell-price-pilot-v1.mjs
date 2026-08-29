import fs from 'node:fs/promises';
import path from 'node:path';

const OUT='artifacts/dataforseo-romania-sell-price-pilot-v1.json';
const TOTAL_CAP_USD=15;
const ROUND_CAP_USD=0.04;
// Conservative accounting intentionally exceeds known actual spend so this pilot cannot consume hidden headroom.
const CONSERVATIVE_PREVIOUS_ACCOUNTED_USD=11.43864;
const MAX_COST_PER_REQUEST_USD=0.01;
const endpoint='https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
const balanceEndpoint='https://api.dataforseo.com/v3/appendix/user_data';
const queries=[
  'organizator birou metal 5 niveluri sertar 2 suporturi pixuri',
  'organizator documente metal 5 tavi sertar suport pixuri',
  'organizator birou plasa metalica 5 etaje sertar doua suporturi',
  '"5 tier" desk organizer drawer "pen holders" Romania'
];

const login=process.env.DATAFORSEO_LOGIN||process.env.DATAFORSEO_API_LOGIN;
const password=process.env.DATAFORSEO_PASSWORD||process.env.DATAFORSEO_API_PASSWORD;
if(!login||!password)throw new Error('DATAFORSEO_CREDENTIALS_MISSING');
const auth='Basic '+Buffer.from(`${login}:${password}`).toString('base64');

async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`HTTP_${r.status}:${text.slice(0,500)}`);
  return JSON.parse(text);
}
async function getUserData(){
  const r=await fetch(balanceEndpoint,{headers:{authorization:auth},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`BALANCE_HTTP_${r.status}`);
  return r.json();
}
function accountBalance(doc){
  const task=doc?.tasks?.[0];
  const data=task?.result?.[0];
  const candidates=[data?.money?.balance,data?.balance,doc?.balance];
  return candidates.map(Number).find(Number.isFinite)??null;
}
function organicItems(result){
  return (result?.items||[]).filter(x=>x&&typeof x==='object'&&x.type==='organic'&&typeof x.url==='string');
}
function normalizeUrl(raw){
  try{const u=new URL(raw);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|gclid|fbclid)/i.test(k))u.searchParams.delete(k);return u.toString();}catch{return null;}
}
function extractRonPrice(text){
  const s=String(text||'').replace(/\u00a0/g,' ');
  const patterns=[
    /(?:RON|lei)\s*[:\-]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/ig,
    /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:RON|lei)\b/ig
  ];
  const found=[];
  for(const re of patterns){for(const m of s.matchAll(re)){const n=Number(String(m[1]).replace(',','.'));if(Number.isFinite(n)&&n>0&&n<10000)found.push(n);}}
  return found.length?[...new Set(found)].sort((a,b)=>a-b):[];
}
function evidenceTokens(text){
  const s=String(text||'').toLowerCase();
  return {
    metal:/\bmetal|metallic|mesh|plasa metalica|plasă metalică/.test(s),
    fiveTier:/\b5\s*(?:tier|nivel|nivele|etaj|etaje|tavi|tăvi)|cinci\s*(?:nivel|etaj|tavi|tăvi)/.test(s),
    drawer:/\bsertar|drawer/.test(s),
    penHolder:/\b(?:pix|pixuri|stilou|stilouri|pen holder|pencil holder|suport.*pix)/.test(s),
    organizer:/\borganizator|organizer|documente|document|desk organizer/.test(s)
  };
}
function fingerprintEvidenceScore(tokens){return Object.values(tokens).filter(Boolean).length;}

const balanceBeforeDoc=await getUserData();
const balanceBeforeUsd=accountBalance(balanceBeforeDoc);
const requests=[];
const byUrl=new Map();
let spend=0;
for(const query of queries){
  if(spend+MAX_COST_PER_REQUEST_USD>ROUND_CAP_USD+1e-9)break;
  if(CONSERVATIVE_PREVIOUS_ACCOUNTED_USD+spend+MAX_COST_PER_REQUEST_USD>TOTAL_CAP_USD+1e-9)break;
  const doc=await post(endpoint,[{keyword:query,location_code:2642,language_code:'ro',device:'desktop',depth:30}]);
  const task=doc?.tasks?.[0]||{};
  const cost=Number(task.cost)||0;
  if(cost<0||cost>MAX_COST_PER_REQUEST_USD+1e-9)throw new Error(`REQUEST_COST_OUT_OF_BOUNDS:${cost}`);
  spend+=cost;
  if(spend>ROUND_CAP_USD+1e-9)throw new Error(`ROUND_CAP_BREACH:${spend}`);
  let newCandidates=0;
  for(const item of organicItems(task?.result?.[0])){
    const url=normalizeUrl(item.url);if(!url||byUrl.has(url))continue;
    const evidenceText=[item.title,item.description,item.pre_snippet,item.extended_snippet].filter(Boolean).join(' ');
    const tokens=evidenceTokens(evidenceText);
    const prices=extractRonPrice(evidenceText);
    byUrl.set(url,{
      url,title:item.title||null,description:item.description||null,domain:item.domain||null,rankAbsolute:item.rank_absolute??null,
      sourceQuery:query,discoverySource:'DATAFORSEO_GOOGLE_ORGANIC_SERP_ROMANIA',evidenceClass:'ROMANIA_SELL_SIDE_CANDIDATE_DISCOVERY_ONLY',
      ronPricesObservedInSerpText:prices,fingerprintEvidenceTokens:tokens,fingerprintEvidenceScore:fingerprintEvidenceScore(tokens),
      currentSellPriceVerified:false,exactProductVerified:false
    });
    newCandidates++;
  }
  requests.push({query,costUsd:cost,newCandidates,totalCandidates:byUrl.size,statusCode:task.status_code||null,statusMessage:task.status_message||null});
}
const observations=[...byUrl.values()].sort((a,b)=>b.fingerprintEvidenceScore-a.fingerprintEvidenceScore||Number(a.rankAbsolute??9999)-Number(b.rankAbsolute??9999));
const priceBearingCandidates=observations.filter(x=>x.ronPricesObservedInSerpText.length>0).length;
const strongFingerprintCandidates=observations.filter(x=>x.fingerprintEvidenceScore>=4).length;
const generatedAt=new Date().toISOString();
const payload={
  schemaVersion:'MPR_ROMANIA_SELL_PRICE_DISCOVERY_PILOT_V1',generatedAt,provider:'DATAFORSEO',endpoint,market:'RO',locationCode:2642,languageCode:'ro',
  targetFingerprint:{productType:'desktop document organizer',material:'metal',tiers:5,drawer:true,penHolders:2,targetAmazonAsin:'B09K5927B5',targetSupplierListingKey:'1601573810318'},
  queriesPlanned:queries.length,requestsTriggered:requests.length,providerReportedSpendUsd:Number(spend.toFixed(8)),roundSpendCapUsd:ROUND_CAP_USD,totalProjectSpendCapUsd:TOTAL_CAP_USD,
  conservativePreviousAccountedSpendUsd:CONSERVATIVE_PREVIOUS_ACCOUNTED_USD,totalConservativeAccountedAfterRunUsd:Number((CONSERVATIVE_PREVIOUS_ACCOUNTED_USD+spend).toFixed(8)),accountBalanceBeforeUsd:balanceBeforeUsd,
  uniqueCandidates:observations.length,priceBearingCandidates,strongFingerprintCandidates,observations,requests,
  decision:'DISCOVERY_ONLY_REQUIRES_PAGE_OR_STRUCTURED_PRICE_VERIFICATION',
  truthPolicy:{serpSnippetPriceIsCurrentSellPrice:false,candidateIsExactProduct:false,similarProductIsCanonicalMatch:false,stalePriceIsCurrent:false,unknownEqualsZero:false,verifiedSales:false,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({out:OUT,requestsTriggered:payload.requestsTriggered,spendUsd:payload.providerReportedSpendUsd,uniqueCandidates:payload.uniqueCandidates,priceBearingCandidates,strongFingerprintCandidates,totalConservativeAccountedAfterRunUsd:payload.totalConservativeAccountedAfterRunUsd},null,2));
