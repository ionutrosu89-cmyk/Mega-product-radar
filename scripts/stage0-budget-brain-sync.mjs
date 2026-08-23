import fs from 'node:fs/promises';
import {applyPaidAllowlist} from './stage0-budget-brain.mjs';

const MARKET='market-intelligence-live.json';
const OUT='stage0-budget-brain-live.json';
const supabaseUrl=String(process.env.MPR_SUPABASE_URL||'https://xqzsbebbuovcyeyxdqxo.supabase.co').replace(/\/+$/,'');
const publishableKey=String(process.env.MPR_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_G9AwfdhQB_5Y5tRguZ3Feg_TRR70Qcf').trim();
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
async function writeAudit(status,extra={}){
  await fs.writeFile(OUT,JSON.stringify({version:'1.0',updatedAt:now,status,...extra},null,2)+'\n');
}

const data=await readJson(MARKET,null);
if(!data){
  await writeAudit('BLOCKED_MARKET_DATA_MISSING',{targetCount:0,eligibleCount:0,policy:'Fail closed: no paid provider call may be authorized without a market dataset and a fresh Budget Brain allowlist.'});
  console.log('Stage 0 Budget Brain: market dataset missing; paid enrichment blocked.');
  process.exit(0);
}

let targets=[];
let status='ACTIVE';
let error=null;
try{
  const response=await fetch(`${supabaseUrl}/rest/v1/rpc/stage0_paid_targets`,{
    method:'POST',
    headers:{apikey:publishableKey,'content-type':'application/json','accept':'application/json'},
    body:'{}'
  });
  if(!response.ok)throw new Error(`Supabase RPC HTTP ${response.status}`);
  const payload=await response.json();
  if(!Array.isArray(payload))throw new Error('Supabase RPC returned a non-array payload');
  targets=payload;
}catch(e){
  status='BLOCKED_ALLOWLIST_UNAVAILABLE';
  error=String(e?.message||e);
  targets=[];
}

const result=applyPaidAllowlist(data,targets);
await fs.writeFile(MARKET,JSON.stringify(result.data,null,2)+'\n');
await writeAudit(status,{
  targetCount:result.targets.length,
  eligibleCount:result.stats.eligible,
  blockedCount:result.stats.blocked,
  targets:result.targets.map(t=>({canonicalKey:t.canonical_key,title:t.title,status:t.status,estimatedCostEur:Number(t.estimated_cost_eur||0)||0,informationValue:Number(t.information_value||0)||0,paidDataPriority:t.paidDataPriority})),
  error,
  policy:'Fail closed. Only PROMISING/VALIDATE products returned by Supabase stage0_paid_targets may retain goldenPipeline.paidDataEligible=true. Recent Romania cache hits are excluded by the RPC.'
});

console.log(`Stage 0 Budget Brain: status=${status}, targets=${result.targets.length}, eligible=${result.stats.eligible}, blocked=${result.stats.blocked}.`);
