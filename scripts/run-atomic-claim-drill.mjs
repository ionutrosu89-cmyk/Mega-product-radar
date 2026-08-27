import fs from 'node:fs/promises';
import path from 'node:path';
import {createMemoryAtomicClaimStore,acquireAtomicObservationClaim,validateFencingToken} from '../atomic-claim-store-v1.js';

const arg=(name,fallback)=>{const p=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(p));return hit?hit.slice(p.length):fallback;};
const out=arg('out','artifacts/atomic-claim-drill.json');
const now=arg('now','2026-08-27T12:00:00Z');
const input={inboxFingerprint:arg('inboxFingerprint','LOCAL_ATOMIC_INBOX'),sourceFingerprint:arg('sourceFingerprint','LOCAL_ATOMIC_SOURCE')};
const store=createMemoryAtomicClaimStore();
const first=await acquireAtomicObservationClaim(store,input,{workerId:'LOCAL_WORKER_A',now,leaseDurationMs:1000});
const reclaimed=await acquireAtomicObservationClaim(store,input,{workerId:'LOCAL_WORKER_B',now:new Date(Date.parse(now)+2000).toISOString(),leaseDurationMs:1000});
const staleFence=validateFencingToken(reclaimed.claim,first.claim?.fencingToken);
const currentFence=validateFencingToken(reclaimed.claim,reclaimed.claim?.fencingToken);
const report={
  schema:'MPR_ATOMIC_CLAIM_DRILL_V1',
  mode:'local_memory_cas',
  storeScope:store.scope,
  first,
  reclaimed,
  staleFence,
  currentFence,
  productionAtomicityVerified:false,
  distributedLockingVerified:false,
  exactlyOnceGuaranteed:false,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  decision:'HOLD_PRODUCTION_ATOMICITY',
  notes:['Memory CAS validates contract semantics only.','Fencing rejects stale workers after lease reclaim.','Production atomicity requires a reviewed production adapter.']
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
if(report.productionAtomicityVerified||report.distributedLockingVerified||report.exactlyOnceGuaranteed)throw new Error('LOCAL_ATOMIC_CLAIM_DRILL_MUST_FAIL_CLOSED');
if(staleFence.valid!==false||currentFence.valid!==true)throw new Error('FENCING_TOKEN_DRILL_FAILED');
console.log(JSON.stringify(report,null,2));
