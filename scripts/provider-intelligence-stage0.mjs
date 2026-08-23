import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {normalizeProductKey} from './stage0-budget-brain.mjs';

const MARKET='market-intelligence-live.json';
const PROVIDER_OUT='provider-intelligence-live.json';
const original=JSON.parse(await fs.readFile(MARKET,'utf8'));
const allProducts=Array.isArray(original.products)?original.products:[];
const eligible=allProducts
  .filter(p=>p?.goldenPipeline?.paidDataEligible===true)
  .sort((a,b)=>{
    const ap=Number(a?.goldenPipeline?.paidDataPriority||999999);
    const bp=Number(b?.goldenPipeline?.paidDataPriority||999999);
    if(ap!==bp)return ap-bp;
    const as=Number(a?.goldenPipeline?.score||a?.opportunityScore||0);
    const bs=Number(b?.goldenPipeline?.score||b?.opportunityScore||0);
    if(as!==bs)return bs-as;
    return String(a?.name||'').localeCompare(String(b?.name||''));
  });

if(!eligible.length){
  console.log('Stage 0 provider wrapper: no Budget Brain eligible products; paid provider enrichment skipped.');
  process.exit(0);
}

const originalByKey=new Map(allProducts.map(p=>[normalizeProductKey(p?.name),p]));
// provider-intelligence-v26 currently allocates limited Amazon calls by goldenPipeline.rank.
// In the isolated Stage 0 scope only, map Budget Brain paidDataPriority to that rank so
// scarce paid calls follow the authorized order. The original Golden Pipeline rank is
// restored before any result is merged back into the full market dataset.
const scopedProducts=eligible.map((p,index)=>({
  ...p,
  goldenPipeline:{
    ...(p?.goldenPipeline||{}),
    rank:Number(p?.goldenPipeline?.paidDataPriority||index+1)
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
    out.scope='SUPABASE_STAGE0_BUDGET_BRAIN';
    out.scopedProductCount=eligible.length;
    out.totalMarketProductCount=allProducts.length;
    out.priorityOrder=eligible.map(p=>({
      name:p?.name||'',
      paidDataPriority:Number(p?.goldenPipeline?.paidDataPriority||999999)
    }));
    out.items=(Array.isArray(out.items)?out.items:[]).map(item=>{
      const source=originalByKey.get(normalizeProductKey(item?.name));
      return {...item,rank:source?.goldenPipeline?.rank??item?.rank??null};
    });
    out.policy='Paid deep provider enrichment is executed only against the current Supabase Stage 0 Budget Brain allowlist. Limited provider calls follow paidDataPriority in an isolated scope; original Golden Pipeline ranks are restored before results are persisted.';
    await fs.writeFile(PROVIDER_OUT,JSON.stringify(out,null,2)+'\n');
  }catch{}

  console.log(`Stage 0 provider wrapper: enriched scope=${eligible.length}/${allProducts.length}; first=${eligible.slice(0,3).map(p=>`${p?.goldenPipeline?.paidDataPriority}:${p?.name}`).join(' | ')}.`);
}catch(error){
  await fs.writeFile(MARKET,JSON.stringify(original,null,2)+'\n');
  throw error;
}
