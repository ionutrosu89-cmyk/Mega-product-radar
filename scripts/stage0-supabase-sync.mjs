import fs from 'node:fs/promises';

const AUDIT='stage0-budget-brain-live.json';
const MARKET='market-intelligence-live.json';
const GOLDEN='golden-pipeline-live.json';
const PROVIDER='provider-intelligence-live.json';
const PAID='paid-budget-live.json';
const OUT='stage0-supabase-sync-live.json';
const ENDPOINT='https://xqzsbebbuovcyeyxdqxo.supabase.co/functions/v1/stage0-sync';
const AUDIENCE='mega-product-radar-supabase';
const STAGE0_PRODUCT_CAP=100;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const finiteOrNull=v=>Number.isFinite(Number(v))?Number(v):null;
const arr=v=>Array.isArray(v)?v:[];
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function norm(v=''){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function firstUrl(p={}){
  const candidates=[p?.bestEvidence?.url,p?.bestEvidence?.directUrl,p?.sourceUrl,p?.url,p?.productUrl,p?.evidenceUrl,p?.source?.url];
  const hit=candidates.find(v=>/^https:\/\//i.test(String(v||'')));
  return hit?String(hit):null;
}
function imageUrl(p={}){
  const candidates=[p?.imageUrl,p?.image,p?.image_url,p?.thumbnail,p?.bestEvidence?.imageUrl];
  const hit=candidates.find(v=>/^https:\/\//i.test(String(v||'')));
  return hit?String(hit):null;
}
function safeStage(v){return ['PROMISING','VALIDATE'].includes(String(v||''))?String(v):'DISCOVERED';}
async function audit(status,extra={}){await fs.writeFile(OUT,JSON.stringify({version:'1.1',updatedAt:new Date().toISOString(),status,...extra},null,2)+'\n');}

const reqUrl=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
const reqToken=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');
if(!reqUrl||!reqToken){await audit('BLOCKED_OIDC_UNAVAILABLE');console.log('Stage 0 Supabase sync: GitHub OIDC unavailable; no write attempted.');process.exit(0)}

const market=await read(MARKET,{products:[]});
const golden=await read(GOLDEN,{items:[]});
const provider=await read(PROVIDER,{});
const paid=await read(PAID,{events:[]});
const budgetAudit=await read(AUDIT,{targets:[]});
const products=arr(market.products);
const goldenItems=arr(golden.items);
const goldenByKey=new Map(goldenItems.map(x=>[norm(x?.canonicalKey||x?.name||x?.title),x]));
const byKey=new Map(products.map(p=>[norm(p?.canonicalKey||p?.name||p?.title),p]));

const targetProducts=arr(budgetAudit.targets).map(t=>{
  const key=norm(t?.canonicalKey||t?.title); const p=byKey.get(key); if(!p)return null;
  const ro=p?.providerIntelligence?.romaniaDemand||p?.romaniaDemand||{};
  return {canonicalKey:key,keyword:ro?.bestKeyword||p?.keywordDemand?.keyword||null,searchVolume:num(ro?.bestKeywordVolume||p?.keywordDemand?.searchVolume),demandScore:num(ro?.score),longTermTrendPct:Number.isFinite(Number(ro?.trend12mPct))?Number(ro.trend12mPct):null,confidence:ro?.providerVerified===true?100:0,providerVerified:ro?.providerVerified===true,readyForTestDemandGate:ro?.readyForTestDemandGate===true};
}).filter(Boolean);

const pipeline=goldenItems.filter(x=>['PROMISING','VALIDATE'].includes(String(x?.stage||''))).slice(0,15).map((x,index)=>({canonicalKey:norm(x?.canonicalKey||x?.name||x?.title),title:x?.name||x?.title,stage:x?.stage,opportunityScore:num(x?.opportunityScore),evidenceConfidence:num(x?.confidence),priorityScore:Math.max(1,100-index)}));

const seen=new Set();
const catalogue=[];
for(const p of products){
  const key=norm(p?.canonicalKey||p?.name||p?.title);
  if(!key||seen.has(key))continue;
  seen.add(key);
  const g=goldenByKey.get(key)||{};
  const stage=safeStage(g?.stage);
  const sourceUrl=firstUrl(p);
  const sourceName=String(p?.marketplace||p?.sourceName||p?.source||p?.bestEvidence?.source||'MPR').slice(0,80);
  const externalId=String(p?.asin||p?.externalId||p?.sku||sourceUrl||key).slice(0,300);
  catalogue.push({
    canonicalKey:key,
    title:String(p?.name||p?.title||g?.name||key).slice(0,240),
    brand:String(p?.brand||'').slice(0,120)||null,
    category:String(p?.category||p?.cat||g?.category||'').slice(0,160)||null,
    imageUrl:imageUrl(p),
    status:stage,
    opportunityScore:finiteOrNull(g?.opportunityScore??p?.opportunityScore),
    evidenceConfidence:finiteOrNull(g?.confidence??p?.evidenceConfidence?.score??p?.dataConfidence),
    priorityScore:stage==='VALIDATE'?100:stage==='PROMISING'?70:20,
    alias:{source:sourceName,externalId,marketplace:String(p?.marketplace||'').slice(0,100)||null,title:String(p?.name||p?.title||'').slice(0,240)||null,url:sourceUrl},
    observation:{
      type:'PIPELINE_SNAPSHOT',
      sourceKey:'mpr_existing_pipeline',
      numericValue:finiteOrNull(g?.opportunityScore??p?.opportunityScore),
      textValue:stage,
      confidence:finiteOrNull(g?.confidence??p?.dataConfidence),
      rawRef:sourceUrl,
      payload:{commercialStage:stage,romaniaDemandReady:Boolean(p?.romaniaDemand?.readyForTestDemandGate||p?.providerIntelligence?.romaniaDemand?.readyForTestDemandGate),salesEstimateStatus:p?.salesEstimation?.status||null,salesEstimateConfidence:finiteOrNull(p?.salesEstimation?.confidence)}
    }
  });
  if(catalogue.length>=STAGE0_PRODUCT_CAP)break;
}

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
  const response=await fetch(ENDPOINT,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({runAt,providerCostEur,products:targetProducts,pipeline,catalogue})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`Supabase sync HTTP ${response.status}: ${body?.error||body?.message||'unknown'}`);
  await audit('SUCCESS',{runAt,providerCostEur,targetProducts:targetProducts.length,pipelineProducts:pipeline.length,catalogueProducts:catalogue.length,response:body});
  console.log(`Stage 0 Supabase sync: success, catalogue=${catalogue.length}, pipeline=${pipeline.length}, targets=${targetProducts.length}, observations=${body?.insertedObservations||0}, snapshots=${body?.insertedSnapshots||0}, costLogged=${Boolean(body?.costLogged)}.`);
}catch(error){
  await audit('FAILED',{runAt,providerCostEur,targetProducts:targetProducts.length,pipelineProducts:pipeline.length,catalogueProducts:catalogue.length,error:String(error?.message||error)});
  console.error(`Stage 0 Supabase sync failed: ${String(error?.message||error)}`);
  process.exitCode=1;
}
