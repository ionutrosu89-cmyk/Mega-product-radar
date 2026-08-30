import {pathToFileURL} from 'node:url';

const GATES=new Set(['SANDBOX','LIVE_PREREQS']);
const ENDPOINTS={
  billing:'/api/internal/billing-readiness',
  runtime:'/api/internal/paid-beta-runtime-readiness',
  legal:'/api/internal/legal-readiness',
  sandboxWorkspace:'/api/internal/billing-journey-snapshot'
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

export function assessSandboxWorkspacePreflight(checkpoint={}){
  const workspacePlan=String(checkpoint?.workspacePlan||'').trim().toUpperCase();
  const subscriptionStatus=String(checkpoint?.subscriptionStatus||'').trim().toLowerCase();
  const activeSubscriptionCount=Number(checkpoint?.activeSubscriptionCount);
  const cancelAtPeriodEnd=Boolean(checkpoint?.cancelAtPeriodEnd);
  const environment=String(checkpoint?.environment||'').trim().toUpperCase();
  const workspaceId=String(checkpoint?.workspaceId||'').trim();
  const statusInactive=['','none','canceled','cancelled','incomplete_expired','unpaid'].includes(subscriptionStatus);
  const clean=Boolean(
    environment==='SANDBOX'&&
    workspaceId&&
    workspacePlan==='FREE'&&
    Number.isInteger(activeSubscriptionCount)&&
    activeSubscriptionCount===0&&
    cancelAtPeriodEnd===false&&
    statusInactive
  );
  return {clean,workspacePlan,subscriptionStatus:subscriptionStatus||'none',activeSubscriptionCount:Number.isFinite(activeSubscriptionCount)?activeSubscriptionCount:null,cancelAtPeriodEnd,environment,workspaceId};
}

async function diagnostic(baseUrl,path,token,fetchImpl,headers={}){
  let response;
  try{
    response=await fetchImpl(`${baseUrl}${path}`,{headers:{authorization:`Bearer ${token}`,'cache-control':'no-cache',...headers}});
  }catch(error){return {ok:false,status:0,error:`NETWORK_ERROR: ${String(error?.message||error)}`};}
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok)return {ok:false,status:response.status,error:String(body?.error||`HTTP_${response.status}`)};
  return {ok:true,status:response.status,body};
}

export async function verifyPaidBetaDeployment({baseUrl,token,gate='SANDBOX',sandboxWorkspaceId,fetchImpl=fetch}={}){
  const url=normalizeBaseUrl(baseUrl);
  const mode=normalizeGate(gate);
  if(!String(token||'').trim())throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  const workspaceId=String(sandboxWorkspaceId||'').trim();
  if(mode==='SANDBOX'&&!workspaceId)throw new Error('MPR_SANDBOX_WORKSPACE_ID is required for SANDBOX preflight');

  const common=[
    diagnostic(url,ENDPOINTS.billing,token,fetchImpl),
    diagnostic(url,ENDPOINTS.runtime,token,fetchImpl),
    diagnostic(url,ENDPOINTS.legal,token,fetchImpl)
  ];
  const sandboxProbe=mode==='SANDBOX'
    ? diagnostic(url,ENDPOINTS.sandboxWorkspace,token,fetchImpl,{'x-mpr-workspace-id':workspaceId})
    : Promise.resolve({ok:true,status:0,body:{}});
  const [billingResult,runtimeResult,legalResult,sandboxResult]=await Promise.all([...common,sandboxProbe]);

  const diagnosticsReady=billingResult.ok&&runtimeResult.ok&&legalResult.ok;
  const billing=billingResult.body||{};
  const runtime=runtimeResult.body||{};
  const legal=legalResult.body||{};
  const checkpoint=sandboxResult.body?.checkpoint||{};
  const sandboxWorkspace=mode==='SANDBOX'?assessSandboxWorkspacePreflight(checkpoint):{clean:false};
  const sandboxWorkspaceReachable=mode==='SANDBOX'?sandboxResult.ok:true;
  const sandboxReady=Boolean(diagnosticsReady&&sandboxWorkspaceReachable&&billing.ready&&billing.stripeMode==='SANDBOX'&&runtime.ready&&sandboxWorkspace.clean);
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
      sandboxWorkspaceReachable,
      sandboxWorkspaceClean:Boolean(sandboxWorkspace.clean),
      sandboxReady,
      livePrereqsReady
    },
    sandboxWorkspace:mode==='SANDBOX'?sandboxWorkspace:null,
    endpoints:{
      billing:{ok:billingResult.ok,status:billingResult.status,error:billingResult.ok?null:billingResult.error},
      runtime:{ok:runtimeResult.ok,status:runtimeResult.status,error:runtimeResult.ok?null:runtimeResult.error},
      legal:{ok:legalResult.ok,status:legalResult.status,error:legalResult.ok?null:legalResult.error},
      sandboxWorkspace:mode==='SANDBOX'?{ok:sandboxResult.ok,status:sandboxResult.status,error:sandboxResult.ok?null:sandboxResult.error}:null
    },
    note:pass&&mode==='LIVE_PREREQS'
      ?'LIVE prerequisites are ready; Public Commercial GO still requires end-to-end payment/entitlement acceptance.'
      :pass?'Sandbox prerequisites and clean FREE workspace preflight are ready; this does not execute checkout or charge money.':'Deployment gate is not satisfied.'
  };
}

async function main(){
  try{
    const result=await verifyPaidBetaDeployment({
      baseUrl:process.env.MPR_BASE_URL,
      token:process.env.MPR_READINESS_PROBE_TOKEN,
      gate:process.env.MPR_DEPLOYMENT_GATE||'SANDBOX',
      sandboxWorkspaceId:process.env.MPR_SANDBOX_WORKSPACE_ID
    });
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
  }catch(error){
    console.error(JSON.stringify({ok:false,verdict:'NO-GO',error:String(error?.message||error)},null,2));
    process.exitCode=1;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
