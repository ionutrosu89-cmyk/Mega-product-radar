import {SAAS_CONFIG} from '../../saas-config.js';
import {appendBillingCheckpoint} from '../../scripts/capture-billing-journey-checkpoint.mjs';
import {REQUIRED_STAGES,verifyBillingJourneyEvidence} from '../../scripts/verify-billing-journey-evidence.mjs';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';
import {createBillingJourneySnapshotHandler} from './billing-journey-snapshot.mjs';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};
const text=value=>String(value??'').trim();

async function jsonFetch(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};
  try{body=await response.json();}catch{}
  return {ok:response.ok,status:response.status,body};
}

function safeRun(row){
  if(!row)return {configured:true,exists:false,status:'NOT_STARTED',checkpointCount:0,nextStage:REQUIRED_STAGES[0],verdict:'NO-GO',updatedAt:null};
  const count=Number(row.checkpoint_count)||0;
  return {
    configured:true,
    exists:true,
    status:text(row.status)||'IN_PROGRESS',
    checkpointCount:count,
    nextStage:count<REQUIRED_STAGES.length?REQUIRED_STAGES[count]:null,
    verdict:text(row.status)==='GO'?'GO':'NO-GO',
    updatedAt:row.updated_at||null
  };
}

async function loadRun({supabaseUrl,service,workspaceId,fetchImpl}){
  const headers={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
  return jsonFetch(`${supabaseUrl}/rest/v1/billing_e2e_acceptance_runs?select=id,status,evidence,verdict,checkpoint_count,version,updated_at&environment=eq.SANDBOX&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers},fetchImpl);
}

export function createBillingE2eAcceptanceHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date()}={}){
  return async request=>{
    try{
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const service=text(env.SUPABASE_SERVICE_ROLE_KEY);
      const workspaceId=text(env.MPR_SANDBOX_WORKSPACE_ID);
      const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
      if(!authorization.ok)return authorization.response;
      if(!service||!supabaseUrl)return Response.json({ok:false,code:'ACCEPTANCE_NOT_CONFIGURED',error:'Billing E2E acceptance storage is not configured'},{status:503,headers:RESPONSE_HEADERS});
      if(!workspaceId)return Response.json({ok:false,code:'SANDBOX_WORKSPACE_NOT_CONFIGURED',error:'Dedicated sandbox workspace is not configured'},{status:503,headers:RESPONSE_HEADERS});

      const current=await loadRun({supabaseUrl,service,workspaceId,fetchImpl});
      if(!current.ok)return Response.json({ok:false,code:'ACCEPTANCE_LOOKUP_FAILED',error:'Billing E2E acceptance state unavailable'},{status:502,headers:RESPONSE_HEADERS});
      const row=Array.isArray(current.body)?current.body[0]||null:null;

      if(request.method==='GET')return Response.json({ok:true,...safeRun(row)},{headers:RESPONSE_HEADERS});
      if(request.method!=='POST')return new Response(null,{status:405,headers:RESPONSE_HEADERS});

      const body=await request.json().catch(()=>({}));
      const action=text(body.action).toUpperCase();
      if(action==='RESET'){
        if(text(body.confirm)!=='RESET_SANDBOX_ACCEPTANCE')return Response.json({ok:false,code:'RESET_CONFIRMATION_REQUIRED',error:'Explicit reset confirmation is required'},{status:400,headers:RESPONSE_HEADERS});
        if(row?.status==='GO')return Response.json({ok:false,code:'VERIFIED_RUN_IMMUTABLE',error:'A verified GO run cannot be reset in place'},{status:409,headers:RESPONSE_HEADERS});
        if(row){
          const deletion=await jsonFetch(`${supabaseUrl}/rest/v1/billing_e2e_acceptance_runs?id=eq.${encodeURIComponent(row.id)}&version=eq.${Number(row.version)}`,{method:'DELETE',headers:{apikey:service,authorization:`Bearer ${service}`,Prefer:'return=representation'}},fetchImpl);
          if(!deletion.ok||!Array.isArray(deletion.body)||deletion.body.length!==1)return Response.json({ok:false,code:'RESET_CONFLICT',error:'Acceptance state changed during reset'},{status:409,headers:RESPONSE_HEADERS});
        }
        return Response.json({ok:true,...safeRun(null)},{headers:RESPONSE_HEADERS});
      }

      const stage=text(body.stage).toUpperCase();
      const expectedStage=row?REQUIRED_STAGES[Number(row.checkpoint_count)||0]:REQUIRED_STAGES[0];
      if(!REQUIRED_STAGES.includes(stage))return Response.json({ok:false,code:'INVALID_STAGE',error:'Unsupported billing journey stage'},{status:400,headers:RESPONSE_HEADERS});
      if(stage!==expectedStage)return Response.json({ok:false,code:'STAGE_OUT_OF_ORDER',error:`Expected ${expectedStage||'no further stage'}`},{status:409,headers:RESPONSE_HEADERS});
      if(row?.status==='GO')return Response.json({ok:false,code:'VERIFIED_RUN_IMMUTABLE',error:'Billing E2E acceptance is already verified'},{status:409,headers:RESPONSE_HEADERS});

      const snapshotHandler=createBillingJourneySnapshotHandler({fetch:fetchImpl,env,now});
      const snapshotRequest=new Request(request.url,{headers:{authorization:request.headers.get('authorization')||'','x-mpr-workspace-id':workspaceId,accept:'application/json'}});
      const snapshotResponse=await snapshotHandler(snapshotRequest);
      const snapshotBody=await snapshotResponse.json().catch(()=>({}));
      if(!snapshotResponse.ok||!snapshotBody?.ok||!snapshotBody?.checkpoint)return Response.json({ok:false,code:snapshotBody?.code||'SNAPSHOT_FAILED',error:snapshotBody?.error||'Sandbox snapshot failed'},{status:snapshotResponse.status||502,headers:RESPONSE_HEADERS});

      let evidence;
      try{evidence=appendBillingCheckpoint(row?.evidence||null,stage,snapshotBody.checkpoint);}
      catch(error){return Response.json({ok:false,code:'CHECKPOINT_REJECTED',error:String(error?.message||error)},{status:409,headers:RESPONSE_HEADERS});}

      const checkpointCount=evidence.checkpoints.length;
      const complete=checkpointCount===REQUIRED_STAGES.length;
      const verdict=complete?verifyBillingJourneyEvidence(evidence):null;
      const status=complete?(verdict.ok?'GO':'NO_GO'):'IN_PROGRESS';
      const time=now().toISOString();
      const dbHeaders={apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',accept:'application/json',Prefer:'return=representation'};

      let saved;
      if(!row){
        saved=await jsonFetch(`${supabaseUrl}/rest/v1/billing_e2e_acceptance_runs`,{method:'POST',headers:dbHeaders,body:JSON.stringify({environment:'SANDBOX',workspace_id:workspaceId,status,evidence,verdict,checkpoint_count:checkpointCount,version:1,started_at:time,completed_at:status==='GO'?time:null,updated_at:time})},fetchImpl);
      }else{
        saved=await jsonFetch(`${supabaseUrl}/rest/v1/billing_e2e_acceptance_runs?id=eq.${encodeURIComponent(row.id)}&version=eq.${Number(row.version)}`,{method:'PATCH',headers:dbHeaders,body:JSON.stringify({status,evidence,verdict,checkpoint_count:checkpointCount,version:Number(row.version)+1,completed_at:status==='GO'?time:null,updated_at:time})},fetchImpl);
      }
      if(!saved.ok||!Array.isArray(saved.body)||saved.body.length!==1)return Response.json({ok:false,code:'CAPTURE_CONFLICT',error:'Acceptance state changed while checkpoint was captured'},{status:409,headers:RESPONSE_HEADERS});
      return Response.json({ok:true,...safeRun(saved.body[0]),capturedStage:stage},{headers:RESPONSE_HEADERS});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:RESPONSE_HEADERS});
    }
  };
}

export default createBillingE2eAcceptanceHandler();
export const config={path:'/api/internal/billing-e2e-acceptance'};
