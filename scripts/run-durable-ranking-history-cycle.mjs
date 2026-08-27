import fs from 'node:fs/promises';
import path from 'node:path';
import {createFilesystemHistoryStore,createNetlifyBlobsHistoryStore} from '../ranking-history-store-v1.js';
import {runRankingHistoryCycle} from '../ranking-history-orchestrator-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/ingestion-run-manifest.json');
const outputPath=String(args.output||'artifacts/ranking-history-cycle-audit.json');
const localStoreRoot=String(args.storeRoot||'artifacts/ranking-history-store');
const mode=String(args.mode||process.env.MPR_RANKING_HISTORY_STORE||'file').toLowerCase();
const now=String(args.now||new Date().toISOString());
const intervalMs=Math.max(60000,Number(args.intervalMs||60*60*1000));
const minIntervalMs=Math.max(1,Number(args.minIntervalMs||60*60*1000));

const audit=JSON.parse(await fs.readFile(inputPath,'utf8'));
if(!audit?.rankingSignalResolution)throw new Error('RANKING_SIGNAL_RESOLUTION_REQUIRED');

let store;
let descriptorForKey;
if(mode==='netlify'){
  const writeAuthorized=String(process.env.MPR_RANKING_HISTORY_REMOTE_WRITE_ENABLED||'false').toLowerCase()==='true';
  store=await createNetlifyBlobsHistoryStore({writeAuthorized,storeName:process.env.MPR_RANKING_HISTORY_NETLIFY_STORE||'mpr-ranking-history-v1'});
  const prefix=String(process.env.MPR_RANKING_HISTORY_EVIDENCE_REF_PREFIX||`netlify-blobs://${process.env.MPR_RANKING_HISTORY_NETLIFY_STORE||'mpr-ranking-history-v1'}`);
  descriptorForKey=key=>({
    scope:'PRODUCTION_OBJECT_STORE',environment:'production',evidenceRef:`${prefix}/${key}`,
    reviewedAt:process.env.MPR_RANKING_HISTORY_REVIEWED_AT,
    reviewer:process.env.MPR_RANKING_HISTORY_REVIEWER,
    basis:process.env.MPR_RANKING_HISTORY_REVIEW_BASIS,
    collectorVersion:'ranking-history-orchestrator-v1'
  });
}else if(mode==='file'){
  store=createFilesystemHistoryStore(localStoreRoot);
  descriptorForKey=()=>({scope:'LOCAL_FILE',environment:'local',collectorVersion:'ranking-history-orchestrator-v1'});
}else{
  throw new Error('UNSUPPORTED_RANKING_HISTORY_STORE_MODE');
}

const cycle=await runRankingHistoryCycle({resolvedBundle:audit.rankingSignalResolution},{
  store,descriptorForKey,now,intervalMs,minIntervalMs
});
const output={
  schema:'MPR_DURABLE_RANKING_HISTORY_CYCLE_AUDIT_V1',
  generatedAt:new Date().toISOString(),inputPath,outputPath,mode,cycle,
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false}
};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2));
if(cycle.decision==='COMPLETED'&&cycle.trends){
  const trendMirror=String(args.trends||'artifacts/ranking-signal-trends.json');
  await fs.mkdir(path.dirname(trendMirror),{recursive:true});
  await fs.writeFile(trendMirror,JSON.stringify(cycle.trends,null,2));
}
console.log(JSON.stringify({schema:output.schema,mode,decision:cycle.decision,appendedCount:cycle.appendedCount||0,ledgerEntryCount:cycle.ledgerEntryCount||0,comparableTrendCount:cycle.comparableTrendCount||0,productionPersistenceVerified:cycle.productionPersistenceVerified||false,policy:output.policy},null,2));
if(output.policy.providerDataSpendEur!==0||output.policy.paidDataCallsTriggered!==0||output.policy.purchaseAuthorized!==false)throw new Error('RANKING_HISTORY_POLICY_INVARIANT_VIOLATION');
if(mode==='file'&&cycle.productionPersistenceVerified)throw new Error('LOCAL_HISTORY_STORE_PROMOTED_TO_PRODUCTION');
