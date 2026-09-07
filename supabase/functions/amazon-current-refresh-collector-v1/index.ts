import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TOKEN_SHA256='84c68e27ed2ff9bbe881cd3fb0a0914f9bb693e5f2b1e3391e2b913e626a59e0';
const LIMIT=10;
const json=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const clean=(v:any)=>String(v??'').replace(/\s+/g,' ').trim();
const num=(v:any)=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null};
async function sha256(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const decode=(s:string)=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
function extract(html:string,asin:string){
  const title=clean(decode(html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,' ')));
  const rating=num(html.match(/([0-5](?:\.[0-9])?)\s*out of 5 stars/i)?.[1]);
  const reviewCount=num(html.match(/([0-9][0-9,\.]*)\s+(?:ratings|global ratings|reviews)/i)?.[1]);
  const price=num([html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([^<]+)/i)?.[1],html.match(/id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)/i)?.[1],html.match(/id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)/i)?.[1]].find(Boolean));
  const blocked=/robot check|enter the characters you see below|sorry! something went wrong/i.test(html);
  const pageIdentity=html.toUpperCase().includes(asin);
  return{title:title||null,rating,reviewCount,price,blocked,pageIdentity};
}
async function rpc(url:string,key:string,name:string,args:any){
  const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json',apikey:key,authorization:`Bearer ${key}`},body:JSON.stringify(args)});
  const text=await r.text(); if(!r.ok)throw new Error(`${name}:${r.status}:${text.slice(0,400)}`); try{return JSON.parse(text)}catch{return text}
}
async function fetchOne(t:any){
  const asin=String(t.external_id||'').toUpperCase(),sourceUrl=`https://www.amazon.com/dp/${asin}`;
  try{
    const r=await fetch(sourceUrl,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await r.text(),x=extract(html,asin); const valid=r.ok&&!x.blocked&&x.pageIdentity&&Boolean(x.title||x.rating!==null||x.reviewCount!==null||x.price!==null);
    return{asin,sourceUrl,statusCode:r.status,htmlBytes:html.length,valid,...x,error:null};
  }catch(e){return{asin,sourceUrl,statusCode:null,htmlBytes:0,valid:false,title:null,rating:null,reviewCount:null,price:null,blocked:false,pageIdentity:false,error:String((e as any)?.message||e)}}
}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const a=req.headers.get('authorization')||'',tok=a.startsWith('Bearer ')?a.slice(7):'';
    if(!tok||await sha256(tok)!==TOKEN_SHA256)return json(401,{ok:false,error:'CRON_AUTH_REJECTED'});
    const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!url||!service)return json(500,{ok:false,error:'SERVICE_CONFIGURATION_MISSING'});
    const targets=await rpc(url,service,'amazon_current_refresh_targets_v1',{p_limit:LIMIT});
    if(!Array.isArray(targets)||targets.length<1||targets.length>LIMIT)return json(409,{ok:false,error:'TARGET_SCOPE_INVALID',count:Array.isArray(targets)?targets.length:null});
    if(targets.some((x:any)=>Number(x.live_observation_count)<1||!/^B[A-Z0-9]{9}$/.test(String(x.external_id||''))||!x.last_live_observed_at))return json(409,{ok:false,error:'TARGET_CONTENT_INVALID'});
    const observedAt=new Date().toISOString(),diag:any[]=[],obs:any[]=[];
    for(let i=0;i<targets.length;i+=5){const res=await Promise.all(targets.slice(i,i+5).map(fetchOne));for(const x of res){diag.push(x);if(x.valid)obs.push({externalId:x.asin,title:x.title,price:x.price,currency:x.price!==null?'USD':null,rating:x.rating,reviewCount:x.reviewCount,observedAt,sourceUrl:x.sourceUrl,sourceKey:'AMAZON_CURRENT_REFRESH_PUBLIC_PAGE_V1',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false})}}
    let receipt=null;if(obs.length)receipt=await rpc(url,service,'persist_amazon_live_observations_v1',{p_rows:obs});
    return json(200,{ok:true,requested:targets.length,validObservations:obs.length,successRatePct:targets.length?Math.round(obs.length/targets.length*1000)/10:0,blocked:diag.filter(x=>x.blocked).length,httpFailures:diag.filter(x=>x.statusCode&&x.statusCode>=400).length,receipt,policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,verifiedSales:false,purpose:'REPEATED_CURRENT_OBSERVATION'}});
  }catch(e){return json(500,{ok:false,error:'COLLECTOR_FAILED',detail:String((e as any)?.message||e).slice(0,600)})}
});
