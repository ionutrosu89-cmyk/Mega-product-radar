import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='mpr-romania-refresh-consumer';
const REPOSITORY='ionutrosu89-cmyk/Mega-product-radar';
const ALLOWED_WORKFLOW='ionutrosu89-cmyk/Mega-product-radar/.github/workflows/romania-refresh-consumer-v1.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

Deno.serve(async(req)=>{
  if(req.method!=='POST') return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const auth=req.headers.get('authorization')||'';
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!token) return json(401,{error:'MISSING_OIDC_TOKEN'});
    const {payload}=await jwtVerify(token,JWKS,{issuer:ISSUER,audience:AUDIENCE});
    if(payload.repository!==REPOSITORY) return json(403,{error:'REPOSITORY_NOT_ALLOWED'});
    if(payload.ref!=='refs/heads/main') return json(403,{error:'REF_NOT_ALLOWED'});
    if(String(payload.job_workflow_ref||'')!==ALLOWED_WORKFLOW) return json(403,{error:'WORKFLOW_NOT_ALLOWED'});

    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||'').toLowerCase();
    const owner=`gh:${String(payload.run_id||'unknown')}:${String(payload.run_attempt||'1')}`.slice(0,180);

    if(action==='claim'){
      const requested=Number(body?.limit??10);
      const limit=Number.isInteger(requested)?Math.max(1,Math.min(25,requested)):10;
      const {data,error}=await supabase.rpc('claim_romania_refresh_jobs_v1',{p_owner:owner,p_limit:limit,p_lease_seconds:600});
      if(error) throw error;
      return json(200,{ok:true,action:'claim',owner,jobs:Array.isArray(data)?data:[],policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}});
    }

    if(action==='finish'){
      const jobId=Number(body?.jobId);
      if(!Number.isSafeInteger(jobId)||jobId<1) return json(400,{error:'INVALID_JOB_ID'});
      const outcome=String(body?.outcome||'').toUpperCase();
      if(!['COMPLETED','DEFERRED','FAILED'].includes(outcome)) return json(400,{error:'INVALID_OUTCOME'});
      const retryAfterSeconds=Number(body?.retryAfterSeconds??21600);
      const evidence=(body?.evidence&&typeof body.evidence==='object')?body.evidence:{};
      const {data,error}=await supabase.rpc('finish_romania_refresh_job_v1',{
        p_job_id:jobId,
        p_owner:owner,
        p_outcome:outcome,
        p_evidence:evidence,
        p_error:String(body?.error||'').slice(0,500)||null,
        p_retry_after_seconds:Number.isInteger(retryAfterSeconds)?retryAfterSeconds:21600
      });
      if(error) throw error;
      return json(200,{ok:true,action:'finish',owner,receipt:data});
    }

    return json(400,{error:'ACTION_NOT_ALLOWED'});
  }catch(error){
    console.error(error);
    return json(500,{error:'ROMANIA_REFRESH_CONSUMER_FAILED',message:String(error?.message||error).slice(0,240)});
  }
});
