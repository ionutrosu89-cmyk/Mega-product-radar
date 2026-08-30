import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {checkoutIdempotencyKey,validCheckoutAttemptId} from '../netlify/functions/billing-checkout.mjs';

test('checkout attempt identity is strict and bounded',()=>{
  assert.equal(validCheckoutAttemptId('550e8400-e29b-41d4-a716-446655440000'),true);
  assert.equal(validCheckoutAttemptId('short'),false);
  assert.equal(validCheckoutAttemptId('bad value with spaces'),false);
  assert.equal(validCheckoutAttemptId('x'.repeat(101)),false);
});

test('same checkout attempt produces the same Stripe idempotency key',()=>{
  const attempt='550e8400-e29b-41d4-a716-446655440000';
  const first=checkoutIdempotencyKey('workspace-1','DISCOVER',attempt);
  const retry=checkoutIdempotencyKey('workspace-1','DISCOVER',attempt);
  assert.equal(first,retry);
  assert.equal(first,'mpr-checkout:workspace-1:DISCOVER:550e8400-e29b-41d4-a716-446655440000');
});

test('workspace, plan and attempt all fence independent checkout operations',()=>{
  const attempt='550e8400-e29b-41d4-a716-446655440000';
  const base=checkoutIdempotencyKey('workspace-1','DISCOVER',attempt);
  assert.notEqual(checkoutIdempotencyKey('workspace-2','DISCOVER',attempt),base);
  assert.notEqual(checkoutIdempotencyKey('workspace-1','RADAR',attempt),base);
  assert.notEqual(checkoutIdempotencyKey('workspace-1','DISCOVER','550e8400-e29b-41d4-a716-446655440001'),base);
});

test('checkout endpoint sends the attempt identity to Stripe idempotency and metadata',async()=>{
  const source=await readFile('netlify/functions/billing-checkout.mjs','utf8');
  assert.match(source,/['"]idempotency-key['"]\s*:\s*idempotencyKey/);
  assert.match(source,/metadata\[checkout_attempt_id\]/);
  assert.match(source,/subscription_data\[metadata\]\[checkout_attempt_id\]/);
  assert.match(source,/CHECKOUT_ATTEMPT_REQUIRED/);
});

test('browser reuses an attempt id across retry instead of generating one per fetch',async()=>{
  const source=await readFile('billing-client.js','utf8');
  assert.match(source,/sessionStorage/);
  assert.match(source,/getSubscriptionCheckoutAttempt\(code\)/);
  assert.match(source,/JSON\.stringify\(\{plan:code,checkoutAttemptId\}\)/);
  assert.match(source,/resetSubscriptionCheckoutAttempt\(code\)/);
});
