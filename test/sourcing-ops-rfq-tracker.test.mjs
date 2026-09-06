import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {markRfqReplied,markRfqSent,seedRfqRecords,validateRfqRecord} from '../rfq-dispatch-state.js';

const queue=JSON.parse(fs.readFileSync('supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json','utf8'));
const candidates=JSON.parse(fs.readFileSync('supplier-candidates/car-sunglasses-magnetic-visor-holder.json','utf8'));

test('RFQ seed preserves closed no-contact policy state and remains valid for all five candidates',()=>{
  assert.equal(queue.entries.length,5);
  assert.ok(queue.entries.every(x=>x.status==='CLOSED'));
  assert.ok(queue.entries.every(x=>x.closeReason==='NO_CONTACT_POLICY_PAGE_BACKED_SOURCING'));
  const seeded=seedRfqRecords(queue,candidates);
  assert.equal(seeded.length,5);
  assert.ok(seeded.every(x=>validateRfqRecord(x).valid));
});

test('SENT requires explicit human confirmation, sender and channel',()=>{
  const r={...seedRfqRecords(queue,candidates)[1],status:'NOT_SENT',closedAt:null,closeReason:null};
  assert.equal(markRfqSent(r,{sentBy:'Ionut',channel:'Alibaba'}).ok,false);
  assert.equal(markRfqSent(r,{confirmedRealDispatch:true,channel:'Alibaba'}).ok,false);
  const sent=markRfqSent(r,{confirmedRealDispatch:true,sentBy:'Ionut',channel:'Alibaba',sentAt:'2026-08-24T06:00:00Z'});
  assert.equal(sent.ok,true);
  assert.equal(sent.record.status,'SENT');
});

test('REPLIED cannot skip SENT and requires a real response reference',()=>{
  const r={...seedRfqRecords(queue,candidates)[1],status:'NOT_SENT',closedAt:null,closeReason:null};
  assert.equal(markRfqReplied(r,{confirmedRealResponse:true,responseReference:'thread-1'}).ok,false);
  const sent=markRfqSent(r,{confirmedRealDispatch:true,sentBy:'Ionut',channel:'Alibaba',sentAt:'2026-08-24T06:00:00Z'}).record;
  assert.equal(markRfqReplied(sent,{confirmedRealResponse:true}).ok,false);
  const replied=markRfqReplied(sent,{confirmedRealResponse:true,responseReference:'Alibaba thread 123',responseReceivedAt:'2026-08-24T07:00:00Z'});
  assert.equal(replied.ok,true);
  assert.equal(replied.record.status,'REPLIED');
});

test('RFQ private workspace table enforces RLS and truth constraints',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260824_rfq_dispatch_state.sql','utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/is_workspace_member\(workspace_id\)/);
  assert.match(sql,/rfq_sent_truth/);
  assert.match(sql,/rfq_reply_truth/);
  assert.match(sql,/status in \('NOT_SENT','SENT','REPLIED','CLOSED'\)/);
});

test('Sourcing Ops stores private state and never implements external message sending',()=>{
  const js=fs.readFileSync('sourcing-ops.js','utf8');
  const html=fs.readFileSync('sourcing-ops.html','utf8');
  const cloud=fs.readFileSync('cloud-sync.js','utf8');
  assert.match(js,/megaRadarRfqDispatchV1/);
  assert.match(cloud,/rfq_dispatch_states/);
  assert.match(html,/pregătit.*nu înseamnă.*trimis/is);
  assert.match(html,/Confirm că RFQ-ul a fost trimis efectiv/);
  assert.doesNotMatch(js,/fetch\([^\n]*(send|message|alibaba)/i);
});

test('Netlify build ships Sourcing Ops UI but excludes private source templates and response data',()=>{
  const build=fs.readFileSync('scripts/build-site.mjs','utf8');
  for(const file of ['sourcing-ops.html','sourcing-ops.js','rfq-dispatch-state.js'])assert.match(build,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(build,/Never copy supplier-candidates\/, supplier-rfq-dispatch\/, supplier-evidence\//);
  assert.match(build,/PRIVATE_STATIC_ARTIFACT_EXPOSED/);
  assert.doesNotMatch(queue.policy,/response content/i);
});
