const STAGES=['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
const text=value=>String(value??'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SHA_RE=/^[0-9a-f]{40}$/i;

async function jsonRequest(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};try{body=await response.json();}catch{}
  return {response,body};
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

  const initial=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
  if(!initial.response.ok||initial.body?.ok!==true)throw new Error(`Acceptance lookup failed (${initial.response.status} ${initial.body?.code||'UNKNOWN'})`);
  if(initial.body.checkpointCount!==1||initial.body.nextStage!=='DISCOVER_ACTIVE')throw new Error(`Journey must start from verified FREE baseline (got ${initial.body.checkpointCount||0}/6 ${initial.body.nextStage||'UNKNOWN'})`);

  const completed=[];
  for(const stage of STAGES){
    const transition=await jsonRequest(transitionUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
    if(!transition.response.ok||transition.body?.ok!==true)throw new Error(`${stage} transition failed (${transition.response.status} ${transition.body?.code||'UNKNOWN'})`);
    if(transition.body.realMoney!==false||transition.body.stripeMode!=='SANDBOX'||transition.body.entitlementAuthority!=='WEBHOOK_ONLY')throw new Error(`${stage} transition did not prove sandbox/webhook-only safety`);

    let captured=null;
    for(let attempt=0;attempt<maxPolls;attempt+=1){
      if(attempt>0)await sleepImpl(pollMs);
      const capture=await jsonRequest(acceptanceUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
      if(capture.response.ok&&capture.body?.ok===true&&capture.body?.capturedStage===stage){captured=capture.body;break;}
      const current=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
      const stageIndex=STAGES.indexOf(stage)+2;
      if(current.response.ok&&current.body?.ok===true&&Number(current.body.checkpointCount)>=stageIndex){captured=current.body;break;}
      if(![409,502,503].includes(capture.response.status))throw new Error(`${stage} capture failed (${capture.response.status} ${capture.body?.code||'UNKNOWN'})`);
    }
    if(!captured)throw new Error(`${stage} webhook-backed checkpoint timed out`);
    completed.push(stage);
    if(stage!=='ENDED_FREE')await sleepImpl(1250);
  }

  const final=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
  if(!final.response.ok||final.body?.ok!==true||final.body.checkpointCount!==6||final.body.verdict!=='GO')throw new Error(`Final billing E2E verdict is not GO (${final.body?.checkpointCount||0}/6 ${final.body?.verdict||'UNKNOWN'})`);
  return {ok:true,verdict:'GO',checkpointCount:6,completed,realMoney:false,stripeMode:'SANDBOX'};
}

if(import.meta.url===`file://${process.argv[1]}`){
  runStripeSandboxE2e({baseUrl:process.env.MPR_BASE_URL,token:process.env.MPR_READINESS_PROBE_TOKEN,deploymentRef:process.env.GITHUB_SHA})
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(String(error?.message||error));process.exit(1);});
}
