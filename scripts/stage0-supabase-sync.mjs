import fs from 'node:fs/promises';

const AUDIT='stage0-budget-brain-live.json';
const MARKET='market-intelligence-live.json';
const GOLDEN='golden-pipeline-live.json';
const PROVIDER='provider-intelligence-live.json';
const PAID='paid-budget-live.json';
const OUT='stage0-supabase-sync-live.json';
const ENDPOINT='https://xqzsbebbuovcyeyxdqxo.supabase.co/functions/v1/stage0-sync';
const AUDIENCE='mega-product-radar-supabase';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const arr=v=>Array.isArray(v)?v:[];
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function norm(v=''){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
async function audit(status,extra={}){await fs.writeFile(OUT,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),status,...extra},null,2)+'\n');}

const reqUrl=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
const reqToken=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');
if(!reqUrl||!reqToken){await audit('BLOCKED_OIDC_UNAVAILABLE');console.log('Stage 0 Supabase sync: GitHub OIDC unavailable; no write attempted.');process.exit(0)}

const market=await read(MARKET,{products:[]});
const golden=await read(GOLDEN,{items:[]});
const provider=await read(PROVIDER,{});
const paid=await read(PAID,{events:[]});
const budgetAudit=await read(AUDIT,{targets:[]});
const products=arr(market.products);
const byKey=new Map(products.map(p=>[norm(p?.canonicalKey||p?.name),p]));
const targetProducts=arr(budgetAudit.targets).map(t=>{
  const key=norm(t?.canonicalKey||t?.title); const p=byKey.get(key); if(!p)return null;
  const ro=p?.providerIntelligence?.romaniaDemand||p?.romaniaDemand||{};
  return {canonicalKey:key,keyword:ro?.bestKeyword||p?.keywordDemand?.keyword||null,searchVolume:num(ro?.bestKeywordVolume||p?.keywordDemand?.searchVolume),demandScore:num(ro?.score),longTermTrendPct:Number.isFinite(Number(ro?.trend12mPct))?Number(ro.trend12mPct):null,confidence:ro?.providerVerified===true?100:0,providerVerified:ro?.providerVerified===true,readyForTestDemandGate:ro?.readyForTestDemandGate===true};
}).filter(Boolean);
const pipeline=arr(golden.items).filter(x=>['PROMISING','VALIDATE'].includes(String(x?.stage||''))).slice(0,15).map((x,index)=>({canonicalKey:norm(x?.name),title:x?.name,stage:x?.stage,opportunityScore:num(x?.opportunityScore),evidenceConfidence:num(x?.confidence),priorityScore:Math.max(1,100-index)}));
const runAt=String(provider?.updatedAt||budgetAudit?.updatedAt||new Date().toISOString());
const providerCost=num(provider?.stats?.accountedCostUsd??provider?.stats?.runCostUsd);
const auditAt=new Date(budgetAudit?.updatedAt||0).getTime();
const lastKeyword=arr(paid.events).filter(e=>e?.provider==='DATAFORSEO_GOOGLE_ADS').at(-1);
const keywordCost=new Date(lastKeyword?.at||0).getTime()>=auditAt?num(lastKeyword?.costUsd):0;
const providerCostEur=Math.round((providerCost+keywordCost)*10000)/10000;

try{
  const oidcResp=await fetch(`${reqUrl}${reqUrl.includes('?')?'&':'?'}audience=${encodeURIComponent(AUDIENCE)}`,{headers:{authorization:`Bearer ${reqToken}`}});
  if(!oidcResp.ok)throw new Error(`OIDC HTTP ${oidcResp.status}`);
  const oidc=await oidcResp.json(); const token=String(oidc?.value||''); if(!token)throw new Error('OIDC token missing');
  const response=await fetch(ENDPOINT,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({runAt,providerCostEur,products:targetProducts,pipeline})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`Supabase sync HTTP ${response.status}: ${body?.error||body?.message||'unknown'}`);
  await audit('SUCCESS',{runAt,providerCostEur,targetProducts:targetProducts.length,pipelineProducts:pipeline.length,response:body});
  console.log(`Stage 0 Supabase sync: success, pipeline=${pipeline.length}, targets=${targetProducts.length}, snapshots=${body?.insertedSnapshots||0}, costLogged=${Boolean(body?.costLogged)}.`);
}catch(error){
  await audit('FAILED',{runAt,providerCostEur,targetProducts:targetProducts.length,pipelineProducts:pipeline.length,error:String(error?.message||error)});
  console.error(`Stage 0 Supabase sync failed: ${String(error?.message||error)}`);
  process.exitCode=1;
}
