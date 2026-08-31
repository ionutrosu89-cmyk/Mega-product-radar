const STAGES=['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
const text=value=>String(value??'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SHA_RE=/^[0-9a-f]{40}$/i;
const RETRYABLE_CAPTURE_STATUSES=new Set([409,502,503]);

async function jsonRequest(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};try{body=await response.json();}catch{}
  return {response,body};
}

function expectedNextStage(checkpointCount){
  const count=Number(checkpointCount);
  if(count===6)return null;
  if(!Number.isInteger(count)||count<1||count>5)return undefined;
  return STAGES[count-1];
}

function assertLedgerState(body){
  const count=Number(body?.checkpointCount);
  const expected=expectedNextStage(count);
  if(expected===undefined)throw new Error(`Journey requires at least a verified FREE baseline (got ${body?.checkpointCount??0}/6 ${body?.nextStage||'UNKNOWN'})`);
  if(count===6){
    if(body?.nextStage!==null||body?.verdict!=='GO')throw new Error(`Completed journey is not machine GO (got ${count}/6 ${body?.verdict||'UNKNOWN'})`);
    return {count,nextStage:null,go:true};
  }
  if(body?.nextStage!==expected||body?.verdict==='GO')throw new Error(`Journey ledger is inconsistent (got ${count}/6 ${body?.nextStage||'UNKNOWN'} ${body?.verdict||'UNKNOWN'})`);
  return {count,nextStage:expected,go:false};
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

  let current=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
  if(!current.response.ok||current.body?.ok!==true)throw new Error(`Acceptance lookup failed (${current.response.status} ${current.body?.code||'UNKNOWN'})`);
  let ledger=assertLedgerState(current.body);
  if(ledger.go)return {ok:true,verdict:'GO',checkpointCount:6,completed:[],reconciled:[],realMoney:false,stripeMode:'SANDBOX',alreadyComplete:true};

  const completed=[];
  const reconciled=[];
  while(!ledger.go){
    const stage=ledger.nextStage;
    const stageTargetCount=STAGES.indexOf(stage)+2;
    if(stageTargetCount<2)throw new Error(`Unsupported next billing E2E stage: ${stage||'UNKNOWN'}`);

    // Recovery path: a previous run may have completed the Stripe mutation and webhook
    // but stopped before the server-owned checkpoint was captured. Try capture first so
    // reruns never duplicate CREATE/UPDATE/CANCEL/END operations.
    const preCapture=await jsonRequest(acceptanceUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
    if(preCapture.response.ok&&preCapture.body?.ok===true&&preCapture.body?.capturedStage===stage){
      reconciled.push(stage);
      current={response:preCapture.response,body:preCapture.body};
      ledger=assertLedgerState(preCapture.body);
      if(!ledger.go)await sleepImpl(1250);
      continue;
    }
    if(!RETRYABLE_CAPTURE_STATUSES.has(preCapture.response.status))throw new Error(`${stage} pre-capture failed (${preCapture.response.status} ${preCapture.body?.code||'UNKNOWN'})`);

    // Re-read after the recovery probe. Another authorized run may have advanced the
    // ledger while this run was probing; in that case resume from the new next stage.
    current=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
    if(!current.response.ok||current.body?.ok!==true)throw new Error(`${stage} acceptance refresh failed (${current.response.status} ${current.body?.code||'UNKNOWN'})`);
    ledger=assertLedgerState(current.body);
    if(ledger.go)break;
    if(ledger.nextStage!==stage)continue;

    const transition=await jsonRequest(transitionUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
    if(!transition.response.ok||transition.body?.ok!==true)throw new Error(`${stage} transition failed (${transition.response.status} ${transition.body?.code||'UNKNOWN'})`);
    if(transition.body.realMoney!==false||transition.body.stripeMode!=='SANDBOX'||transition.body.entitlementAuthority!=='WEBHOOK_ONLY')throw new Error(`${stage} transition did not prove sandbox/webhook-only safety`);

    let captured=null;
    for(let attempt=0;attempt<maxPolls;attempt+=1){
      if(attempt>0)await sleepImpl(pollMs);
      const capture=await jsonRequest(acceptanceUrl,{method:'POST',headers:{...authHeaders,'content-type':'application/json'},body:JSON.stringify({stage})},fetchImpl);
      if(capture.response.ok&&capture.body?.ok===true&&capture.body?.capturedStage===stage){captured=capture.body;break;}
      current=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
      if(current.response.ok&&current.body?.ok===true&&Number(current.body.checkpointCount)>=stageTargetCount){captured=current.body;break;}
      if(!RETRYABLE_CAPTURE_STATUSES.has(capture.response.status))throw new Error(`${stage} capture failed (${capture.response.status} ${capture.body?.code||'UNKNOWN'})`);
    }
    if(!captured)throw new Error(`${stage} webhook-backed checkpoint timed out`);
    completed.push(stage);
    ledger=assertLedgerState(captured);
    if(!ledger.go)await sleepImpl(1250);
  }

  const final=await jsonRequest(acceptanceUrl,{headers:authHeaders},fetchImpl);
  if(!final.response.ok||final.body?.ok!==true)throw new Error(`Final billing E2E lookup failed (${final.response.status} ${final.body?.code||'UNKNOWN'})`);
  const finalLedger=assertLedgerState(final.body);
  if(!finalLedger.go)throw new Error(`Final billing E2E verdict is not GO (${final.body?.checkpointCount||0}/6 ${final.body?.verdict||'UNKNOWN'})`);
  return {ok:true,verdict:'GO',checkpointCount:6,completed,reconciled,realMoney:false,stripeMode:'SANDBOX',alreadyComplete:false};
}

if(import.meta.url===`file://${process.argv[1]}`){
  runStripeSandboxE2e({baseUrl:process.env.MPR_BASE_URL,token:process.env.MPR_READINESS_PROBE_TOKEN,deploymentRef:process.env.GITHUB_SHA})
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(String(error?.message||error));process.exit(1);});
}
