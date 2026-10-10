const text=value=>String(value??'').trim();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assessSandboxWebhook(event,env={}){
  const flag=text(env.MPR_SANDBOX_ISOLATION).toLowerCase();
  if(!flag||flag==='false')return {ok:true,isolated:false};
  if(flag!=='true')return {ok:false,status:503,code:'SANDBOX_ISOLATION_CONFIG_INVALID'};
  if(!text(env.STRIPE_SECRET_KEY).startsWith('sk_test_'))return {ok:false,status:503,code:'SANDBOX_TEST_KEY_REQUIRED'};
  const workspaceId=text(env.MPR_SANDBOX_WORKSPACE_ID);
  if(!UUID.test(workspaceId))return {ok:false,status:503,code:'SANDBOX_WORKSPACE_REQUIRED'};
  if(event?.livemode!==false)return {ok:false,status:400,code:'SANDBOX_EVENT_MODE_REQUIRED'};
  const object=event?.data?.object;
  if(object?.livemode!==false)return {ok:false,status:400,code:'SANDBOX_OBJECT_MODE_REQUIRED'};
  const metadataWorkspace=text(object?.metadata?.workspace_id);
  const clientWorkspace=text(object?.client_reference_id);
  if(metadataWorkspace!==workspaceId||(clientWorkspace&&clientWorkspace!==workspaceId)){
    return {ok:false,status:403,code:'SANDBOX_WORKSPACE_MISMATCH'};
  }
  return {ok:true,isolated:true,workspaceId};
}
