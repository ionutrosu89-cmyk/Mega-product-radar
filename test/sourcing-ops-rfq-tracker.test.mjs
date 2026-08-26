import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {normalizeDispatchState,recordRfqSent,recordRfqReply,followUpStatus} from '../rfq-dispatch-state.js';

const queue=JSON.parse(fs.readFileSync('supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json','utf8'));

test('priority RFQ dispatch queue starts entirely NOT_SENT',()=>{assert.ok(Array.isArray(queue.suppliers)&&queue.suppliers.length>=3);for(const row of queue.suppliers){const s=normalizeDispatchState(row);assert.equal(s.status,'NOT_SENT');assert.equal(s.sentAt,null);assert.equal(s.responseReceivedAt,null);}});

test('SENT requires explicit human confirmation, sender and channel',()=>{assert.throws(()=>recordRfqSent({},{}),/explicit real-send confirmation/i);assert.throws(()=>recordRfqSent({},{confirmRealSend:true,sentBy:'Ionut'}),/channel required/i);const sent=recordRfqSent({supplierName:'X'},{confirmRealSend:true,sentBy:'Ionut',channel:'Alibaba Chat',now:'2026-08-20T10:00:00Z'});assert.equal(sent.status,'SENT');assert.equal(sent.sentBy,'Ionut');assert.equal(sent.channel,'Alibaba Chat');});

test('REPLIED cannot skip SENT and requires a real response reference',()=>{assert.throws(()=>recordRfqReply({status:'NOT_SENT'},{responseReference:'chat-1'}),/requires SENT state/i);const sent=recordRfqSent({supplierName:'X'},{confirmRealSend:true,sentBy:'Ionut',channel:'Alibaba Chat',now:'2026-08-20T10:00:00Z'});assert.throws(()=>recordRfqReply(sent,{}),/response reference required/i);const replied=recordRfqReply(sent,{responseReference:'chat-1',now:'2026-08-21T10:00:00Z'});assert.equal(replied.status,'REPLIED');assert.equal(replied.responseReference,'chat-1');});

test('RFQ private workspace table enforces RLS and truth constraints',()=>{const sql=fs.readFileSync('supabase/migrations/20260821_commercial_v2.sql','utf8');assert.match(sql,/rfq_dispatch_states/i);assert.match(sql,/enable row level security/i);});

test('Sourcing Ops stores private state and never implements external message sending',()=>{const js=fs.readFileSync('sourcing-ops.js','utf8');const html=fs.readFileSync('sourcing-ops.html','utf8');const cloud=fs.readFileSync('cloud-sync.js','utf8');assert.match(js,/megaRadarRfqDispatchV1/);assert.match(cloud,/rfq_dispatch_states/);assert.match(html,/pregătit.*nu înseamnă.*trimis/is);assert.match(html,/Confirm că RFQ-ul a fost trimis efectiv/);assert.doesNotMatch(js,/fetch\([^\n]*(send|message|alibaba)/i);});

test('Netlify build ships Sourcing Ops UI but excludes private source templates and response data',()=>{const build=fs.readFileSync('scripts/build-site.mjs','utf8');for(const file of ['sourcing-ops.html','sourcing-ops.js','rfq-dispatch-state.js'])assert.match(build,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));for(const privatePath of ['supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json','supplier-candidates/car-sunglasses-magnetic-visor-holder.json','docs/rfq-car-sunglasses-magnetic-visor-holder.md'])assert.doesNotMatch(build,new RegExp(`copy(?:IfExists)?\\(['\"]${privatePath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));assert.match(build,/PRIVATE_STATIC_ARTIFACT_EXPOSED/);assert.doesNotMatch(queue.policy,/response content/i);});

test('follow-up status never fabricates a send or response',()=>{const s=followUpStatus({status:'NOT_SENT'},new Date('2026-08-25T00:00:00Z'));assert.equal(s.status,'NOT_SENT');});
