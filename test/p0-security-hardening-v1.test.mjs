import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requestedWorkspaceId,resolveWorkspaceAccess,workspaceRoleAllowed} from '../netlify/functions/_workspace-access.mjs';
import {enforceRateLimit} from '../netlify/functions/_security-ops.mjs';

const req=(headers={})=>({headers:new Headers(headers)});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function fetchFor(role='MEMBER'){return async url=>{const s=String(url);if(s.includes('/auth/v1/user'))return json({id:'u1'});if(s.includes('/workspace_members'))return json([{workspace_id:'w1',user_id:'u1',role}]);if(s.includes('/workspaces'))return json([{id:'w1',name:'W',plan:'RADAR',owner_id:'owner'}]);return json({},404);};}

test('protected workspace resolver fails closed without explicit workspace',async()=>{assert.equal(requestedWorkspaceId(req()),null);const r=await resolveWorkspaceAccess(req({authorization:'Bearer token'}),{fetchImpl:fetchFor(),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'}});assert.equal(r.status,400);assert.equal(r.code,'WORKSPACE_CONTEXT_REQUIRED');});

test('workspace resolver binds user membership to requested workspace',async()=>{const r=await resolveWorkspaceAccess(req({authorization:'Bearer token','x-mpr-workspace-id':'w1'}),{fetchImpl:fetchFor('ADMIN'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'},allowedRoles:['OWNER','ADMIN']});assert.equal(r.workspaceId,'w1');assert.equal(r.membership.role,'ADMIN');assert.equal(r.plan.code,'RADAR');});

test('member cannot use owner/admin-only workspace operation',async()=>{assert.equal(workspaceRoleAllowed('MEMBER',['OWNER','ADMIN']),false);const r=await resolveWorkspaceAccess(req({authorization:'Bearer token','x-mpr-workspace-id':'w1'}),{fetchImpl:fetchFor('MEMBER'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'},allowedRoles:['OWNER','ADMIN']});assert.equal(r.status,403);assert.equal(r.code,'WORKSPACE_ROLE_DENIED');});

test('rate limiter returns 429 after configured burst',async()=>{const request=req({'x-forwarded-for':'203.0.113.1'});const options={route:'unit-rate-limit-'+Date.now(),limit:2,windowSeconds:60,env:{},fetchImpl:async()=>new Response(null,{status:201})};assert.equal((await enforceRateLimit(request,options)).ok,true);assert.equal((await enforceRateLimit(request,options)).ok,true);const third=await enforceRateLimit(request,options);assert.equal(third.ok,false);assert.equal(third.status,429);});

test('distributed anonymous rate limit never transmits the raw client IP',async()=>{let body=null;const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return json([{allowed:true,limit:2,hitCount:1}]);};const result=await enforceRateLimit(req({'x-forwarded-for':'203.0.113.25'}),{route:'privacy-test',limit:2,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service',SECURITY_AUDIT_SALT:'salt'},fetchImpl});assert.equal(result.ok,true);assert.doesNotMatch(body.p_bucket_key,/203\.0\.113\.25/);});

test('Netlify security headers include CSP HSTS frame and MIME protections',async()=>{const toml=await readFile('netlify.toml','utf8');for(const marker of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'])assert.match(toml,new RegExp(marker));assert.match(toml,/frame-ancestors 'none'/);});

test('security migration creates service-role operational ledgers',async()=>{const sql=await readFile('supabase/migrations/20260826_p0_security_foundation.sql','utf8');for(const table of ['security_audit_events','billing_webhook_events','api_rate_limit_events'])assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));assert.match(sql,/revoke all on public\.billing_webhook_events from anon, authenticated/);});

test('database bootstrap is migration-only and baseline is first',async()=>{const readme=await readFile('supabase/README.md','utf8'),schema=await readFile('supabase/schema.sql','utf8');assert.match(readme,/only supported database source of truth/);assert.match(schema,/LEGACY REFERENCE SNAPSHOT ONLY/);const baseline=await readFile('supabase/migrations/20260819_baseline_schema.sql','utf8');assert.match(baseline,/create table if not exists public\.workspaces/);});
