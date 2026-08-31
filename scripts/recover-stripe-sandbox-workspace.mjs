const text=value=>String(value??'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SHA_RE=/^[0-9a-f]{40}$/i;

async function jsonRequest(url,options,fetchImpl){
  try{
    const response=await fetchImpl(url,options);
    let body={};try{body=await response.json();}catch{}
    return {response,body};
  }catch{return {response:null,body:{}};}
}
const ok=result=>Boolean(result?.response?.ok&&result?.body?.ok===true);

export async function recoverStripeSandboxWorkspace({baseUrl,token,deploymentRef,fetchImpl=fetch,sleepImpl=sleep,maxPolls=30,pollMs=1000}={}){
  const root=text(baseUrl).replace(/\/+$/,'');
  const credential=text(token);
  const ref=text(deploymentRef);
  if(!root)throw new Error('MPR_BASE_URL is required');
  if(!credential)throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  if(!SHA_RE.test(ref))throw new Error('GITHUB_SHA must be a full commit SHA');
  const headers={authorization:`Bearer ${credential}`,accept:'application/json','x-mpr-deployment-ref':ref};
  const transitionUrl=`${root}/api/internal/billing-e2e-sandbox-transition`;
  const preflightUrl=`${root}/api/internal/sandbox-preflight-readiness`;

  const before=await jsonRequest(preflightUrl,{headers},fetchImpl);
  if(ok(before)&&before.body.ready===true)return {ok:true,action:'ALREADY_CLEAN',ready:true,realMoney:false,stripeMode:'SANDBOX'};

  let recoveryConfirmed=false;
  for(let attempt=0;attempt<3&&!recoveryConfirmed;attempt+=1){
    const recovery=await jsonRequest(transitionUrl,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action:'RECOVER_FREE'})},fetchImpl);
    if(ok(recovery)){
      if(recovery.body.realMoney!==false||recovery.body.stripeMode!=='SANDBOX'||recovery.body.entitlementAuthority!=='WEBHOOK_ONLY'||recovery.body.recovery!==true)throw new Error('Sandbox recovery did not prove Test Mode/webhook-only safety');
      recoveryConfirmed=true;
      break;
    }
    const observed=await jsonRequest(preflightUrl,{headers},fetchImpl);
    if(ok(observed)&&observed.body.ready===true)return {ok:true,action:'RECOVERED_AFTER_LOST_RESPONSE',ready:true,realMoney:false,stripeMode:'SANDBOX'};
    if(recovery.response&&![409,502,503].includes(recovery.response.status))throw new Error(`Sandbox recovery failed (${recovery.response.status} ${recovery.body?.code||'UNKNOWN'})`);
    if(attempt<2)await sleepImpl(pollMs);
  }
  if(!recoveryConfirmed)throw new Error('Sandbox recovery could not be confirmed');

  for(let attempt=0;attempt<maxPolls;attempt+=1){
    if(attempt>0)await sleepImpl(pollMs);
    const state=await jsonRequest(preflightUrl,{headers},fetchImpl);
    if(ok(state)&&state.body.ready===true)return {ok:true,action:'RECOVERED',ready:true,realMoney:false,stripeMode:'SANDBOX'};
    if(state.response&&!state.response.ok&&![502,503].includes(state.response.status))throw new Error(`Sandbox preflight failed during recovery (${state.response.status})`);
  }
  throw new Error('Sandbox did not return to clean FREE state after webhook recovery');
}

if(import.meta.url===`file://${process.argv[1]}`){
  recoverStripeSandboxWorkspace({baseUrl:process.env.MPR_BASE_URL,token:process.env.MPR_READINESS_PROBE_TOKEN,deploymentRef:process.env.GITHUB_SHA})
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(String(error?.message||error));process.exit(1);});
}
