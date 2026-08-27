import fs from 'node:fs/promises';
import path from 'node:path';
import {claimObservationInboxEntry,createObservationRecoveryLedgerEntry} from '../observation-inbox-lease-v1.js';

const arg=(name,fallback)=>{const p=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(p));return hit?hit.slice(p.length):fallback;};
const out=arg('out','artifacts/observation-lease-recovery.json');
const root=arg('storeRoot','artifacts/local-observation-lease-store');
const workerId=arg('worker','LOCAL_WORKER');
const now=arg('now','2026-08-27T12:00:00Z');
const inboxFingerprint=arg('inboxFingerprint','LOCAL_INBOX_FINGERPRINT');
const sourceFingerprint=arg('sourceFingerprint','LOCAL_SOURCE_FINGERPRINT');

await fs.mkdir(root,{recursive:true});
const safeKey=key=>path.join(root,key.replace(/[^a-zA-Z0-9._-]+/g,'_')+'.json');
const store={
  scope:'LOCAL_FILESYSTEM',
  async get(key){try{return JSON.parse(await fs.readFile(safeKey(key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async put(key,value){await fs.writeFile(safeKey(key),JSON.stringify(value,null,2));}
};
const input={inboxFingerprint,sourceFingerprint};
const claim=await claimObservationInboxEntry(store,input,{workerId,now,leaseDurationMs:60000});
const recovery=createObservationRecoveryLedgerEntry({
  inboxFingerprint,
  sourceFingerprint,
  leaseFingerprint:claim.lease?.fingerprint,
  workerId,
  attempt:claim.lease?.attempt||1,
  event:claim.decision,
  detail:{storeScope:store.scope,productionLockingVerified:false}
},{observedAt:now});
const report={
  schema:'MPR_OBSERVATION_LEASE_RECOVERY_DRILL_V1',
  mode:'local',
  claim,
  recovery,
  productionLockingVerified:false,
  exactlyOnceGuaranteed:false,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  decision:'HOLD_PRODUCTION_LOCKING',
  notes:['Local filesystem lease is an audit drill only.','No atomic distributed compare-and-set is claimed.','Expired leases may be reclaimed deterministically.']
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
if(report.productionLockingVerified||report.exactlyOnceGuaranteed)throw new Error('LOCAL_LEASE_DRILL_MUST_FAIL_CLOSED');
console.log(JSON.stringify(report,null,2));
