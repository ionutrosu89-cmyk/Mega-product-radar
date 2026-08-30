import {pathToFileURL} from 'node:url';

const GATES=new Set(['SANDBOX','LIVE_PREREQS']);
const ENDPOINTS={
  billing:'/api/internal/billing-readiness',
  runtime:'/api/internal/paid-beta-runtime-readiness',
  legal:'/api/internal/legal-readiness'
};

export function normalizeBaseUrl(value){
  const raw=String(value||'').trim();
  if(!raw)throw new Error('MPR_BASE_URL is required');
  const url=new URL(raw);
  const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!local)throw new Error('MPR_BASE_URL must use HTTPS outside localhost');
  url.pathname='/';url.search='';url.hash='';
  return url.toString().replace(/\/$/,'');
}

export function normalizeGate(value='SANDBOX'){
  const gate=String(value||'SANDBOX').trim().toUpperCase();
  if(!GATES.has(gate))throw new Error(`Unsupported deployment gate: ${gate}`);
  return gate;
}

async function diagnostic(baseUrl,path,token,fetchImpl){
  let response;
  try{
    response=await fetchImpl(`${baseUrl}${path}`,{headers:{authorization:`Bearer ${token}`,'cache-control':'no-cache'}});
  }catch(error){return {ok:false,status:0,error:`NETWORK_ERROR: ${String(error?.message||error)}`};}
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok)return {ok:false,status:response.status,error:String(body?.error||`HTTP_${response.status}`)};
  return {ok:true,status:response.status,body};
}

export async function verifyPaidBetaDeployment({baseUrl,token,gate='SANDBOX',fetchImpl=fetch}={}){
  const url=normalizeBaseUrl(baseUrl);
  const mode=normalizeGate(gate);
  if(!String(token||'').trim())throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  const [billingResult,runtimeResult,legalResult]=await Promise.all([
    diagnostic(url,ENDPOINTS.billing,token,fetchImpl),
    diagnostic(url,ENDPOINTS.runtime,token,fetchImpl),
    diagnostic(url,ENDPOINTS.legal,token,fetchImpl)
  ]);
  const diagnosticsReady=billingResult.ok&&runtimeResult.ok&&legalResult.ok;
  const billing=billingResult.body||{};
  const runtime=runtimeResult.body||{};
  const legal=legalResult.body||{};
  const sandboxReady=Boolean(diagnosticsReady&&billing.ready&&billing.stripeMode==='SANDBOX'&&runtime.ready);
  const livePrereqsReady=Boolean(diagnosticsReady&&billing.publicLaunchBillingReady&&runtime.ready&&legal.ready);
  const pass=mode==='SANDBOX'?sandboxReady:livePrereqsReady;
  return {
    ok:pass,
    gate:mode,
    verdict:pass?'GO':'NO-GO',
    baseUrl:url,
    checks:{
      diagnosticsReachable:diagnosticsReady,
      billingReady:Boolean(billing.ready),
      stripeMode:String(billing.stripeMode||'UNKNOWN'),
      databaseRuntimeReady:Boolean(runtime.ready),
      legalP0Ready:Boolean(legal.ready),
      sandboxReady,
      livePrereqsReady
    },
    endpoints:{
      billing:{ok:billingResult.ok,status:billingResult.status,error:billingResult.ok?null:billingResult.error},
      runtime:{ok:runtimeResult.ok,status:runtimeResult.status,error:runtimeResult.ok?null:runtimeResult.error},
      legal:{ok:legalResult.ok,status:legalResult.status,error:legalResult.ok?null:legalResult.error}
    },
    note:pass&&mode==='LIVE_PREREQS'
      ?'LIVE prerequisites are ready; Public Commercial GO still requires end-to-end payment/entitlement acceptance.'
      :pass?'Sandbox prerequisites are ready; this does not execute checkout or charge money.':'Deployment gate is not satisfied.'
  };
}

async function main(){
  try{
    const result=await verifyPaidBetaDeployment({
      baseUrl:process.env.MPR_BASE_URL,
      token:process.env.MPR_READINESS_PROBE_TOKEN,
      gate:process.env.MPR_DEPLOYMENT_GATE||'SANDBOX'
    });
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
  }catch(error){
    console.error(JSON.stringify({ok:false,verdict:'NO-GO',error:String(error?.message||error)},null,2));
    process.exitCode=1;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
