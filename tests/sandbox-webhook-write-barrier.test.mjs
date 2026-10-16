import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createBillingWebhookHandler} from '../netlify/functions/billing-webhook.mjs';
const workspace='11111111-1111-4111-8111-111111111111';
const env={MPR_SANDBOX_ISOLATION:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',SUPABASE_SERVICE_ROLE_KEY:'test_fixture',MPR_SANDBOX_WORKSPACE_ID:workspace};
for(const [label,livemode,workspaceId] of [['live event',true,workspace],['foreign workspace',false,'22222222-2222-4222-8222-222222222222']]){
 test('signed '+label+' cannot reach storage',async()=>{
  let calls=0;
  const handler=createBillingWebhookHandler({env,fetch:async()=>{calls++;throw new Error('Storage must not be touched')}});
  const event={id:'evt_test',type:'customer.subscription.updated',created:Math.floor(Date.now()/1000),livemode,data:{object:{livemode,metadata:{workspace_id:workspaceId}}}};
  const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(timestamp+'.'+raw).digest('hex');
  const response=await handler(new Request('https://sandbox.example/api/billing/webhook',{method:'POST',headers:{'stripe-signature':'t='+timestamp+',v1='+signature},body:raw}));
  assert.equal(response.status,livemode?400:403);
  assert.equal(calls,0);
 });
}
