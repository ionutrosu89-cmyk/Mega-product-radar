import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryAtomicClaimStore,acquireAtomicObservationClaim,validateFencingToken} from '../atomic-claim-store-v1.js';

const input={inboxFingerprint:'inbox-atomic-1',sourceFingerprint:'source-atomic-1'};

test('first atomic claim acquires fencing token 1',async()=>{
  const store=createMemoryAtomicClaimStore();
  const result=await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  assert.equal(result.decision,'ACQUIRED');
  assert.equal(result.acquired,true);
  assert.equal(result.claim.fencingToken,1);
  assert.equal(result.productionAtomicityVerified,false);
  assert.equal(result.exactlyOnceGuaranteed,false);
});

test('same worker active claim is idempotent',async()=>{
  const store=createMemoryAtomicClaimStore();
  await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  const again=await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:10Z',leaseDurationMs:60000});
  assert.equal(again.decision,'ALREADY_CLAIMED');
  assert.equal(again.idempotent,true);
});

test('different worker cannot acquire active claim',async()=>{
  const store=createMemoryAtomicClaimStore();
  await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:60000});
  const conflict=await acquireAtomicObservationClaim(store,input,{workerId:'worker-b',now:'2026-08-27T12:00:10Z',leaseDurationMs:60000});
  assert.equal(conflict.decision,'ACTIVE_CLAIM_CONFLICT');
  assert.equal(conflict.acquired,false);
});

test('expired claim is reclaimed with incremented fencing token',async()=>{
  const store=createMemoryAtomicClaimStore();
  const first=await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:1000});
  const second=await acquireAtomicObservationClaim(store,input,{workerId:'worker-b',now:'2026-08-27T12:00:02Z',leaseDurationMs:1000});
  assert.equal(first.claim.fencingToken,1);
  assert.equal(second.decision,'RECLAIMED_WITH_FENCE');
  assert.equal(second.claim.fencingToken,2);
});

test('stale fencing token is rejected after reclaim',async()=>{
  const store=createMemoryAtomicClaimStore();
  const first=await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',leaseDurationMs:1000});
  const second=await acquireAtomicObservationClaim(store,input,{workerId:'worker-b',now:'2026-08-27T12:00:02Z',leaseDurationMs:1000});
  assert.equal(validateFencingToken(second.claim,first.claim.fencingToken).valid,false);
  assert.equal(validateFencingToken(second.claim,second.claim.fencingToken).valid,true);
});

test('CAS retry exhaustion fails closed',async()=>{
  const store={scope:'TEST_CONFLICTING_CAS',productionAtomicityVerified:false,async read(){return null;},async compareAndSet(){return{ok:false,current:null,currentVersion:0};}};
  const result=await acquireAtomicObservationClaim(store,input,{workerId:'worker-a',now:'2026-08-27T12:00:00Z',maxCasAttempts:2});
  assert.equal(result.decision,'CAS_RETRY_EXHAUSTED');
  assert.equal(result.acquired,false);
  assert.equal(result.exactlyOnceGuaranteed,false);
});
