import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const REPO="ionutrosu89-cmyk/Mega-product-radar";
const REF="refs/heads/main";
const AUD="mpr-current-search-signals";
const WORKFLOW_SUFFIX="/.github/workflows/google-trends-ro-current-v1.yml@refs/heads/main";
const ALLOWED_EVENTS=new Set(["push","schedule","workflow_dispatch"]);
const jwks=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const clean=(value:unknown)=>String(value??"").trim();

async function insertRows(url:string,key:string,rows:any[]){
  const response=await fetch(`${url}/rest/v1/current_search_signals_v1?on_conflict=source_key,market,window_days,observed_at,normalized_query,signal_type`,{
    method:"POST",
    headers:{apikey:key,authorization:`Bearer ${key}`,"content-type":"application/json",prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(rows)
  });
  const text=await response.text();
  if(!response.ok)throw new Error(`CURRENT_SEARCH_SIGNAL_PERSIST_${response.status}:${text.slice(0,500)}`);
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const auth=req.headers.get("authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return json(401,{error:"GITHUB_OIDC_REQUIRED"});
    const {payload}=await jwtVerify(token,jwks,{issuer:"https://token.actions.githubusercontent.com",audience:AUD});
    const workflowRef=String(payload.workflow_ref||"");const eventName=String(payload.event_name||"");
    if(payload.repository!==REPO||payload.ref!==REF||!ALLOWED_EVENTS.has(eventName)||!workflowRef.endsWith(WORKFLOW_SUFFIX))return json(403,{error:"GITHUB_OIDC_SCOPE_REJECTED"});
    const body=await req.json();
    if(clean(body?.expectedSha)!==String(payload.sha||""))return json(403,{error:"HEAD_SHA_MISMATCH"});
    if(body?.action!=="persist")return json(400,{error:"ACTION_REJECTED"});
    const rows=Array.isArray(body?.rows)?body.rows:[];
    if(rows.length>25)return json(400,{error:"ROWS_SCOPE_INVALID"});
    if(rows.length===0)return json(200,{ok:true,schema:"MPR_CURRENT_SEARCH_SIGNAL_RECEIPT_V1",inserted:0,policy:{verifiedSales:false,purchaseAuthorized:false}});
    const allowedTypes=new Set(["TRENDING_NOW","TOP_TERM","RISING_TERM"]);
    const valid=rows.every((row:any)=>
      clean(row?.source_key)==="GOOGLE_TRENDS_RSS_RO"&&clean(row?.market)==="RO"&&Number(row?.window_days)===1&&allowedTypes.has(clean(row?.signal_type))&&clean(row?.evidence_class)==="DIRECT"&&clean(row?.rights_status)==="APPROVED_OFFICIAL_PUBLIC_EXPORT"&&/^https:\/\/trends\.google\.com\//.test(clean(row?.source_url))&&clean(row?.query_text).length>0&&clean(row?.normalized_query).length>0
    );
    if(!valid)return json(400,{error:"TRUTH_OR_SOURCE_POLICY_INVALID"});
    const url=Deno.env.get("SUPABASE_URL")||"";const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!url||!key)return json(500,{error:"EDGE_SERVICE_CONFIGURATION_MISSING"});
    await insertRows(url,key,rows);
    return json(200,{ok:true,schema:"MPR_CURRENT_SEARCH_SIGNAL_RECEIPT_V1",inserted:rows.length,policy:{verifiedSales:false,purchaseAuthorized:false,providerSpendEur:0}});
  }catch(error){return json(401,{error:"OIDC_OR_REQUEST_REJECTED",detail:String((error as any)?.message||error).slice(0,700)});}
});
