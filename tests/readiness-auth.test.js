import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import test from 'node:test';
import {authorizeReadinessRequest,verifyGitHubActionsOidcToken} from '../netlify/functions/_readiness-auth.mjs';

function request(token=''){return new Request('https://mpr.example/api/internal/readiness',{headers:token?{authorization:`Bearer ${token}`}:{}});}
function base64urlJson(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk=publicKey.export({format:'jwk'});
publicJwk.kid='test-key';
publicJwk.alg='RS256';
publicJwk.use='sig';

function oidcToken(overrides={}){
  const now=Math.floor(Date.now()/1000);
  const header=base64urlJson({alg:'RS256',typ:'JWT',kid:'test-key'});
  const payload=base64urlJson({
    iss:'https://token.actions.githubusercontent.com',
    aud:'mega-product-radar-readiness',
    repository:'ionutrosu89-cmyk/Mega-product-radar',
    repository_id:'1329831891',
    repository_owner_id:'315386782',
    ref:'refs/heads/main',
    workflow_ref:'ionutrosu89-cmyk/Mega-product-radar/.github/workflows/paid-beta-deployment-acceptance.yml@refs/heads/main',
    sub:'repo:ionutrosu89-cmyk@315386782/Mega-product-radar@1329831891:ref:refs/heads/main',
    event_name:'push',
    iat:now-5,
    nbf:now-5,
    exp:now+300,
    ...overrides
  });
  const signature=sign('RSA-SHA256',Buffer.from(`${header}.${payload}`),privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}
function jwksFetch(){return Response.json({keys:[publicJwk]});}

test('dedicated readiness probe token bypasses user-session lookup only on exact match',async()=>{
  let calls=0;
  const result=await authorizeReadinessRequest({
    request:request('probe-secret'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>{calls+=1;throw new Error('should not be called');}
  });
  assert.equal(result.ok,true);
  assert.equal(result.principal,'READINESS_PROBE');
  assert.equal(calls,0);
});

test('valid GitHub Actions OIDC token is accepted without a persistent probe secret',async()=>{
  const token=oidcToken();
  assert.equal(await verifyGitHubActionsOidcToken(token,{fetchImpl:async()=>jwksFetch()}),true);
  const result=await authorizeReadinessRequest({request:request(token),env:{},fetchImpl:async()=>jwksFetch()});
  assert.equal(result.ok,true);
  assert.equal(result.principal,'GITHUB_ACTIONS_OIDC');
});

test('Stripe sandbox billing E2E workflow OIDC is accepted only by its exact workflow ref',async()=>{
  const token=oidcToken({workflow_ref:'ionutrosu89-cmyk/Mega-product-radar/.github/workflows/stripe-sandbox-billing-e2e.yml@refs/heads/main'});
  assert.equal(await verifyGitHubActionsOidcToken(token,{fetchImpl:async()=>jwksFetch()}),true);
  const result=await authorizeReadinessRequest({request:request(token),env:{},fetchImpl:async()=>jwksFetch()});
  assert.equal(result.ok,true);
  assert.equal(result.principal,'GITHUB_ACTIONS_OIDC');

  const lookalike=oidcToken({workflow_ref:'ionutrosu89-cmyk/Mega-product-radar/.github/workflows/stripe-sandbox-billing-e2e-copy.yml@refs/heads/main'});
  assert.equal(await verifyGitHubActionsOidcToken(lookalike,{fetchImpl:async()=>jwksFetch()}),false);
});

test('immutable GitHub subject format is not assumed when stable signed claims match',async()=>{
  const legacySubject=oidcToken({sub:'repo:ionutrosu89-cmyk/Mega-product-radar:ref:refs/heads/main'});
  const immutableSubject=oidcToken({sub:'repo:ionutrosu89-cmyk@315386782/Mega-product-radar@1329831891:ref:refs/heads/main'});
  assert.equal(await verifyGitHubActionsOidcToken(legacySubject,{fetchImpl:async()=>jwksFetch()}),true);
  assert.equal(await verifyGitHubActionsOidcToken(immutableSubject,{fetchImpl:async()=>jwksFetch()}),true);
});

test('GitHub Actions OIDC authentication rejects mismatched authorization claims',async()=>{
  const invalidTokens=[
    oidcToken({aud:'wrong-audience'}),
    oidcToken({repository:'other/repo'}),
    oidcToken({repository_id:'999'}),
    oidcToken({repository_owner_id:'999'}),
    oidcToken({ref:'refs/heads/feature'}),
    oidcToken({workflow_ref:'ionutrosu89-cmyk/Mega-product-radar/.github/workflows/other.yml@refs/heads/main'}),
    oidcToken({event_name:'pull_request'}),
    oidcToken({exp:Math.floor(Date.now()/1000)-120})
  ];
  for(const token of invalidTokens){
    assert.equal(await verifyGitHubActionsOidcToken(token,{fetchImpl:async()=>jwksFetch()}),false);
    const result=await authorizeReadinessRequest({request:request(token),env:{},fetchImpl:async()=>jwksFetch()});
    assert.equal(result.ok,false);
    assert.equal(result.response.status,401);
  }
});

test('GitHub OIDC token with invalid signature fails closed',async()=>{
  const token=oidcToken();
  const [header,payload]=token.split('.');
  const forged=`${header}.${payload}.${Buffer.from('forged').toString('base64url')}`;
  assert.equal(await verifyGitHubActionsOidcToken(forged,{fetchImpl:async()=>jwksFetch()}),false);
});

test('wrong readiness probe token fails closed and cannot bypass Supabase auth',async()=>{
  let calls=0;
  const result=await authorizeReadinessRequest({
    request:request('wrong-secret'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.ro'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>{calls+=1;return new Response(null,{status:401});}
  });
  assert.equal(result.ok,false);
  assert.equal(result.response.status,401);
  assert.equal(calls,1);
});

test('admin JWT path remains available when probe token does not match',async()=>{
  const result=await authorizeReadinessRequest({
    request:request('admin-jwt'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.ro'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>Response.json({id:'u1',email:'admin@example.ro'})
  });
  assert.equal(result.ok,true);
  assert.equal(result.principal,'ADMIN_USER');
});

test('missing bearer credential is rejected',async()=>{
  const result=await authorizeReadinessRequest({request:request(),env:{MPR_READINESS_PROBE_TOKEN:'probe-secret'}});
  assert.equal(result.ok,false);
  assert.equal(result.response.status,401);
});
