import fs from 'node:fs';
import path from 'node:path';

const arg=(name,fallback=null)=>{const hit=process.argv.find(x=>x.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const round6=n=>Math.round((Number(n)||0)*1e6)/1e6;
const asinRe=/^[A-Z0-9]{10}$/;
const cleanAsin=v=>{const s=String(v??'').trim().toUpperCase();return asinRe.test(s)?s:null;};
const readJson=(p,fallback={})=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return fallback;}};

const configPath=arg('config','data/dataforseo-amazon-100k-discovery-v1.json');
const outPath=arg('out','artifacts/dataforseo-amazon-100k-discovery.json');
const dryRun=String(arg('dryRun',process.env.MPR_DATAFORSEO_DRY_RUN||'false')).toLowerCase()==='true';
const cfg=readJson(configPath,null);
if(!cfg)throw new Error('DISCOVERY_CONFIG_MISSING');
if(cfg.truthPolicy?.evidenceClass!=='DISCOVERY_ONLY')throw new Error('TRUTH_POLICY_INVALID: discovery must remain DISCOVERY_ONLY');
if(cfg.truthPolicy?.salesEvidenceClass!=='NOT_VERIFIED_SALES'||Number(cfg.truthPolicy?.verifiedSalesRows)!==0)throw new Error('TRUTH_POLICY_INVALID: discovery is not verified sales');
if(cfg.truthPolicy?.purchaseAuthorized!==false)throw new Error('PURCHASE_POLICY_INVALID');
if(!(Number(cfg.maxSpendUsd)>0&&Number(cfg.maxSpendUsd)<=15))throw new Error('SPEND_CAP_INVALID');
if(!(Number(cfg.conservativeMaxCostPerRequestUsd)>0))throw new Error('CONSERVATIVE_REQUEST_COST_REQUIRED');
if(Number(cfg.maxRequests)*Number(cfg.conservativeMaxCostPerRequestUsd)>Number(cfg.maxSpendUsd)+1e-9)throw new Error('PLAN_CAN_EXCEED_TOTAL_SPEND_CAP');

const login=process.env.DATAFORSEO_LOGIN||process.env.DATAFORSEO_API_LOGIN||'';
const password=process.env.DATAFORSEO_PASSWORD||process.env.DATAFORSEO_API_PASSWORD||'';
const auth='Basic '+Buffer.from(`${login}:${password}`).toString('base64');
const base='https://api.dataforseo.com';

function historicalAccountedSpend(){
  const cap=readJson('paid-budget-cap.json',{});
  const explicit=Number(cap.spentUsd);
  if(Number.isFinite(explicit)&&explicit>=0)return round6(explicit);
  const provider=(Array.isArray(cap.providerEvents)?cap.providerEvents:[]).reduce((s,e)=>s+(Number(e?.costUsd)||0),0);
  const keyword=Number(cap.keywordAccountedUsd);
  if(Number.isFinite(keyword)&&keyword>=0)return round6(provider+keyword);
  const keywordLedger=readJson('paid-budget-live.json',{events:[]});
  const start=new Date(cap.startedAt||0).getTime();
  const keywordFallback=(Array.isArray(keywordLedger.events)?keywordLedger.events:[])
    .filter(e=>new Date(e?.at||0).getTime()>=start)
    .reduce((s,e)=>s+(Number(e?.costUsd)||0),0);
  return round6(provider+keywordFallback);
}

async function api(endpoint,{method='GET',body=null}={}){
  const res=await fetch(base+endpoint,{method,headers:{Authorization:auth,'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)});
  const text=await res.text();let json;
  try{json=JSON.parse(text);}catch{throw new Error(`DATAFORSEO_NON_JSON_HTTP_${res.status}`);}
  if(!res.ok)throw new Error(`DATAFORSEO_HTTP_${res.status}: ${json?.status_message||'request failed'}`);
  if(Number(json.status_code)!==20000)throw new Error(`DATAFORSEO_STATUS_${json.status_code}: ${json.status_message||'unknown'}`);
  return json;
}
function taskCost(response){const top=Number(response?.cost);const nested=(response?.tasks||[]).reduce((s,t)=>s+(Number(t?.cost)||0),0);return round6(Number.isFinite(top)&&top>0?top:nested);}
function accountBalance(userData){const n=Number(userData?.tasks?.[0]?.result?.[0]?.money?.balance);return Number.isFinite(n)?n:null;}

function extractProducts(response,seedAsin){
  const found=new Map();
  const visit=(node,context={})=>{
    if(Array.isArray(node)){for(const x of node)visit(x,context);return;}
    if(!node||typeof node!=='object')return;
    const direct=cleanAsin(node.asin);
    const nextContext={title:typeof node.title==='string'?node.title:context.title||null,price:Number.isFinite(Number(node.price?.current))?Number(node.price.current):(Number.isFinite(Number(node.price))?Number(node.price):context.price??null),rating:Number.isFinite(Number(node.rating?.value))?Number(node.rating.value):(Number.isFinite(Number(node.rating))?Number(node.rating):context.rating??null),reviews:Number.isFinite(Number(node.rating?.votes_count))?Number(node.rating.votes_count):(Number.isFinite(Number(node.reviews_count))?Number(node.reviews_count):context.reviews??null)};
    if(direct&&!found.has(direct))found.set(direct,{asin:direct,...nextContext,sourceSeedAsin:seedAsin});
    for(const [k,v] of Object.entries(node)){if(k==='asin'||k==='tasks'||k==='data')continue;if(v&&typeof v==='object')visit(v,nextContext);}
  };
  for(const task of response?.tasks||[])for(const result of task?.result||[])visit(result,{});
  return [...found.values()];
}
function simulatedResponse(seed,index){const items=[];for(let i=0;i<25;i++){const suffix=(index*25+i).toString(36).toUpperCase().padStart(8,'0').slice(-8);items.push({asin:`B0${suffix}`.slice(0,10),title:`Dry Run Product ${index}-${i}`});}return{status_code:20000,cost:0,tasks:[{cost:0,result:[{items}]}],seed};}

async function main(){
  const priorAccountedSpendUsd=historicalAccountedSpend();
  const totalCapUsd=Number(cfg.maxSpendUsd);
  const remainingTotalAuthorizationUsd=round6(Math.max(0,totalCapUsd-priorAccountedSpendUsd));
  let balance=null;
  let effectiveBudget=remainingTotalAuthorizationUsd;
  if(!dryRun){
    if(!login||!password)throw new Error('DATAFORSEO_CREDENTIALS_MISSING: configure repository secrets DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (or API aliases)');
    const user=await api(cfg.balanceEndpoint);
    balance=accountBalance(user);
    if(balance===null)throw new Error('DATAFORSEO_BALANCE_UNKNOWN: fail closed before paid calls');
    if(balance<=0)throw new Error(`DATAFORSEO_INSUFFICIENT_BALANCE: ${balance}`);
    if(remainingTotalAuthorizationUsd<=0)throw new Error(`DATAFORSEO_TOTAL_AUTHORIZATION_EXHAUSTED: historical=${priorAccountedSpendUsd} cap=${totalCapUsd}`);
    effectiveBudget=Math.min(remainingTotalAuthorizationUsd,balance);
  }

  const queue=[],queued=new Set();
  for(const raw of cfg.seedAsins||[]){const a=cleanAsin(raw);if(a&&!queued.has(a)){queue.push(a);queued.add(a);}}
  const products=new Map();let cursor=0,requests=0,spent=0;const requestLedger=[];
  const maxRequests=Math.min(Number(cfg.maxRequests)||0,Math.floor(effectiveBudget/Number(cfg.conservativeMaxCostPerRequestUsd)));
  while(cursor<queue.length&&requests<maxRequests&&products.size<Number(cfg.targetUniqueProducts)){
    if(priorAccountedSpendUsd+spent+Number(cfg.conservativeMaxCostPerRequestUsd)>totalCapUsd+1e-9)break;
    if(spent+Number(cfg.conservativeMaxCostPerRequestUsd)>effectiveBudget+1e-9)break;
    const seed=queue[cursor++];
    const response=dryRun?simulatedResponse(seed,requests):await api(cfg.endpoint,{method:'POST',body:[{asin:seed,location_code:Number(cfg.locationCode),language_code:String(cfg.languageCode),limit:Number(cfg.itemsPerRequest),tag:`mpr100k-${requests+1}-${seed}`}]});
    const cost=dryRun?0:taskCost(response);spent=round6(spent+cost);
    if(priorAccountedSpendUsd+spent>totalCapUsd+1e-9)throw new Error(`TOTAL_SPEND_CAP_BREACH_DETECTED: prior=${priorAccountedSpendUsd} run=${spent}`);
    requests++;
    const batch=extractProducts(response,seed);let added=0;
    for(const p of batch){if(!products.has(p.asin)){products.set(p.asin,p);added++;}if(!queued.has(p.asin)&&queue.length<Number(cfg.targetUniqueProducts)+Number(cfg.maxRequests)){queued.add(p.asin);queue.push(p.asin);}}
    requestLedger.push({request:requests,seedAsin:seed,costUsd:cost,discoveredInResponse:batch.length,newUniqueProducts:added,cumulativeUniqueProducts:products.size,cumulativeRunSpendUsd:spent,cumulativeTotalAccountedUsd:round6(priorAccountedSpendUsd+spent)});
    console.log(JSON.stringify(requestLedger.at(-1)));
    if(batch.length===0&&cursor>=queue.length)break;
  }
  const stopReason=products.size>=Number(cfg.targetUniqueProducts)?'TARGET_REACHED':requests>=maxRequests?'REQUEST_BUDGET_BOUND_REACHED':priorAccountedSpendUsd+spent+Number(cfg.conservativeMaxCostPerRequestUsd)>totalCapUsd+1e-9?'TOTAL_SPEND_GUARD_STOP':spent+Number(cfg.conservativeMaxCostPerRequestUsd)>effectiveBudget+1e-9?'BALANCE_OR_AUTHORIZATION_GUARD_STOP':cursor>=queue.length?'DISCOVERY_QUEUE_EXHAUSTED':'STOPPED';
  const output={schemaVersion:'MPR_DATAFORSEO_AMAZON_DISCOVERY_RUN_V1',generatedAt:new Date().toISOString(),dryRun,targetUniqueProducts:Number(cfg.targetUniqueProducts),uniqueProducts:products.size,targetReached:products.size>=Number(cfg.targetUniqueProducts),requestsTriggered:requests,providerReportedSpendUsd:spent,historicalAccountedSpendUsd:priorAccountedSpendUsd,totalAccountedSpendAfterRunUsd:round6(priorAccountedSpendUsd+spent),accountBalanceBeforeUsd:balance,configuredTotalSpendCapUsd:totalCapUsd,remainingTotalAuthorizationBeforeRunUsd,effectiveRunSpendCapUsd:effectiveBudget,stopReason,products:[...products.values()],requestLedger,truthPolicy:{evidenceClass:'DISCOVERY_ONLY',rankingEligible:false,demandConfirmed:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,romaniaGapExact:false,supplierQuoteVerified:false,landedCostConfirmed:false,purchaseAuthorized:false},note:'Unique ASIN discovery is catalogue discovery only. It is not verified demand, verified sales, exact Romania competition, supplier quote, landed cost, PROMISING, VALIDATE or FINALIST evidence.'};
  fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(output,null,2));
  console.log(JSON.stringify({out:outPath,uniqueProducts:output.uniqueProducts,targetReached:output.targetReached,requests,runSpendUsd:spent,priorSpendUsd:priorAccountedSpendUsd,totalSpendAfterRunUsd:output.totalAccountedSpendAfterRunUsd,stopReason},null,2));
}
await main();
