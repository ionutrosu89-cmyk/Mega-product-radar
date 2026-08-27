import fs from 'node:fs/promises';
import path from 'node:path';
import {appendResolvedSignalsToLedger,buildHistoricalTrendIndex} from '../ranking-signal-history-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/ingestion-run-manifest.json');
const ledgerPath=String(args.ledger||'artifacts/ranking-signal-history.json');
const trendPath=String(args.trends||'artifacts/ranking-signal-trends.json');
const minIntervalMs=Math.max(1,Number(args.minIntervalMs||60*60*1000));

async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}

const audit=await readJson(inputPath,null);
if(!audit?.rankingSignalResolution)throw new Error('RANKING_SIGNAL_RESOLUTION_REQUIRED');
const existing=await readJson(ledgerPath,{entries:[]});
const ledger=appendResolvedSignalsToLedger(existing,audit.rankingSignalResolution);
const trends=buildHistoricalTrendIndex(ledger,{minIntervalMs});
const output={
  schema:'MPR_RANKING_SIGNAL_HISTORY_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  inputPath,
  ledgerPath,
  trendPath,
  ledgerManifest:ledger.manifest,
  trendManifest:trends.manifest,
  policy:{
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  }
};
await fs.mkdir(path.dirname(ledgerPath),{recursive:true});
await fs.mkdir(path.dirname(trendPath),{recursive:true});
await fs.writeFile(ledgerPath,JSON.stringify(ledger,null,2));
await fs.writeFile(trendPath,JSON.stringify(trends,null,2));
console.log(JSON.stringify(output,null,2));
if(output.policy.providerDataSpendEur!==0||output.policy.paidDataCallsTriggered!==0||output.policy.purchaseAuthorized!==false)throw new Error('HISTORY_POLICY_INVARIANT_VIOLATION');
