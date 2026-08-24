import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {normalizeProductKey} from './stage0-budget-brain.mjs';
import {readStage0Targets} from './lib/stage0-secure-targets.mjs';

const MARKET='market-intelligence-live.json';
const PROVIDER_OUT='provider-intelligence-live.json';
const original=JSON.parse(await fs.readFile(MARKET,'utf8'));
const allProducts=Array.isArray(original.products)?original.products:[];

let deepTargets=[];
try{deepTargets=(await readStage0Targets('DEEP')).filter(t=>t&&['PROMISING','VALIDATE'].includes(String(t.status||'')));}
catch(error){await fs.writeFile(PROVIDER_OUT,JSON.stringify({version:'3.0-oidc',updatedAt:new Date().toISOString(),scope:'OIDC_STAGE0_DEEP_MARKETPLACE',providerStatus:'BLOCKED_DEEP_ALLOWLIST_UNAVAILABLE',scopedProductCount:0,totalMarketProductCount:allProducts.length,paidCalls:0,error:String(error?.message||error),policy:'Fail closed: no paid marketplace/deep-provider call is allowed unless the dedicated server-side OIDC deep-marketplace allowlist is available.'},null,2)+'\n');console.log(`Stage 0 provider wrapper: deep allowlist unavailable; paid provider enrichment blocked: ${String(error?.message||error)}`);process.exit(0);}

const targetByKey=new Map(deepTargets.map((t,index)=>[normalizeProductKey(t?.canonical_key||t?.title),{...t,deepProviderPriority:index+1}]));
const eligible=allProducts.filter(p=>targetByKey.has(normalizeProductKey(p?.name))).sort((a,b)=>targetByKey.get(normalizeProductKey(a?.name)).deepProviderPriority-targetByKey.get(normalizeProductKey(b?.name)).deepProviderPriority);

if(!eligible.length){await fs.writeFile(PROVIDER_OUT,JSON.stringify({version:'3.0-oidc',updatedAt:new Date().toISOString(),scope:'OIDC_STAGE0_DEEP_MARKETPLACE',providerStatus:'NO_DEEP_TARGETS',scopedProductCount:0,totalMarketProductCount:allProducts.length,paidCalls:0,policy:'No paid marketplace/deep-provider call is made when the secure Stage 0 service returns no eligible deep targets.'},null,2)+'\n');console.log('Stage 0 provider wrapper: no dedicated deep-marketplace targets; paid provider enrichment skipped.');process.exit(0);}

const originalByKey=new Map(allProducts.map(p=>[normalizeProductKey(p?.name),p]));
const scopedProducts=eligible.map((p,index)=>({...p,goldenPipeline:{...(p?.goldenPipeline||{}),rank:index+1,deepProviderPriority:index+1,deepProviderInformationValue:Number(targetByKey.get(normalizeProductKey(p?.name))?.information_value||0)||0}}));
await fs.writeFile(MARKET,JSON.stringify({...original,products:scopedProducts},null,2)+'\n');

function runProvider(){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/provider-intelligence-v26.mjs'],{stdio:'inherit',env:{...process.env,V26_DEEP_PRODUCTS:String(Math.min(5,eligible.length))}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`provider-intelligence-v26 exited ${code}`)));});}

try{
  await runProvider();
  const enriched=JSON.parse(await fs.readFile(MARKET,'utf8'));
  const byKey=new Map((Array.isArray(enriched.products)?enriched.products:[]).map(p=>[normalizeProductKey(p?.name),p]));
  const merged=allProducts.map(p=>{const enrichedProduct=byKey.get(normalizeProductKey(p?.name));if(!enrichedProduct)return p;return {...enrichedProduct,goldenPipeline:p?.goldenPipeline};});
  await fs.writeFile(MARKET,JSON.stringify({...original,...enriched,products:merged},null,2)+'\n');
  try{
    const out=JSON.parse(await fs.readFile(PROVIDER_OUT,'utf8'));
    out.scope='OIDC_STAGE0_DEEP_MARKETPLACE';out.scopedProductCount=eligible.length;out.totalMarketProductCount=allProducts.length;out.authorization='GITHUB_OIDC_EDGE';
    out.deepPriorityOrder=eligible.map((p,index)=>({name:p?.name||'',status:targetByKey.get(normalizeProductKey(p?.name))?.status||p?.goldenPipeline?.stage||null,deepProviderPriority:index+1,informationValue:Number(targetByKey.get(normalizeProductKey(p?.name))?.information_value||0)||0}));
    out.items=(Array.isArray(out.items)?out.items:[]).map(item=>{const source=originalByKey.get(normalizeProductKey(item?.name));return {...item,rank:source?.goldenPipeline?.rank??item?.rank??null};});
    out.policy='Romania keyword enrichment and deep marketplace enrichment use separate server-side OIDC allowlists. Paid deep-provider calls follow secure deep-target order; original Golden Pipeline ranks are restored before persistence.';
    await fs.writeFile(PROVIDER_OUT,JSON.stringify(out,null,2)+'\n');
  }catch{}
  console.log(`Stage 0 provider wrapper: deep scope=${eligible.length}/${allProducts.length}; first=${eligible.slice(0,3).map((p,index)=>`${index+1}:${p?.name}`).join(' | ')}.`);
}catch(error){await fs.writeFile(MARKET,JSON.stringify(original,null,2)+'\n');throw error;}
