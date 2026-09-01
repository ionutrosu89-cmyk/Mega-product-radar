import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";
const REPO="ionutrosu89-cmyk/Mega-product-radar";
const REF="refs/heads/main";
const AUD="mpr-amazon-kaggle-overlap";
const WORKFLOW="/.github/workflows/amazon-kaggle-500k-overlap-v1.yml@refs/heads/main";
const jwks=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const json=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function rpc(url:string,key:string,args:unknown){const r=await fetch(`${url}/rest/v1/rpc/classify_existing_amazon_asins_v1`,{method:"POST",headers:{"content-type":"application/json",apikey:key,authorization:`Bearer ${key}`},body:JSON.stringify(args)});const t=await r.text();if(!r.ok)throw new Error(`RPC:${r.status}:${t.slice(0,800)}`);return JSON.parse(t)}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
 try{
  const auth=req.headers.get("authorization")||""; const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return json(401,{error:"GITHUB_OIDC_REQUIRED"});
  const {payload}=await jwtVerify(token,jwks,{issuer:"https://token.actions.githubusercontent.com",audience:AUD});
  const wr=String(payload.workflow_ref||"");
  if(payload.repository!==REPO||payload.ref!==REF||payload.event_name!=="push"||!wr.endsWith(WORKFLOW))return json(403,{error:"GITHUB_OIDC_SCOPE_REJECTED"});
  const body=await req.json(); if(body?.action!=="classify")return json(400,{error:"ACTION_REJECTED"});
  const asins=body?.asins; if(!Array.isArray(asins)||asins.length<1||asins.length>5000)return json(400,{error:"ASIN_BATCH_SCOPE_INVALID"});
  if(asins.some((x:any)=>typeof x!=="string"||!/^[A-Z0-9]{10}$/.test(x)))return json(400,{error:"ASIN_FORMAT_INVALID"});
  const url=Deno.env.get("SUPABASE_URL")||""; const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)return json(500,{error:"EDGE_SERVICE_CONFIGURATION_MISSING"});
  const receipt=await rpc(url,key,{p_asins:asins});
  return json(200,{ok:true,schema:"MPR_AMAZON_KAGGLE_OVERLAP_RECEIPT_V1",receipt,writePerformed:false,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false});
 }catch(e){return json(401,{error:"OIDC_OR_REQUEST_REJECTED",detail:String((e as any)?.message||e).slice(0,800)})}
});
