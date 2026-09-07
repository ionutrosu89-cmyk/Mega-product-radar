import assert from 'node:assert/strict';
import test from 'node:test';
import {createAccountDeleteHandler,CONFIRMATION} from '../netlify/functions/account-delete.mjs';
import {createAccountExportHandler} from '../netlify/functions/account-export.mjs';

const uid='11111111-1111-4111-8111-111111111111';
const ws='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon-key',SUPABASE_SERVICE_ROLE_KEY:'service-key',SECURITY_AUDIT_SALT:'x'.repeat(32)};
function req(path,{method='GET',body,headers={}}={}){return new Request(`https://mpr.example${path}`,{method,headers:{authorization:'Bearer user-jwt',...headers,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
function baseFetch({subscriptionStatus=null,onDelete=()=>{}}={}){return async (url,options={})=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return Response.json({id:uid,email:'user@example.com',created_at:'2026-01-01T00:00:00Z'});
  if(u.includes('/rest/v1/workspace_members?')&&u.includes('user_id=eq.'))return Response.json([{workspace_id:ws,user_id:uid,role:'OWNER'}]);
  if(u.includes('/rest/v1/workspaces?')&&u.includes('owner_id=eq.'))return Response.json([{id:ws,plan:'FREE'}]);
  if(u.includes('/rest/v1/workspaces?')&&u.includes('id=in.'))return Response.json([{id:ws,name:'Mine',plan:'FREE',owner_id:uid}]);
  if(u.includes('/rest/v1/profiles?'))return Response.json([{id:uid,email:'user@example.com'}]);
  if(u.includes('/rest/v1/subscriptions?'))return Response.json(subscriptionStatus?[{workspace_id:ws,status:subscriptionStatus,cancel_at_period_end:false}]:[]);
  if(u.includes('/rest/v1/')&&u.includes('workspace_id=in.'))return Response.json([{workspace_id:ws}]);
  if(u.includes(`/auth/v1/admin/users/${uid}`)&&options.method==='DELETE'){onDelete();return Response.json({id:uid});}
  if(u.includes('/rest/v1/api_rate_limit_events'))return new Response(null,{status:201});
  return new Response(null,{status:404});
};}

test('account deletion refuses missing explicit confirmation',async()=>{
  let deleted=false;
  const handler=createAccountDeleteHandler({env,fetch:baseFetch({onDelete:()=>{deleted=true;}})});
  const response=await handler(req('/api/account/delete',{method:'POST',body:{confirmation:'delete'}}));
  assert.equal(response.status,400);
  assert.equal(deleted,false);
});

test('account deletion refuses while billing is active',async()=>{
  let deleted=false;
  const handler=createAccountDeleteHandler({env,fetch:baseFetch({subscriptionStatus:'active',onDelete:()=>{deleted=true;}})});
  const response=await handler(req('/api/account/delete',{method:'POST',body:{confirmation:CONFIRMATION}}));
  assert.equal(response.status,409);
  assert.equal(deleted,false);
});

test('account deletion deletes the authenticated user only after all gates pass',async()=>{
  let deleted=false;
  const handler=createAccountDeleteHandler({env,fetch:baseFetch({onDelete:()=>{deleted=true;}})});
  const response=await handler(req('/api/account/delete',{method:'POST',body:{confirmation:CONFIRMATION}}));
  assert.equal(response.status,200);
  assert.equal(deleted,true);
  const payload=await response.json();
  assert.equal(payload.sessionRevokedByUserDeletion,true);
  assert.match(response.headers.get('clear-site-data')||'',/storage/);
});

test('account export is scoped to authenticated memberships and is non-cacheable',async()=>{
  const handler=createAccountExportHandler({env,fetch:baseFetch(),now:()=>new Date('2026-09-07T08:00:00Z')});
  const response=await handler(req('/api/account/export'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  const payload=JSON.parse(await response.text());
  assert.equal(payload.account.id,uid);
  assert.deepEqual(payload.memberships.map(row=>row.workspace_id),[ws]);
  assert.deepEqual(payload.workspaces.map(row=>row.id),[ws]);
  for(const rows of Object.values(payload.workspaceData))for(const row of rows)if(row.workspace_id)assert.equal(row.workspace_id,ws);
});
