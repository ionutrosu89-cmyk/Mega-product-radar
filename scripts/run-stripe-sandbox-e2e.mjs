const STAGES=['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
const text=value=>String(value??'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SHA_RE=/^[0-9a-f]{40}$/i;

async function jsonRequest(url,options,fetchImpl){
  try{
    const response=await fetchImpl(url,options);
    let body={};try{body=await response.json();}catch{}
    return {response,body,networkError:false};
  }catch{return {response:null,body:{},networkError:true};}
}
const statusOf=result=>result?.response?.status||0;
const ok=result=>Boolean(result?.response?.ok&&result?.body?.ok===true);

async function reliableGet(url,headers,{fetchImpl,sleepImpl,attempts=4,pollMs=1000}){
  let last;
  for(let attempt=0;attempt<attempts;attempt+=1){
    last=await jsonRequest(url,{headers},fetchImpl);
    if(last.response)return last;
    if(attempt<attempts-1)await sleepImpl(pollMs);
  }
  return last;
}

async function captureStage({stage,stageIndex,acceptanceUrl,authHeaders,fetchImpl,sleepImpl,maxPolls,pollMs}){
  for(let attempt=0;attempt<maxPolls;attempt+=1){
    if(attempt>0)await sleepImpl(pollMs);
    const capture=await jsonRequest(acceptanceUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
    if(ok(capture)&&capture.body?.capturedStage===stage)return capture.body;
    const current=await reliableGet(acceptanceUrl,authHeaders,{fetchImpl,sleepImpl,attempts:2,pollMs:Math.min(pollMs,1000)});
    if(ok(current)&&Number(current.body.checkpointCount)>=stageIndex)return current.body;
    if(capture.response&&![409,502,503].includes(statusOf(capture)))throw new Error(`${stage} capture failed (${statusOf(capture)} ${capture.body?.code||'UNKNOWN'})`);
  }
  return null;
}

export async function runStripeSandboxE2e({baseUrl,token,deploymentRef,fetchImpl=fetch,sleepImpl=sleep,maxPolls=30,pollMs=2000}={}){
  const root=text(baseUrl).replace(/\/+$/,'');
  const credential=text(token);
  const ref=text(deploymentRef);
  if(!root)throw new Error('MPR_BASE_URL is required');
  if(!credential)throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  if(!SHA_RE.test(ref))throw new Error('GITHUB_SHA must be a full commit SHA');
  const authHeaders={authorization:`Bearer ${credential}`,accept:'application/json','x-mpr-deployment-ref':ref};
  const acceptanceUrl=`${root}/api/internal/billing-e2e-acceptance`;
  const transitionUrl=`${root}/api/internal/billing-e2e-sandbox-transition`;

  const initial=await reliableGet(acceptanceUrl,authHeaders,{fetchImpl,sleepImpl});
  if(!ok(initial))throw new Error(`Acceptance lookup failed (${statusOf(initial)} ${initial.body?.code||'NETWORK_ERROR'})`);
  const initialCount=Number(initial.body.checkpointCount)||0;
  if(initialCount===6&&initial.body.verdict==='GO')return {ok:true,verdict:'GO',checkpointCount:6,completed:[],resumed:true,realMoney:false,stripeMode:'SANDBOX'};
  if(initialCount<1||initialCount>5||STAGES[initialCount-1]!==initial.body.nextStage)throw new Error(`Journey must have a verified resumable checkpoint (got ${initialCount}/6 ${initial.body.nextStage||'UNKNOWN'})`);

  const completed=[];
  const resumed=initialCount>1;
  for(let index=initialCount-1;index<STAGES.length;index+=1){
    const stage=STAGES[index];
    const targetCount=index+2;

    // Recovery after a lost HTTP response: if Stripe/webhook already reached the next state,
    // capture it before attempting the provider mutation again.
    let captured=await captureStage({stage,stageIndex:targetCount,acceptanceUrl,authHeaders,fetchImpl,sleepImpl,maxPolls:2,pollMs:Math.min(pollMs,750)});
    if(!captured){
      let transitioned=false;
      for(let transitionAttempt=0;transitionAttempt<3&&!transitioned;transitionAttempt+=1){
        const transition=await jsonRequest(transitionUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
        if(ok(transition)){
          if(transition.body.realMoney!==false||transition.body.stripeMode!=='SANDBOX'||transition.body.entitlementAuthority!=='WEBHOOK_ONLY')throw new Error(`${stage} transition did not prove sandbox/webhook-only safety`);
          transitioned=true;
          break;
        }
        // A network failure can happen after Stripe accepted the mutation. Observe the webhook-backed
        // state before retrying the idempotent transition.
        captured=await captureStage({stage,stageIndex:targetCount,acceptanceUrl,authHeaders,fetchImpl,sleepImpl,maxPolls:3,pollMs:Math.min(pollMs,1000)});
        if(captured){transitioned=true;break;}
        if(transition.response&&![409,502,503].includes(statusOf(transition)))throw new Error(`${stage} transition failed (${statusOf(transition)} ${transition.body?.code||'UNKNOWN'})`);
        if(transitionAttempt<2)await sleepImpl(1000);
      }
      if(!transitioned)throw new Error(`${stage} transition could not be confirmed after retry-safe observation`);
    }

    if(!captured)captured=await captureStage({stage,stageIndex:targetCount,acceptanceUrl,authHeaders,fetchImpl,sleepImpl,maxPolls,pollMs});
    if(!captured)throw new Error(`${stage} webhook-backed checkpoint timed out`);
    completed.push(stage);
    if(stage!=='ENDED_FREE')await sleepImpl(1250);
  }

  const final=await reliableGet(acceptanceUrl,authHeaders,{fetchImpl,sleepImpl});
  if(!ok(final)||Number(final.body.checkpointCount)!==6||final.body.verdict!=='GO')throw new Error(`Final billing E2E verdict is not GO (${final.body?.checkpointCount||0}/6 ${final.body?.verdict||'UNKNOWN'})`);
  return {ok:true,verdict:'GO',checkpointCount:6,completed,resumed,realMoney:false,stripeMode:'SANDBOX'};
}

if(import.meta.url===`file://${process.argv[1]}`){
  runStripeSandboxE2e({baseUrl:process.env.MPR_BASE_URL,token:process.env.MPR_READINESS_PROBE_TOKEN,deploymentRef:process.env.GITHUB_SHA})
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(String(error?.message||error));process.exit(1);});
}
