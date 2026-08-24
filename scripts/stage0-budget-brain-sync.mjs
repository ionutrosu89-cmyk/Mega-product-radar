import fs from 'node:fs/promises';
import {applyPaidAllowlist} from './stage0-budget-brain.mjs';
import {readStage0Targets} from './lib/stage0-secure-targets.mjs';

const MARKET='market-intelligence-live.json';
const OUT='stage0-budget-brain-live.json';
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
async function writeAudit(status,extra={}){await fs.writeFile(OUT,JSON.stringify({version:'1.1-oidc',updatedAt:now,status,...extra},null,2)+'\n');}

const data=await readJson(MARKET,null);
if(!data){await writeAudit('BLOCKED_MARKET_DATA_MISSING',{targetCount:0,eligibleCount:0,policy:'Fail closed: no paid provider call may be authorized without market data and a fresh OIDC-authorized Budget Brain allowlist.'});console.log('Stage 0 Budget Brain: market dataset missing; paid enrichment blocked.');process.exit(0);}

let targets=[],status='ACTIVE',error=null;
try{targets=await readStage0Targets('RO');}
catch(e){status='BLOCKED_ALLOWLIST_UNAVAILABLE';error=String(e?.message||e);targets=[];}

const result=applyPaidAllowlist(data,targets);
await fs.writeFile(MARKET,JSON.stringify(result.data,null,2)+'\n');
await writeAudit(status,{targetCount:result.targets.length,eligibleCount:result.stats.eligible,blockedCount:result.stats.blocked,targets:result.targets.map(t=>({canonicalKey:t.canonical_key,title:t.title,status:t.status,estimatedCostEur:Number(t.estimated_cost_eur||0)||0,informationValue:Number(t.information_value||0)||0,paidDataPriority:t.paidDataPriority})),error,authorization:'GITHUB_OIDC_EDGE',policy:'Fail closed. Only PROMISING/VALIDATE products returned by the server-side Stage 0 RO queue may retain goldenPipeline.paidDataEligible=true. Browser/public RPC access is not used.'});
console.log(`Stage 0 Budget Brain: status=${status}, targets=${result.targets.length}, eligible=${result.stats.eligible}, blocked=${result.stats.blocked}.`);
