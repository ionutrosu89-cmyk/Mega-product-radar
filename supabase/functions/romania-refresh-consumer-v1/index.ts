import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='mpr-romania-refresh-consumer';
const REPOSITORY='ionutrosu89-cmyk/Mega-product-radar';
const ALLOWED_WORKFLOW='ionutrosu89-cmyk/Mega-product-radar/.github/workflows/romania-refresh-consumer-v1.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const USER_AGENT='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

function emagSearchUrl(query:string){return `https://www.emag.ro/search/${encodeURIComponent(query.trim().slice(0,160))}`;}
function parseEmag(html:string){
  const urls=new Set<string>();
  for(const m of html.matchAll(/href=["']([^"']*\/pd\/[A-Za-z0-9]+\/?[^"']*)["']/gi)){
    let v=String(m[1]||'').replace(/&amp;/g,'&');
    if(v.startsWith('//'))v='https:'+v;
    if(v.startsWith('/'))v='https://www.emag.ro'+v;
    if(v.startsWith('https://www.emag.ro/')){try{const u=new URL(v);u.search='';u.hash='';urls.add(u.toString());}catch{}}
  }
  const blockedHeuristic=/captcha|access denied|verify you are human|temporarily unavailable|cloudflare/i.test(html);
  return {urls:[...urls],blockedHeuristic};
}
async function collectEmag(job:any){
  const query=String(job?.title||'').trim();
  if(!query)return {outcome:'DEFERRED',error:'EMPTY_CANONICAL_TITLE',retryAfterSeconds:86400};
  const sourceUrl=emagSearchUrl(query);
  const observedAt=new Date().toISOString();
  try{
    const r=await fetch(sourceUrl,{headers:{'user-agent':USER_AGENT,'accept':'text/html,application/xhtml+xml','accept-language':'ro-RO,ro;q=0.9,en;q=0.7'},redirect:'follow',signal:AbortSignal.timeout(18000)});
    const html=await r.text();
    const parsed=parseEmag(html);
    const usable=r.ok&&r.status===200&&parsed.urls.length>0&&html.length>20000;
    if(!usable)return {outcome:'DEFERRED',error:`EMAG_EDGE_UNUSABLE status=${r.status} links=${parsed.urls.length} bytes=${html.length}`,retryAfterSeconds:r.status===429?43200:21600,status:r.status,links:parsed.urls.length};
    return {outcome:'COMPLETED',status:r.status,links:parsed.urls.length,evidence:{
      surface:'EMAG_RO',observedAt,sourceUrl,searchQuery:query,
      evidenceClass:'LIVE_PUBLIC_MARKET_SEARCH_PAGE',freshnessClass:'LIVE_PUBLIC_SEARCH_PAGE',
      productLinkLowerBound:parsed.urls.length,declaredResultCountCandidate:null,declaredResultCountTrusted:false,sellerCount:null,
      comparableScopeConfirmed:false,marketWideCompetitionReady:false,comparabilityConfidence:null,
      salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false,
      collectorVersion:'romania-refresh-consumer-edge-v2',statusCode:r.status,blockedHeuristic:parsed.blockedHeuristic,
      contentValidatedByProductLinks:true,productUrls:parsed.urls.slice(0,30),
      policy:{lowerBoundIsNotExact:true,searchResultIsNotIdentity:true,zeroWouldNotProveGap:true,verifiedSales:false}
    }};
  }catch(error){return {outcome:'DEFERRED',error:`EMAG_EDGE_ERROR:${String((error as Error)?.message||error).slice(0,280)}`,retryAfterSeconds:21600};}
}
async function finish(jobId:number,owner:string,result:any){
  const {data,error}=await supabase.rpc('finish_romania_refresh_job_v1',{p_job_id:jobId,p_owner:owner,p_outcome:result.outcome,p_evidence:result.evidence||{},p_error:result.error||null,p_retry_after_seconds:result.retryAfterSeconds||21600});
  if(error)throw error;return data;
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const auth=req.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!token)return json(401,{error:'MISSING_OIDC_TOKEN'});
    const {payload}=await jwtVerify(token,JWKS,{issuer:ISSUER,audience:AUDIENCE});
    if(payload.repository!==REPOSITORY)return json(403,{error:'REPOSITORY_NOT_ALLOWED'});
    if(payload.ref!=='refs/heads/main')return json(403,{error:'REF_NOT_ALLOWED'});
    if(String(payload.job_workflow_ref||'')!==ALLOWED_WORKFLOW)return json(403,{error:'WORKFLOW_NOT_ALLOWED'});
    const body=await req.json().catch(()=>({}));const action=String(body?.action||'').toLowerCase();
    const workerId=String(body?.workerId||'0').replace(/[^A-Za-z0-9_-]/g,'').slice(0,24)||'0';
    const owner=`gh:${String(payload.run_id||'unknown')}:${String(payload.run_attempt||'1')}:${workerId}`.slice(0,180);
    if(action==='claim'){
      const requested=Number(body?.limit??10);const limit=Number.isInteger(requested)?Math.max(1,Math.min(25,requested)):10;
      const {data,error}=await supabase.rpc('claim_romania_refresh_jobs_v1',{p_owner:owner,p_limit:limit,p_lease_seconds:600});if(error)throw error;
      return json(200,{ok:true,action:'claim',owner,jobs:Array.isArray(data)?data:[],policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}});
    }
    if(action==='finish'){
      const jobId=Number(body?.jobId);if(!Number.isSafeInteger(jobId)||jobId<1)return json(400,{error:'INVALID_JOB_ID'});
      const outcome=String(body?.outcome||'').toUpperCase();if(!['COMPLETED','DEFERRED','FAILED'].includes(outcome))return json(400,{error:'INVALID_OUTCOME'});
      const receipt=await finish(jobId,owner,{outcome,evidence:(body?.evidence&&typeof body.evidence==='object')?body.evidence:{},error:String(body?.error||'').slice(0,500)||null,retryAfterSeconds:Number.isInteger(Number(body?.retryAfterSeconds))?Number(body.retryAfterSeconds):21600});
      return json(200,{ok:true,action:'finish',owner,receipt});
    }
    if(action==='collectbatch'){
      const requested=Number(body?.limit??8);const limit=Number.isInteger(requested)?Math.max(1,Math.min(12,requested)):8;
      const {data,error}=await supabase.rpc('claim_romania_refresh_jobs_v1',{p_owner:owner,p_limit:limit,p_lease_seconds:600});if(error)throw error;
      const jobs=Array.isArray(data)?data:[];const receipts:any[]=[];let consecutiveUnusable=0;
      for(const job of jobs){
        let result:any;
        if(job.target_surface!=='EMAG_RO')result={outcome:'DEFERRED',error:'EDGE_ADAPTER_SURFACE_NOT_APPROVED',retryAfterSeconds:86400};
        else if(consecutiveUnusable>=2)result={outcome:'DEFERRED',error:'EMAG_EDGE_CIRCUIT_OPEN_AFTER_TWO_UNUSABLE',retryAfterSeconds:21600};
        else result=await collectEmag(job);
        if(job.target_surface==='EMAG_RO'&&result.outcome!=='COMPLETED')consecutiveUnusable++; else if(result.outcome==='COMPLETED')consecutiveUnusable=0;
        const receipt=await finish(Number(job.id),owner,result);
        receipts.push({jobId:job.id,productId:job.product_id,surface:job.target_surface,outcome:result.outcome,status:result.status??null,productLinkLowerBound:result.links??null,receipt,error:result.error||null});
        if(job.target_surface==='EMAG_RO'&&result.outcome==='COMPLETED')await new Promise(r=>setTimeout(r,300));
      }
      return json(200,{ok:true,schemaVersion:'MPR_ROMANIA_EDGE_HYDRATION_BATCH_V1',owner,claimed:jobs.length,completed:receipts.filter(x=>x.outcome==='COMPLETED').length,deferred:receipts.filter(x=>x.outcome==='DEFERRED').length,failed:receipts.filter(x=>x.outcome==='FAILED').length,receipts,policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',comparabilityPromoted:false,missingAsZero:false}});
    }
    return json(400,{error:'ACTION_NOT_ALLOWED'});
  }catch(error){console.error(error);return json(500,{error:'ROMANIA_REFRESH_CONSUMER_FAILED',message:String((error as Error)?.message||error).slice(0,360),policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false}});}
});
