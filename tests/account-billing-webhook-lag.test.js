import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('account billing UI polls verified backend state after Stripe cancel and resume',async()=>{
  const source=await readFile('account.js','utf8');
  assert.match(source,/expectedCancel!==null&&Boolean\(data\.subscription\?\.cancelAtPeriodEnd\)!==expectedCancel/);
  assert.match(source,/for\(let i=0;i<5&&needsRetry\(\);i\+\+\)/);
  assert.match(source,/cancelSubscription\(\);await refreshBilling\(\{expectedCancel:true,stripeFallback:stripe\}\)/);
  assert.match(source,/resumeSubscription\(\);await refreshBilling\(\{expectedCancel:false,stripeFallback:stripe\}\)/);
});

test('Stripe fallback affects display only and never mutates entitlement locally',async()=>{
  const source=await readFile('account.js','utf8');
  assert.match(source,/Statusul contului se actualizează după webhook/);
  assert.match(source,/accesul rămâne controlat exclusiv de starea verificată Stripe/);
  assert.match(source,/Entitlement-ul nu este modificat din browser/);
  assert.doesNotMatch(source,/workspace\.plan\s*=/);
  assert.doesNotMatch(source,/localStorage.*plan/i);
});
