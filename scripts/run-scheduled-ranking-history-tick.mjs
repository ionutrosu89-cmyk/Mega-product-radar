import fs from 'node:fs/promises';
import path from 'node:path';
import {createFilesystemHistoryStore,createNetlifyBlobsHistoryStore} from '../ranking-history-store-v1.js';
import {runRankingHistoryCycle} from '../ranking-history-orchestrator-v1.js';
import {buildRankingTrendHandoff,evaluateScheduledRankingInput} from '../ranking-live-handoff-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inputPath=String(args.input||'artifacts/ingestion-run-manifest.json');
const outputPath=String(args.output||'artifacts/scheduled-ranking-history-tick.json');
const handoffPath=String(args.handoff||'artifacts/ranking-trend-handoff.json');
const localStoreRoot=String(args.storeRoot||'artifacts/ranking-history-store');
const mode=String(args.mode||process.env.MPR_RANKING_HISTORY_STORE||'file').toLowerCase();
const now=String(args.now||new Date().toISOString());
const intervalMs=Math.max(60000,Number(args.intervalMs||60*60*1000));
const minIntervalMs=Math.max(1,Number(args.minIntervalMs||60*60*1000));
const maxInputAgeMs=Math.max(1,Number(args.maxInputAgeMs||2*60*60*1000));
const maxTrendAgeMs=Math.max(1,Number(args.maxTrendAgeMs||7*24*60*60*1000));

async function readJson(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2));}

const audit=await readJson(inputPath);
const inputGate=evaluateScheduledRankingInput(audit||{}, {now,maxInputAgeMs});
const basePolicy={providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false};

if(!audit||!inputGate.runnable){
  const output={schema:'MPR_SCHEDULED_RANKING_HISTORY_TICK_V1',generatedAt:new Date().toISOString(),inputPath,outputPath,handoffPath,mode,decision:'WAIT',inputGate,cycle:null,handoff:null,policy:basePolicy};
  await writeJson(outputPath,output);
  console.log(JSON.stringify({schema:output.schema,decision:output.decision,reasons:inputGate.reasons,policy:basePolicy},null,2));
  process.exit(0);
}

let store;
let descriptorForKey;
if(mode==='netlify'){
  const writeAuthorized=String(process.env.MPR_RANKING_HISTORY_REMOTE_WRITE_ENABLED||'false').toLowerCase()==='true';
  store=await createNetlifyBlobsHistoryStore({writeAuthorized,storeName:process.env.MPR_RANKING_HISTORY_NETLIFY_STORE||'mpr-ranking-history-v1'});
  const prefix=String(process.env.MPR_RANKING_HISTORY_EVIDENCE_REF_PREFIX||`netlify-blobs://${process.env.MPR_RANKING_HISTORY_NETLIFY_STORE||'mpr-ranking-history-v1'}`);
  descriptorForKey=key=>({scope:'PRODUCTION_OBJECT_STORE',environment:'production',evidenceRef:`${prefix}/${key}`,reviewedAt:process.env.MPR_RANKING_HISTORY_REVIEWED_AT,reviewer:process.env.MPR_RANKING_HISTORY_REVIEWER,basis:process.env.MPR_RANKING_HISTORY_REVIEW_BASIS,collectorVersion:'scheduled-ranking-history-tick-v1'});
}else if(mode==='file'){
  store=createFilesystemHistoryStore(localStoreRoot);
  descriptorForKey=()=>({scope:'LOCAL_FILE',environment:'local',collectorVersion:'scheduled-ranking-history-tick-v1'});
}else throw new Error('UNSUPPORTED_RANKING_HISTORY_STORE_MODE');

const cycle=await runRankingHistoryCycle({resolvedBundle:audit.rankingSignalResolution},{store,descriptorForKey,now,intervalMs,minIntervalMs});
const handoff=buildRankingTrendHandoff(cycle,{asOf:now,maxAgeMs:maxTrendAgeMs});
const output={schema:'MPR_SCHEDULED_RANKING_HISTORY_TICK_V1',generatedAt:new Date().toISOString(),inputPath,outputPath,handoffPath,mode,decision:cycle.decision==='COMPLETED'?'COMPLETED':'WAIT',inputGate,cycle,handoff,policy:basePolicy};
await writeJson(outputPath,output);
await writeJson(handoffPath,handoff);
if(cycle.decision==='COMPLETED'&&cycle.trends)await writeJson(String(args.trends||'artifacts/ranking-signal-trends.json'),cycle.trends);
console.log(JSON.stringify({schema:output.schema,mode,decision:output.decision,cycleDecision:cycle.decision,handoffStatus:handoff.manifest.handoffStatus,analysisEligibleCount:handoff.manifest.analysisEligibleCount,productionEligibleCount:handoff.manifest.productionEligibleCount,policy:basePolicy},null,2));
if(basePolicy.providerDataSpendEur!==0||basePolicy.paidDataCallsTriggered!==0||basePolicy.purchaseAuthorized!==false)throw new Error('SCHEDULED_RANKING_POLICY_INVARIANT_VIOLATION');
if(mode==='file'&&(cycle.productionPersistenceVerified||handoff.productionRecords.length>0))throw new Error('LOCAL_RANKING_HISTORY_PROMOTED_TO_PRODUCTION');
