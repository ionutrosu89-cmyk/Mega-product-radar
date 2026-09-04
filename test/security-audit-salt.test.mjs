import assert from 'node:assert/strict';
import test from 'node:test';
import {enforceRateLimit,securityAuditSalt} from '../netlify/functions/_security-ops.mjs';

test('production requires a dedicated SECURITY_AUDIT_SALT',()=>{
  assert.throws(()=>securityAuditSalt({CONTEXT:'production'}),/SECURITY_AUDIT_SALT_REQUIRED/);
  assert.throws(()=>securityAuditSalt({MPR_ENV:'production',SECURITY_AUDIT_SALT:'too-short'}),/SECURITY_AUDIT_SALT_REQUIRED/);
});

test('production accepts a dedicated audit salt of at least 32 characters',()=>{
  const salt='0123456789abcdef0123456789abcdef';
  assert.equal(securityAuditSalt({CONTEXT:'production',SECURITY_AUDIT_SALT:salt}),salt);
});

test('rate limiting fails closed before any provider call when production salt is missing',async()=>{
  let calls=0;
  const request=new Request('https://example.test',{headers:{'x-forwarded-for':'203.0.113.5'}});
  await assert.rejects(
    ()=>enforceRateLimit(request,{route:'test',env:{CONTEXT:'production',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'},fetchImpl:async()=>{calls++;throw new Error('must not call');}}),
    /SECURITY_AUDIT_SALT_REQUIRED/
  );
  assert.equal(calls,0);
});

test('non-production keeps a local-only development salt so tests and previews remain usable',()=>{
  assert.equal(securityAuditSalt({CONTEXT:'deploy-preview'}),'mpr-local-development-only');
});
