import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSandboxWebhook} from '../netlify/functions/_sandbox-billing-isolation.mjs';

const workspace='11111111-1111-4111-8111-111111111111';
const env={MPR_SANDBOX_ISOLATION:'true',STRIPE_SECRET_KEY:'sk_test_fixture',MPR_SANDBOX_WORKSPACE_ID:workspace};
const valid=()=>({livemode:false,data:{object:{livemode:false,metadata:{workspace_id:workspace}}}});
test('accepts a test-mode event for the configured dedicated workspace',()=>{
  assert.deepEqual(assessSandboxWebhook(valid(),env),{ok:true,isolated:true,workspaceId:workspace});
});
test('leaves the existing non-isolated webhook contract unchanged',()=>{
  assert.deepEqual(assessSandboxWebhook({livemode:true},{}),{ok:true,isolated:false});
});
for(const [label,change,code] of [
  ['live event',e=>{e.livemode=true},'SANDBOX_EVENT_MODE_REQUIRED'],
  ['event without mode',e=>{delete e.livemode},'SANDBOX_EVENT_MODE_REQUIRED'],
  ['live subscription',e=>{e.data.object.livemode=true},'SANDBOX_OBJECT_MODE_REQUIRED'],
  ['object without mode',e=>{delete e.data.object.livemode},'SANDBOX_OBJECT_MODE_REQUIRED'],
  ['foreign workspace',e=>{e.data.object.metadata.workspace_id='22222222-2222-4222-8222-222222222222'},'SANDBOX_WORKSPACE_MISMATCH'],
  ['workspace missing',e=>{delete e.data.object.metadata.workspace_id},'SANDBOX_WORKSPACE_MISMATCH'],
  ['conflicting checkout reference',e=>{e.data.object.client_reference_id='another-workspace'},'SANDBOX_WORKSPACE_MISMATCH']
]){
 test('rejects '+label,()=>{const event=valid();change(event);const result=assessSandboxWebhook(event,env);assert.equal(result.ok,false);assert.equal(result.code,code);});
}
test('fails closed for malformed isolation flag, missing test key or missing workspace',()=>{
  for(const overrides of [{MPR_SANDBOX_ISOLATION:'tru'},{STRIPE_SECRET_KEY:'sk_live_fixture'},{STRIPE_SECRET_KEY:''},{MPR_SANDBOX_WORKSPACE_ID:''}]){
    assert.equal(assessSandboxWebhook(valid(),{...env,...overrides}).ok,false);
  }
});
