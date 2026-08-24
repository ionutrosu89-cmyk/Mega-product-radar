import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {followUpStatus,markRfqFollowUp,markRfqReplied,markRfqSent} from '../rfq-dispatch-state.js';

const seed={productKey:'car-sunglasses-magnetic-visor-holder',productName:'Car sunglasses magnetic visor holder',supplierName:'Supplier A',platform:'Alibaba',status:'NOT_SENT'};
const sentAt='2026-08-24T06:00:00.000Z';
function sent(){return markRfqSent(seed,{confirmedRealDispatch:true,sentBy:'operator',channel:'Alibaba',sentAt}).record;}

test('first and second follow-up become due only after 24h and 48h',()=>{
  const r=sent();
  assert.equal(followUpStatus(r,'2026-08-25T05:59:00.000Z').status,'WAITING');
  assert.equal(followUpStatus(r,'2026-08-25T06:00:00.000Z').status,'FOLLOW_UP_1_DUE');
  const f1=markRfqFollowUp(r,{confirmedRealFollowUp:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-25T06:00:00.000Z'});assert.equal(f1.ok,true);
  assert.equal(followUpStatus(f1.record,'2026-08-26T05:59:00.000Z').status,'WAITING');
  assert.equal(followUpStatus(f1.record,'2026-08-26T06:00:00.000Z').status,'FOLLOW_UP_2_DUE');
});

test('follow-up cannot be recorded early or without explicit real-send confirmation',()=>{
  const r=sent();
  assert.equal(markRfqFollowUp(r,{confirmedRealFollowUp:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-24T07:00:00.000Z'}).ok,false);
  assert.equal(markRfqFollowUp(r,{confirmedRealFollowUp:false,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-25T06:00:00.000Z'}).ok,false);
});

test('after two follow-ups and 72h supplier is stale-review, never auto-closed',()=>{
  let r=sent();
  r=markRfqFollowUp(r,{confirmedRealFollowUp:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-25T06:00:00.000Z'}).record;
  r=markRfqFollowUp(r,{confirmedRealFollowUp:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-26T06:00:00.000Z'}).record;
  const s=followUpStatus(r,'2026-08-27T06:00:00.000Z');
  assert.equal(s.status,'STALE_REVIEW');assert.equal(r.status,'SENT');
});

test('real reply stops follow-up SLA and routes to Quote Intake',()=>{
  const r=sent(),reply=markRfqReplied(r,{confirmedRealResponse:true,responseReference:'conversation-123',responseReceivedAt:'2026-08-24T12:00:00.000Z'});
  assert.equal(reply.ok,true);const s=followUpStatus(reply.record,'2026-08-27T06:00:00.000Z');assert.equal(s.status,'REPLIED');assert.equal(s.responseHours,6);
});

test('Sourcing Ops exposes SLA but implements no external send API',async()=>{
  const [html,js]=await Promise.all([fs.readFile('sourcing-ops.html','utf8'),fs.readFile('sourcing-ops.js','utf8')]);
  assert.match(html,/primul follow-up după 24h/);assert.match(html,/MPR nu trimite mesaje automat/);assert.match(js,/followUpStatus/);assert.match(js,/markRfqFollowUp/);
  assert.doesNotMatch(js,/fetch\([^)]*(?:alibaba|wechat|email)/i);
});
