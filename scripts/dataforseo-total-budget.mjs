import fs from 'node:fs/promises';

const MODE=String(process.argv[2]||'pre').toLowerCase();
const CAP_FILE='paid-budget-cap.json';
const KEYWORD_BUDGET='paid-budget-live.json';
const PROVIDER='provider-intelligence-live.json';
const CAP_USD=Math.max(0.5,Number(process.env.DATAFORSEO_TOTAL_TEST_CAP_USD||10)||10);
const MAX_NEXT_CYCLE_USD=Math.max(0.01,Number(process.env.DATAFORSEO_MAX_NEXT_CYCLE_USD||0.50)||0.50);
const now=new Date().toISOString();
const n=v=>Number.isFinite(Number(v))?Number(v):0;
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

const state=await read(CAP_FILE,{version:'1.0',startedAt:now,capUsd:CAP_USD,providerEvents:[],keywordAccountedUsd:0});
state.version='1.0';
state.startedAt=state.startedAt||now;
state.capUsd=CAP_USD;
state.providerEvents=Array.isArray(state.providerEvents)?state.providerEvents:[];

async function keywordSpentSinceStart(){
  const b=await read(KEYWORD_BUDGET,{events:[]});
  const start=new Date(state.startedAt).getTime();
  return (Array.isArray(b.events)?b.events:[])
    .filter(e=>new Date(e.at||0).getTime()>=start)
    .reduce((s,e)=>s+n(e.costUsd),0);
}

if(MODE==='post'){
  const provider=await read(PROVIDER,null);
  const runId=String(provider?.updatedAt||'');
  const cost=n(provider?.stats?.runCostUsd);
  if(runId&&cost>0&&!state.providerEvents.some(e=>e.runId===runId)){
    state.providerEvents.push({runId,at:now,costUsd:cost,source:'DATAFORSEO_V27_PROVIDER'});
  }
}

const keywordUsd=await keywordSpentSinceStart();
const providerUsd=state.providerEvents.reduce((s,e)=>s+n(e.costUsd),0);
const spentUsd=Number((keywordUsd+providerUsd).toFixed(4));
const remainingUsd=Number(Math.max(0,CAP_USD-spentUsd).toFixed(4));
const allowPaid=remainingUsd>=MAX_NEXT_CYCLE_USD;
state.keywordAccountedUsd=Number(keywordUsd.toFixed(4));
state.providerAccountedUsd=Number(providerUsd.toFixed(4));
state.spentUsd=spentUsd;
state.remainingUsd=remainingUsd;
state.maxNextCycleUsd=MAX_NEXT_CYCLE_USD;
state.allowPaid=allowPaid;
state.status=allowPaid?'ACTIVE':'STOPPED_TOTAL_CAP';
state.updatedAt=now;
state.policy=`Hard test budget: stop new paid DataForSEO cycles when less than $${MAX_NEXT_CYCLE_USD.toFixed(2)} remains, so configured per-cycle spending cannot exceed the $${CAP_USD.toFixed(2)} total cap.`;
await fs.writeFile(CAP_FILE,JSON.stringify(state,null,2)+'\n');

if(MODE==='pre'){
  const out=process.env.GITHUB_OUTPUT;
  if(out) await fs.appendFile(out,`allow_paid=${allowPaid?'true':'false'}\nremaining_usd=${remainingUsd}\nspent_usd=${spentUsd}\n`);
}
console.log(`DataForSEO total cap: spent $${spentUsd}/$${CAP_USD.toFixed(2)}, remaining $${remainingUsd}, allowPaid=${allowPaid}, mode=${MODE}.`);
