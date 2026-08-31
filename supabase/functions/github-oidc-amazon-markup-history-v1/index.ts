import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const REPO="ionutrosu89-cmyk/Mega-product-radar";
const REF="refs/heads/main";
const AUD="mpr-amazon-markup-history";
const ALLOWED_WORKFLOWS=[
  "/.github/workflows/g2-markup-search-history-pilot-v1.yml@refs/heads/main",
  "/.github/workflows/g2-markup-search-history-scale-v1.yml@refs/heads/main"
];
const jwks=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

async function rpc(url:string,key:string,name:string,args:unknown){
  const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{"content-type":"application/json",apikey:key,authorization:`Bearer ${key}`},body:JSON.stringify(args)});
  const text=await r.text();
  if(!r.ok)throw new Error(`${name}:${r.status}:${text.slice(0,800)}`);
  try{return JSON.parse(text)}catch{return text}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const auth=req.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return json(401,{error:"GITHUB_OIDC_REQUIRED"});
    const {payload}=await jwtVerify(token,jwks,{issuer:"https://token.actions.githubusercontent.com",audience:AUD});
    const wr=String(payload.workflow_ref||"");
    const workflowOk=ALLOWED_WORKFLOWS.some(s=>wr.endsWith(s));
    if(payload.repository!==REPO||payload.ref!==REF||payload.event_name!=="push"||!workflowOk)return json(403,{error:"GITHUB_OIDC_SCOPE_REJECTED"});
    const body=await req.json();
    if(String(body?.expectedSha||"")!==String(payload.sha||""))return json(403,{error:"HEAD_SHA_MISMATCH"});
    if(body?.action!=="persist")return json(400,{error:"ACTION_REJECTED"});
    const rows=body?.rows;
    if(!Array.isArray(rows)||rows.length<1||rows.length>250)return json(400,{error:"ROWS_SCOPE_INVALID"});
    if(rows.some((x:any)=>x?.evidenceClass!=="HISTORICAL_PUBLIC_SEARCH_RESULT"||x?.freshnessClass!=="HISTORICAL_2021_NOT_LIVE"||x?.observedAtPrecision!=="DAY"||x?.salesEvidenceClass!=="NOT_VERIFIED_SALES"||x?.purchaseAuthorized!==false||x?.sourceDatasetSha256!=="0071593ee788681df31110b1490fe2b71243003ece1666a415c06fa3f5cdd985"))return json(400,{error:"TRUTH_POLICY_INVALID"});
    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!url||!key)return json(500,{error:"EDGE_SERVICE_CONFIGURATION_MISSING"});
    const receipt=await rpc(url,key,"persist_amazon_markup_search_observations_v1",{p_rows:rows});
    return json(200,{ok:true,schema:"MPR_AMAZON_MARKUP_HISTORY_PERSIST_RECEIPT_V1",deploymentSha:String(payload.sha),receipt,policy:{historicalOnly:true,verifiedSales:false,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false}});
  }catch(e){return json(401,{error:"OIDC_OR_REQUEST_REJECTED",detail:String((e as any)?.message||e).slice(0,800)})}
});
