import fs from 'node:fs/promises';
import path from 'node:path';
import {createFilesystemHistoryStore} from '../ranking-history-store-v1.js';
import {createObservationConsumptionReceipt,persistObservationConsumptionReceipt,validateObservationConsumptionReceipt} from '../observation-inbox-consumer-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const inboxPath=String(args.inbox||'artifacts/live-observation-inbox-audit.json');
const tickPath=String(args.tick||'artifacts/scheduled-ranking-history-tick.json');
const outputPath=String(args.output||'artifacts/observation-consumption-receipt-audit.json');
const storeRoot=String(args.storeRoot||'artifacts/observation-consumption-store');
const completedAt=String(args.completedAt||new Date().toISOString());

async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2));}

const basePolicy={providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false};
const inboxAudit=await readJson(inboxPath);
const tick=await readJson(tickPath);
const waitReasons=[];
if(!inboxAudit)waitReasons.push('INBOX_AUDIT_REQUIRED');
if(!tick)waitReasons.push('SCHEDULED_TICK_REQUIRED');
if(inboxAudit&&inboxAudit.read?.analysisRunnable!==true)waitReasons.push('INBOX_NOT_ANALYSIS_RUNNABLE');
if(tick&&tick.cycle?.decision!=='COMPLETED')waitReasons.push('HISTORY_CYCLE_NOT_COMPLETED');
if(tick&&!tick.handoff?.manifest?.fingerprint)waitReasons.push('HANDOFF_FINGERPRINT_REQUIRED');
if(inboxAudit&&!inboxAudit.read?.envelope?.fingerprint)waitReasons.push('INBOX_FINGERPRINT_REQUIRED');
if(inboxAudit&&!inboxAudit.read?.envelope?.sourceFingerprint)waitReasons.push('SOURCE_FINGERPRINT_REQUIRED');

if(waitReasons.length){
  const output={schema:'MPR_OBSERVATION_CONSUMPTION_RECEIPT_AUDIT_V1',generatedAt:new Date().toISOString(),decision:'WAIT',inboxPath,tickPath,outputPath,storeRoot,reasons:waitReasons,receipt:null,persistence:null,policy:basePolicy};
  await writeJson(outputPath,output);
  console.log(JSON.stringify({schema:output.schema,decision:output.decision,reasons:waitReasons,policy:basePolicy},null,2));
  process.exit(0);
}

const schedulerAttestation=inboxAudit.read?.schedulerAttestation?.ok===true?inboxAudit.read.schedulerAttestation.attestation:null;
const productionPersistenceVerified=tick.cycle?.productionPersistenceVerified===true;
const receipt=createObservationConsumptionReceipt({
  inboxFingerprint:inboxAudit.read.envelope.fingerprint,
  sourceFingerprint:inboxAudit.read.envelope.sourceFingerprint,
  cycleFingerprint:tick.cycle.fingerprint,
  cycleDecision:tick.cycle.decision,
  handoffFingerprint:tick.handoff.manifest.fingerprint
},{completedAt,schedulerAttestation,productionPersistenceVerified});
const validation=validateObservationConsumptionReceipt(receipt);
const store=createFilesystemHistoryStore(storeRoot);
const persistence=await persistObservationConsumptionReceipt(store,receipt);
const output={
  schema:'MPR_OBSERVATION_CONSUMPTION_RECEIPT_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  decision:validation.valid&&receipt.analysisConsumed&&['RECORDED','ALREADY_RECORDED'].includes(persistence.decision)?'COMPLETED':'HOLD',
  inboxPath,tickPath,outputPath,storeRoot,
  receipt,validation,persistence,
  policy:basePolicy,
  notes:['Local filesystem receipt persistence is an audit trail, not distributed exactly-once processing proof.']
};
await writeJson(outputPath,output);
console.log(JSON.stringify({schema:output.schema,decision:output.decision,analysisConsumed:receipt.analysisConsumed,productionConsumed:receipt.productionConsumed,persistenceDecision:persistence.decision,policy:basePolicy},null,2));
if(receipt.productionConsumed)throw new Error('LOCAL_CONSUMPTION_RECEIPT_PROMOTED_TO_PRODUCTION');
if(basePolicy.providerDataSpendEur!==0||basePolicy.paidDataCallsTriggered!==0||basePolicy.purchaseAuthorized!==false)throw new Error('OBSERVATION_CONSUMPTION_POLICY_INVARIANT_VIOLATION');
