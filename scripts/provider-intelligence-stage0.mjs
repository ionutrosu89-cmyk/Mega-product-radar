import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {normalizeProductKey} from './stage0-budget-brain.mjs';

const MARKET='market-intelligence-live.json';
const PROVIDER_OUT='provider-intelligence-live.json';
const original=JSON.parse(await fs.readFile(MARKET,'utf8'));
const allProducts=Array.isArray(original.products)?original.products:[];
const eligible=allProducts.filter(p=>p?.goldenPipeline?.paidDataEligible===true);

if(!eligible.length){
  console.log('Stage 0 provider wrapper: no Budget Brain eligible products; paid provider enrichment skipped.');
  process.exit(0);
}

const scoped={...original,products:eligible};
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
  const merged=allProducts.map(p=>byKey.get(normalizeProductKey(p?.name))||p);
  const finalData={...original,...enriched,products:merged};
  await fs.writeFile(MARKET,JSON.stringify(finalData,null,2)+'\n');

  try{
    const out=JSON.parse(await fs.readFile(PROVIDER_OUT,'utf8'));
    out.scope='SUPABASE_STAGE0_BUDGET_BRAIN';
    out.scopedProductCount=eligible.length;
    out.totalMarketProductCount=allProducts.length;
    out.policy='Paid deep provider enrichment is executed only against the current Supabase Stage 0 Budget Brain allowlist.';
    await fs.writeFile(PROVIDER_OUT,JSON.stringify(out,null,2)+'\n');
  }catch{}

  console.log(`Stage 0 provider wrapper: enriched scope=${eligible.length}/${allProducts.length}.`);
}catch(error){
  await fs.writeFile(MARKET,JSON.stringify(original,null,2)+'\n');
  throw error;
}
