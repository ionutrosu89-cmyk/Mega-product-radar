const text=value=>String(value??'').trim();

export async function ensureFreeBaseline({baseUrl,token,fetchImpl=fetch}={}){
  const root=text(baseUrl).replace(/\/+$/,'');
  const credential=text(token);
  if(!root)throw new Error('MPR_BASE_URL is required');
  if(!credential)throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  const url=`${root}/api/internal/billing-e2e-acceptance`;
  const headers={authorization:`Bearer ${credential}`,accept:'application/json'};
  const currentResponse=await fetchImpl(url,{headers});
  const current=await currentResponse.json().catch(()=>({}));
  if(!currentResponse.ok||current?.ok!==true)throw new Error(`Billing E2E acceptance lookup failed (${currentResponse.status})`);

  const count=Number(current.checkpointCount)||0;
  if(count>0||current.verdict==='GO'){
    return {ok:true,action:'NOOP',checkpointCount:count,nextStage:current.nextStage||null,verdict:current.verdict||'NO-GO'};
  }
  if(current.nextStage!=='FREE_BASELINE')throw new Error(`Unexpected first billing E2E stage: ${current.nextStage||'UNKNOWN'}`);

  const captureResponse=await fetchImpl(url,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({stage:'FREE_BASELINE'})});
  const captured=await captureResponse.json().catch(()=>({}));
  if(!captureResponse.ok||captured?.ok!==true||captured?.capturedStage!=='FREE_BASELINE'){
    throw new Error(`FREE_BASELINE capture failed (${captureResponse.status} ${captured?.code||'UNKNOWN'})`);
  }
  return {ok:true,action:'CAPTURED',checkpointCount:Number(captured.checkpointCount)||0,nextStage:captured.nextStage||null,verdict:captured.verdict||'NO-GO'};
}

if(import.meta.url===`file://${process.argv[1]}`){
  ensureFreeBaseline({baseUrl:process.env.MPR_BASE_URL,token:process.env.MPR_READINESS_PROBE_TOKEN})
    .then(result=>{console.log(JSON.stringify(result,null,2));})
    .catch(error=>{console.error(String(error?.message||error));process.exit(1);});
}
