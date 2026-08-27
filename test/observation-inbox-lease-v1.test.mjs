import test from 'node:test';
import assert from 'node:assert/strict';
import {createObservationLease,validateObservationLease,claimObservationInboxEntry,createObservationRecoveryLedgerEntry} from '../observation-inbox-lease-v1.js';

const input={inboxFingerprint:'inbox-1',sourceFingerprint:'source-1'};
const memory=()=>{const m=new Map();return{async get(k){return m.get(k)||null;},async put(k,v){m.set(k,v);}};};

test('lease is deterministic and active before expiry',()=>{
  const lease=createObservationLease(input,{workerId:'worker-a',claimedAt:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  const validation=validateObservationLease(lease,{now:'2026-08-27T12:00:30Z'});
  assert.equal(validation.active,true);
  assert.equal(validation.expired,false);
  assert.equal(lease.purchaseAuthorized,false);
  assert.equal(lease.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('active lease blocks another worker',async()=>{
  const store=memory();
  const first=await claimObservationInboxEntry(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  const second=await claimObservationInboxEntry(store,input,{workerId:'worker-b',now:'2026-08-27T12:00:10Z',leaseDurationMs:60000});
  assert.equal(first.decision,'CLAIMED');
  assert.equal(second.decision,'LEASE_CONFLICT');
  assert.equal(second.claimed,false);
});

test('same worker claim is idempotent while lease is active',async()=>{
  const store=memory();
  await claimObservationInboxEntry(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  const again=await claimObservationInboxEntry(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:20Z',leaseDurationMs:60000});
  assert.equal(again.decision,'ALREADY_CLAIMED');
  assert.equal(again.idempotent,true);
});

test('expired lease may be reclaimed with incremented attempt',async()=>{
  const store=memory();
  const first=await claimObservationInboxEntry(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:1000});
  const second=await claimObservationInboxEntry(store,input,{workerId:'worker-b',now:'2026-08-27T12:00:02Z',leaseDurationMs:1000});
  assert.equal(first.lease.attempt,1);
  assert.equal(second.decision,'RECLAIMED_EXPIRED_LEASE');
  assert.equal(second.lease.attempt,2);
  assert.equal(second.lease.workerId,'worker-b');
});

test('tampered lease fails validation',()=>{
  const lease=createObservationLease(input,{workerId:'worker-a',claimedAt:'2026-08-27T12:00:00Z'});
  lease.workerId='worker-x';
  const validation=validateObservationLease(lease,{now:'2026-08-27T12:00:10Z'});
  assert.equal(validation.valid,false);
  assert.ok(validation.reasons.includes('LEASE_FINGERPRINT_MISMATCH'));
});

test('recovery ledger entry keeps zero-cost truth invariants',()=>{
  const entry=createObservationRecoveryLedgerEntry({inboxFingerprint:'inbox-1',sourceFingerprint:'source-1',leaseFingerprint:'lease-1',workerId:'worker-a',attempt:2,event:'LEASE_RECLAIMED',detail:{reason:'expired'}},{observedAt:'2026-08-27T12:00:02Z'});
  assert.equal(entry.providerDataSpendEur,0);
  assert.equal(entry.paidDataCallsTriggered,0);
  assert.equal(entry.purchaseAuthorized,false);
  assert.equal(entry.verifiedSalesRows,0);
  assert.equal(entry.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
