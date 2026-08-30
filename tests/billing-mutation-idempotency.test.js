import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {billingMutationIdempotencyKey} from '../netlify/functions/_billing-mutation-idempotency.mjs';

const base={workspaceId:'workspace-1',subscriptionId:'sub_123',lastStripeEventId:'evt_100'};

test('same verified billing state and operation produce a stable mutation key',()=>{
  const first=billingMutationIdempotencyKey({...base,operation:'plan-change',target:'RADAR'});
  const retry=billingMutationIdempotencyKey({...base,operation:'plan-change',target:'RADAR'});
  assert.equal(first,retry);
  assert.match(first,/^mpr-billing-plan-change:[a-f0-9]{64}$/);
});

test('new Stripe lifecycle state fences a later legitimate mutation',()=>{
  const before=billingMutationIdempotencyKey({...base,operation:'cancel',target:'true'});
  const after=billingMutationIdempotencyKey({...base,lastStripeEventId:'evt_101',operation:'cancel',target:'true'});
  assert.notEqual(before,after);
});

test('operation and target fence cancel resume and plan changes',()=>{
  const cancel=billingMutationIdempotencyKey({...base,operation:'cancel',target:'true'});
  const resume=billingMutationIdempotencyKey({...base,operation:'resume',target:'false'});
  const radar=billingMutationIdempotencyKey({...base,operation:'plan-change',target:'RADAR'});
  const launch=billingMutationIdempotencyKey({...base,operation:'plan-change',target:'LAUNCH'});
  assert.notEqual(cancel,resume);
  assert.notEqual(radar,launch);
  assert.notEqual(cancel,radar);
});

test('billing access loads the event version used for server-owned idempotency',async()=>{
  const source=await readFile('netlify/functions/_billing-workspace-access.mjs','utf8');
  assert.match(source,/last_stripe_event_id/);
});

test('all Stripe subscription mutation POSTs send an idempotency key',async()=>{
  for(const path of ['netlify/functions/billing-change-plan.mjs','netlify/functions/billing-cancel.mjs','netlify/functions/billing-resume.mjs']){
    const source=await readFile(path,'utf8');
    assert.match(source,/billingMutationIdempotencyKey/);
    assert.match(source,/['"]idempotency-key['"]\s*:\s*mutationKey/);
  }
});

test('cancel and resume short-circuit already verified target state',async()=>{
  const cancel=await readFile('netlify/functions/billing-cancel.mjs','utf8');
  const resume=await readFile('netlify/functions/billing-resume.mjs','utf8');
  assert.match(cancel,/if\(sub\.cancel_at_period_end\)return Response\.json\(\{ok:true,unchanged:true/);
  assert.match(resume,/if \(!sub\.cancel_at_period_end\)/);
});
