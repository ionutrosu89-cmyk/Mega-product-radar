import fs from 'node:fs/promises';
import path from 'node:path';

const OUT='artifacts/dataforseo-alibaba-structured-discovery-pilot.json';
const TOTAL_CAP_USD=15;
const ROUND_CAP_USD=0.05;
const CONSERVATIVE_PREVIOUS_ACCOUNTED_USD=11.40064; // includes full possible Amazon Scale R1 cap
const MAX_COST_PER_REQUEST_USD=0.01;
const endpoint='https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
const balanceEndpoint='https://api.dataforseo.com/v3/appendix/user_data';
const queries=[
  'microfiber cleaning cloth wholesale Alibaba',
  'baby muslin blanket wholesale Alibaba',
  'car seat back protector wholesale Alibaba',
  'wrist support brace wholesale Alibaba',
  'camera bag wholesale Alibaba',
  'white noise machine wholesale Alibaba',
  'reusable silicone food storage bag wholesale Alibaba',
  'pet grooming glove wholesale Alibaba',
  'packing cubes travel wholesale Alibaba',
  'knee support sleeve wholesale Alibaba'
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
function allItems(node,out=[]){
  if(Array.isArray(node)){for(const x of node)allItems(x,out);return out;}
  if(node&&typeof node==='object'){
    if(typeof node.url==='string')out.push(node);
    for(const value of Object.values(node))if(value&&typeof value==='object')allItems(value,out);
  }
  return out;
}
function normalizeAlibabaUrl(raw){
  try{
    const u=new URL(raw);
    if(!/(^|\.)alibaba\.com$/i.test(u.hostname))return null;
    if(!/\/product-detail\//i.test(u.pathname))return null;
    u.hash='';
    for(const k of [...u.searchParams.keys()])if(/^spm$|^from$|^src$/i.test(k))u.searchParams.delete(k);
    return u.toString();
  }catch{return null;}
}
function externalId(url){return url.match(/_(\d{8,})\.html/i)?.[1]||null;}

const balanceDoc=await getUserData();
const balanceBeforeUsd=accountBalance(balanceDoc);
const requests=[];
const byUrl=new Map();
let spend=0;
for(const query of queries){
  if(spend+MAX_COST_PER_REQUEST_USD>ROUND_CAP_USD+1e-9)break;
  if(CONSERVATIVE_PREVIOUS_ACCOUNTED_USD+spend+MAX_COST_PER_REQUEST_USD>TOTAL_CAP_USD+1e-9)break;
  const doc=await post(endpoint,[{keyword:query,location_code:2840,language_code:'en',device:'desktop',depth:20}]);
  const task=doc?.tasks?.[0]||{};
  const cost=Number(task.cost)||0;
  if(cost<0||cost>MAX_COST_PER_REQUEST_USD+1e-9)throw new Error(`REQUEST_COST_OUT_OF_BOUNDS:${cost}`);
  spend+=cost;
  if(spend>ROUND_CAP_USD+1e-9)throw new Error(`ROUND_CAP_BREACH:${spend}`);
  const result=task?.result?.[0]||{};
  let newCandidates=0;
  for(const item of allItems(result.items||[])){
    const url=normalizeAlibabaUrl(item.url);
    if(!url||byUrl.has(url))continue;
    byUrl.set(url,{platform:'ALIBABA',externalId:externalId(url),url,title:item.title||null,sourceQuery:query,discoverySource:'DATAFORSEO_GOOGLE_ORGANIC_SERP',evidenceClass:'SUPPLIER_CANDIDATE_DISCOVERY_ONLY'});
    newCandidates++;
  }
  requests.push({query,costUsd:cost,newCandidates,totalCandidates:byUrl.size,statusCode:task.status_code||null,statusMessage:task.status_message||null});
}
const generatedAt=new Date().toISOString();
const payload={
  schemaVersion:'MPR_STRUCTURED_SUPPLIER_DISCOVERY_V1',generatedAt,provider:'DATAFORSEO',endpoint,queriesPlanned:queries.length,requestsTriggered:requests.length,providerReportedSpendUsd:Number(spend.toFixed(8)),roundSpendCapUsd:ROUND_CAP_USD,totalProjectSpendCapUsd:TOTAL_CAP_USD,conservativePreviousAccountedSpendUsd:CONSERVATIVE_PREVIOUS_ACCOUNTED_USD,totalConservativeAccountedAfterRunUsd:Number((CONSERVATIVE_PREVIOUS_ACCOUNTED_USD+spend).toFixed(8)),accountBalanceBeforeUsd:balanceBeforeUsd,uniqueSupplierCandidates:byUrl.size,observations:[...byUrl.values()],requests,truthPolicy:{candidateIsSupplierPriceEvidence:false,candidateIsMarketplaceMatch:false,verifiedQuote:false,landedCostConfirmed:false,verifiedSales:false,unknownEqualsZero:false,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({out:OUT,requestsTriggered:payload.requestsTriggered,spendUsd:payload.providerReportedSpendUsd,uniqueSupplierCandidates:payload.uniqueSupplierCandidates,totalConservativeAccountedAfterRunUsd:payload.totalConservativeAccountedAfterRunUsd},null,2));
