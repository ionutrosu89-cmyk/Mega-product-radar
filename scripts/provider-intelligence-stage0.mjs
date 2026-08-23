import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {normalizeProductKey} from './stage0-budget-brain.mjs';

const MARKET='market-intelligence-live.json';
const PROVIDER_OUT='provider-intelligence-live.json';
const supabaseUrl=String(process.env.MPR_SUPABASE_URL||'https://xqzsbebbuovcyeyxdqxo.supabase.co').replace(/\/+$/,'');
const publishableKey=String(process.env.MPR_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_G9AwfdhQB_5Y5tRguZ3Feg_TRR70Qcf').trim();
const original=JSON.parse(await fs.readFile(MARKET,'utf8'));
const allProducts=Array.isArray(original.products)?original.products:[];

async function fetchDeepTargets(){
  const response=await fetch(`${supabaseUrl}/rest/v1/rpc/stage0_deep_marketplace_targets`,{
    method:'POST',
    headers:{apikey:publishableKey,'content-type':'application/json','accept':'application/json'},
    body:'{}'
  });
  if(!response.ok)throw new Error(`Supabase deep-target RPC HTTP ${response.status}`);
  const payload=await response.json();
  if(!Array.isArray(payload))throw new Error('Supabase deep-target RPC returned a non-array payload');
  return payload.filter(t=>t&&['PROMISING','VALIDATE'].includes(String(t.status||'')));
}

let deepTargets=[];
try{
  deepTargets=await fetchDeepTargets();
}catch(error){
  await fs.writeFile(PROVIDER_OUT,JSON.stringify({
    version:'2.9',
    updatedAt:new Date().toISOString(),
    scope:'SUPABASE_STAGE0_DEEP_MARKETPLACE',
    providerStatus:'BLOCKED_DEEP_ALLOWLIST_UNAVAILABLE',
    scopedProductCount:0,
    totalMarketProductCount:allProducts.length,
    paidCalls:0,
    error:String(error?.message||error),
    policy:'Fail closed: no paid marketplace/deep-provider call is allowed unless the dedicated Supabase deep-marketplace allowlist is available.'
  },null,2)+'\n');
  console.log(`Stage 0 provider wrapper: deep allowlist unavailable; paid provider enrichment blocked: ${String(error?.message||error)}`);
  process.exit(0);
}

const targetByKey=new Map(deepTargets.map((t,index)=>[
  normalizeProductKey(t?.canonical_key||t?.title),
  {...t,deepProviderPriority:index+1}
]));
const eligible=allProducts
  .filter(p=>targetByKey.has(normalizeProductKey(p?.name)))
  .sort((a,b)=>targetByKey.get(normalizeProductKey(a?.name)).deepProviderPriority-targetByKey.get(normalizeProductKey(b?.name)).deepProviderPriority);

if(!eligible.length){
  await fs.writeFile(PROVIDER_OUT,JSON.stringify({
    version:'2.9',
    updatedAt:new Date().toISOString(),
    scope:'SUPABASE_STAGE0_DEEP_MARKETPLACE',
    providerStatus:'NO_DEEP_TARGETS',
    scopedProductCount:0,
    totalMarketProductCount:allProducts.length,
    paidCalls:0,
    policy:'No paid marketplace/deep-provider call is made when Supabase returns no eligible deep targets.'
  },null,2)+'\n');
  console.log('Stage 0 provider wrapper: no dedicated deep-marketplace targets; paid provider enrichment skipped.');
  process.exit(0);
}

const originalByKey=new Map(allProducts.map(p=>[normalizeProductKey(p?.name),p]));
// provider-intelligence-v26 allocates limited Amazon calls by goldenPipeline.rank.
// In the isolated deep-provider scope only, map the dedicated Supabase deep priority
// to that rank. The original Golden Pipeline rank is restored before persistence.
const scopedProducts=eligible.map((p,index)=>({
  ...p,
  goldenPipeline:{
    ...(p?.goldenPipeline||{}),
    rank:index+1,
    deepProviderPriority:index+1,
    deepProviderInformationValue:Number(targetByKey.get(normalizeProductKey(p?.name))?.information_value||0)||0
  }
}));
const scoped={...original,products:scopedProducts};
await fs.writeFile(MARKET,JSON.stringify(scoped,null,2)+'\n');

function runProvider(){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/provider-intelligence-v26.mjs'],{
      stdio:'inherit',
      env:{...process.env,V26_DEEP_PRODUCTS:String(Math.min(5,eligible.length))}
    });
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`provider-intelligence-v26 exited ${code}`)));
  });
}

try{
  await runProvider();
  const enriched=JSON.parse(await fs.readFile(MARKET,'utf8'));
  const byKey=new Map((Array.isArray(enriched.products)?enriched.products:[]).map(p=>[normalizeProductKey(p?.name),p]));
  const merged=allProducts.map(p=>{
    const enrichedProduct=byKey.get(normalizeProductKey(p?.name));
    if(!enrichedProduct)return p;
    return {...enrichedProduct,goldenPipeline:p?.goldenPipeline};
  });
  const finalData={...original,...enriched,products:merged};
  await fs.writeFile(MARKET,JSON.stringify(finalData,null,2)+'\n');

  try{
    const out=JSON.parse(await fs.readFile(PROVIDER_OUT,'utf8'));
    out.scope='SUPABASE_STAGE0_DEEP_MARKETPLACE';
    out.scopedProductCount=eligible.length;
    out.totalMarketProductCount=allProducts.length;
    out.deepPriorityOrder=eligible.map((p,index)=>({
      name:p?.name||'',
      status:targetByKey.get(normalizeProductKey(p?.name))?.status||p?.goldenPipeline?.stage||null,
      deepProviderPriority:index+1,
      informationValue:Number(targetByKey.get(normalizeProductKey(p?.name))?.information_value||0)||0
    }));
    out.items=(Array.isArray(out.items)?out.items:[]).map(item=>{
      const source=originalByKey.get(normalizeProductKey(item?.name));
      return {...item,rank:source?.goldenPipeline?.rank??item?.rank??null};
    });
    out.policy='Romania keyword enrichment and deep marketplace enrichment use separate Supabase allowlists. Paid deep-provider calls follow stage0_deep_marketplace_targets order in an isolated scope; original Golden Pipeline ranks are restored before results are persisted.';
    await fs.writeFile(PROVIDER_OUT,JSON.stringify(out,null,2)+'\n');
  }catch{}

  console.log(`Stage 0 provider wrapper: deep scope=${eligible.length}/${allProducts.length}; first=${eligible.slice(0,3).map((p,index)=>`${index+1}:${p?.name}`).join(' | ')}.`);
}catch(error){
  await fs.writeFile(MARKET,JSON.stringify(original,null,2)+'\n');
  throw error;
}
