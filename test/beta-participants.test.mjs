import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate,createBetaParticipantsHandler} from '../netlify/functions/beta-participants.mjs';
import {readFile} from 'node:fs/promises';

test('beta participant metrics use only stored participant and feedback rows',()=>{
  const summary=aggregate([{status:'INVITED'},{status:'ACTIVATED'},{status:'COMPLETED'}],[{rating:5,area:'RADAR',would_pay:true},{rating:3,area:'DISCOVER',would_pay:false}]);
  assert.equal(summary.participants,3);assert.equal(summary.statuses.ACTIVATED,1);assert.equal(summary.feedbackCount,2);assert.equal(summary.avgRating,4);assert.equal(summary.wouldPay.YES,1);assert.equal(summary.wouldPay.NO,1);
});

test('beta participant admin endpoint rejects anonymous access',async()=>{
  const handler=createBetaParticipantsHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  const response=await handler(new Request('https://radar.example/api/internal/beta-participants'));
  assert.equal(response.status,401);
});

test('beta participant registry remains service-role only behind RLS',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260822_beta_participants.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/i);assert.doesNotMatch(sql,/create policy/i);
});

test('beta participant UI states that users are not fabricated',async()=>{
  const html=await readFile(new URL('../beta-participants.html',import.meta.url),'utf8');
  assert.match(html,/nu generează utilizatori fictivi/i);assert.match(html,/feedback provin exclusiv din beta_feedback/i);
});
