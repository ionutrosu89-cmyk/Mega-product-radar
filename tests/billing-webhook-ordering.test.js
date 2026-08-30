import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {stripeEventOrderDecision} from '../billing-webhook-ordering.js';

test('older active event cannot restore paid entitlement after a newer revocation',()=>{
  const result=stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_deleted',storedPlan:'FREE',storedStatus:'canceled',incomingCreated:100,incomingEventId:'evt_old_update',incomingPlan:'RADAR',incomingStatus:'active'});
  assert.deepEqual(result,{apply:false,reason:'STALE'});
});

test('older plan event cannot regress a newer paid plan',()=>{
  const result=stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_launch',storedPlan:'LAUNCH',storedStatus:'active',incomingCreated:100,incomingEventId:'evt_radar',incomingPlan:'RADAR',incomingStatus:'active'});
  assert.equal(result.apply,false);
  assert.equal(result.reason,'STALE');
});

test('same-second ambiguous event cannot grant or upgrade entitlement',()=>{
  assert.deepEqual(stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_cancel',storedPlan:'FREE',storedStatus:'canceled',incomingCreated:200,incomingEventId:'evt_active',incomingPlan:'DISCOVER',incomingStatus:'active'}),{apply:false,reason:'AMBIGUOUS_WOULD_GRANT'});
  assert.deepEqual(stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_radar',storedPlan:'RADAR',storedStatus:'active',incomingCreated:200,incomingEventId:'evt_launch',incomingPlan:'LAUNCH',incomingStatus:'active'}),{apply:false,reason:'AMBIGUOUS_WOULD_UPGRADE'});
});

test('same-second ambiguous revocation or downgrade remains fail-closed',()=>{
  assert.deepEqual(stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_launch',storedPlan:'LAUNCH',storedStatus:'active',incomingCreated:200,incomingEventId:'evt_radar',incomingPlan:'RADAR',incomingStatus:'active'}),{apply:true,reason:'AMBIGUOUS_FAIL_CLOSED'});
  assert.deepEqual(stripeEventOrderDecision({storedCreated:200,storedEventId:'evt_active',storedPlan:'RADAR',storedStatus:'active',incomingCreated:200,incomingEventId:'evt_cancel',incomingPlan:'FREE',incomingStatus:'canceled'}),{apply:true,reason:'AMBIGUOUS_FAIL_CLOSED'});
});

test('newer lifecycle state applies normally and malformed timestamps fail closed',()=>{
  assert.deepEqual(stripeEventOrderDecision({storedCreated:100,storedEventId:'evt_old',storedPlan:'DISCOVER',storedStatus:'active',incomingCreated:200,incomingEventId:'evt_new',incomingPlan:'LAUNCH',incomingStatus:'active'}),{apply:true,reason:'NEWER'});
  assert.deepEqual(stripeEventOrderDecision({storedCreated:100,incomingCreated:0,incomingEventId:'evt_bad',incomingPlan:'LAUNCH',incomingStatus:'active'}),{apply:false,reason:'INVALID_EVENT_TIME'});
});

test('database migration atomically locks subscription ordering and workspace entitlement',async()=>{
  const sql=await readFile('supabase/migrations/20260830_stripe_webhook_ordering.sql','utf8');
  assert.match(sql,/last_stripe_event_created bigint not null default 0/i);
  assert.match(sql,/last_stripe_event_id text/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/current_row\.last_stripe_event_created > p_stripe_event_created/i);
  assert.match(sql,/AMBIGUOUS_WOULD_GRANT/);
  assert.match(sql,/AMBIGUOUS_WOULD_UPGRADE/);
  assert.match(sql,/update public\.subscriptions set/i);
  assert.match(sql,/update public\.workspaces/i);
  assert.match(sql,/grant execute .* to service_role/i);
  assert.match(sql,/revoke execute .* from public,anon,authenticated/i);
});
