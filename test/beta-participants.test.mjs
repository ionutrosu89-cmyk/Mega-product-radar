import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate,createBetaParticipantsHandler,resolveParticipantBinding} from '../netlify/functions/beta-participants.mjs';
import {readFile} from 'node:fs/promises';

test('beta participant metrics use only stored participant and feedback rows',()=>{
  const summary=aggregate([{status:'INVITED'},{status:'ACTIVATED',user_id:'u1',workspace_id:'w1'},{status:'COMPLETED'}],[{rating:5,area:'RADAR',would_pay:true},{rating:3,area:'DISCOVER',would_pay:false}]);
  assert.equal(summary.participants,3);assert.equal(summary.statuses.ACTIVATED,1);assert.equal(summary.linked,1);assert.equal(summary.unlinked,2);assert.equal(summary.feedbackCount,2);assert.equal(summary.avgRating,4);assert.equal(summary.wouldPay.YES,1);assert.equal(summary.wouldPay.NO,1);
});

test('beta participant admin endpoint rejects anonymous access',async()=>{
  const handler=createBetaParticipantsHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  const response=await handler(new Request('https://radar.example/api/internal/beta-participants'));
  assert.equal(response.status,401);
});

test('beta participant admin endpoint accepts shared server-side analytics admin registry',async()=>{
  const fetchImpl=async url=>{const s=String(url);if(s.includes('/auth/v1/user'))return Response.json({id:'admin-1',email:'admin@example.com'});if(s.includes('/beta_analytics_admins?'))return Response.json([{user_id:'admin-1'}]);if(s.includes('/beta_participants?'))return Response.json([]);if(s.includes('/beta_feedback?'))return Response.json([]);return new Response(null,{status:404});};
  const handler=createBetaParticipantsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});
  const response=await handler(new Request('https://radar.example/api/internal/beta-participants',{headers:{authorization:'Bearer token'}}));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.ok,true);assert.equal(body.summary.participants,0);
});

test('participant identity binding requires exact auth email and one real workspace membership',async()=>{
  const fetchImpl=async url=>{
    const s=String(url);
    if(s.includes('/beta_participants?'))return Response.json([{id:'p1',email:'seller@example.com',status:'INVITED'}]);
    if(s.includes('/auth/v1/admin/users'))return Response.json({users:[{id:'u1',email:'seller@example.com'},{id:'u2',email:'other@example.com'}]});
    if(s.includes('/workspace_members?'))return Response.json([{workspace_id:'w1',user_id:'u1',role:'OWNER'}]);
    return new Response(null,{status:404});
  };
  const result=await resolveParticipantBinding({participantId:'p1',workspaceId:null,base:'https://example.supabase.co',headers:{authorization:'Bearer service'},fetchImpl});
  assert.equal(result.user.id,'u1');assert.equal(result.membership.workspace_id,'w1');assert.equal(result.membership.role,'OWNER');
});

test('participant identity binding fails closed on ambiguous workspaces or missing auth user',async()=>{
  const baseFetch=async(url)=>{const s=String(url);if(s.includes('/beta_participants?'))return Response.json([{id:'p1',email:'seller@example.com',status:'INVITED'}]);if(s.includes('/auth/v1/admin/users'))return Response.json({users:[{id:'u1',email:'seller@example.com'}]});if(s.includes('/workspace_members?'))return Response.json([{workspace_id:'w1',user_id:'u1'},{workspace_id:'w2',user_id:'u1'}]);return new Response(null,{status:404});};
  const ambiguous=await resolveParticipantBinding({participantId:'p1',workspaceId:null,base:'https://example.supabase.co',headers:{},fetchImpl:baseFetch});
  assert.equal(ambiguous.status,409);assert.match(ambiguous.error,/explicit workspace/i);
  const missingUser=await resolveParticipantBinding({participantId:'p1',workspaceId:null,base:'https://example.supabase.co',headers:{},fetchImpl:async url=>String(url).includes('/beta_participants?')?Response.json([{id:'p1',email:'missing@example.com'}]):String(url).includes('/auth/v1/admin/users')?Response.json({users:[]}):new Response(null,{status:404})});
  assert.equal(missingUser.status,409);assert.match(missingUser.error,/no auth user/i);
});

test('beta participant registry and identity binding remain service-role only behind RLS',async()=>{
  const baseSql=await readFile(new URL('../supabase/migrations/20260822_beta_participants.sql',import.meta.url),'utf8');
  const bindingSql=await readFile(new URL('../supabase/migrations/20260826_p10_beta_participant_binding.sql',import.meta.url),'utf8');
  assert.match(baseSql,/enable row level security/i);assert.doesNotMatch(baseSql,/create policy/i);assert.match(bindingSql,/revoke all on table public\.beta_participants from anon, authenticated/i);
  assert.match(bindingSql,/user_id uuid references auth\.users/i);assert.match(bindingSql,/workspace_id uuid references public\.workspaces/i);
});

test('beta operations UI exposes the zero-cost scorecard, journey next action and states that users are not fabricated',async()=>{
  const html=await readFile(new URL('../beta-participants.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../beta-participants.js',import.meta.url),'utf8');
  assert.match(html,/nu generează utilizatori fictivi/i);assert.match(html,/Free Beta Scorecard/i);assert.match(html,/25 invitați/i);assert.match(html,/Registru beta \+ next action/i);assert.match(html,/Journey coverage indisponibil/i);
  assert.match(js,/Leagă contul real/i);assert.match(js,/RUN_TOP25_SEARCH/);assert.match(js,/REACH_PRODUCT_DECISION/);assert.match(js,/\/api\/internal\/closed-beta-scorecard/);assert.match(js,/LINK_IDENTITY/);assert.match(js,/lansare automată=false/);assert.match(js,/achiziții autorizate=false/);
});
