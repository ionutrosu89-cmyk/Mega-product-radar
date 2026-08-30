import fs from 'node:fs/promises';
import path from 'node:path';
import {metricRefreshReadiness,buildMetricComparison} from '../amazon-metric-comparison-v1.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const input=String(args.input||'artifacts/amazon-metric-source/amazon-round1-canonical-bridge.json');
const out=String(args.out||'artifacts/amazon-metric-refresh/amazon-metric-comparison.json');
const now=String(args.now||new Date().toISOString());
const minIntervalMs=Math.max(1,Number(args.minIntervalMs||24*60*60*1000));
const concurrency=Math.max(1,Math.min(5,Number(args.concurrency)||5));

const bridge=JSON.parse(await fs.readFile(input,'utf8'));
const readiness=metricRefreshReadiness(bridge,{now,minIntervalMs});
await fs.mkdir(path.dirname(out),{recursive:true});
if(!readiness.ready){
  const wait={schemaVersion:'MPR_AMAZON_METRIC_REFRESH_WAIT_V1',generatedAt:new Date().toISOString(),decision:'WAIT',reason:'MIN_INTERVAL_NOT_REACHED',readiness,policy:{externalRequestsTriggered:0,providerSpendEur:0,paidCallsTriggered:0,salesEvidenceClass:'NOT_VERIFIED_SALES',reviewGrowthIsSales:false,demandTrendAuthorized:false,purchaseAuthorized:false}};
  await fs.writeFile(out,JSON.stringify(wait,null,2)+'\n');
  console.log(JSON.stringify(wait,null,2));
  process.exit(0);
}

function decodeEntities(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');}
function extract(html,asin){
  const title=clean(decodeEntities(html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,' ')));
  const rating=num(html.match(/([0-5](?:\.[0-9])?)\s*out of 5 stars/i)?.[1]);
  const reviewCount=num(html.match(/([0-9][0-9,\.]*)\s+(?:ratings|global ratings|reviews)/i)?.[1]);
  const priceCandidates=[html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([^<]+)/i)?.[1],html.match(/id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)/i)?.[1],html.match(/id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)/i)?.[1]];
  const price=num(priceCandidates.find(Boolean));
  const blocked=/robot check|enter the characters you see below|sorry! something went wrong/i.test(html);
  const pageIdentity=html.toUpperCase().includes(asin);
  return{title:title||null,rating,reviewCount,price,blocked,pageIdentity};
}

async function fetchOne(base){
  const asin=clean(base.externalId).toUpperCase();
  const url=`https://www.amazon.com/dp/${asin}`;
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const response=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await response.text();const x=extract(html,asin);
    const valid=response.ok&&!x.blocked&&x.pageIdentity&&Boolean(x.title||x.rating!==null||x.reviewCount!==null||x.price!==null);
    return {valid,diagnostic:{externalId:asin,statusCode:response.status,htmlBytes:html.length,blocked:x.blocked,pageIdentity:x.pageIdentity},observation:valid?{sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',platform:'AMAZON',marketplace:'AMAZON',externalId:asin,canonicalKey:`AMAZON:AMAZON:${asin}`,url,title:x.title,price:x.price,currency:x.price!==null?'USD':null,rating:x.rating,reviewCount:x.reviewCount,observedAt:new Date().toISOString(),freshnessClass:'LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',trendAuthorized:false,purchaseAuthorized:false,provenance:{statusCode:response.status,htmlBytes:html.length,identityConfirmed:x.pageIdentity,providerSpendEur:0,paidCallsTriggered:0}}:null};
  }catch(error){return {valid:false,diagnostic:{externalId:asin,statusCode:null,htmlBytes:0,blocked:false,pageIdentity:false,error:String(error?.message||error)},observation:null};}
}

const seeds=Array.isArray(bridge.observations)?bridge.observations:[];
const diagnostics=[];const current=[];
for(let i=0;i<seeds.length;i+=concurrency){
  const group=await Promise.all(seeds.slice(i,i+concurrency).map(fetchOne));
  for(const result of group){diagnostics.push(result.diagnostic);if(result.valid)current.push(result.observation);}
}
const comparison=buildMetricComparison(bridge,current,{now:new Date().toISOString(),minIntervalMs});
const output={...comparison,refresh:{requested:seeds.length,validCurrent:current.length,successRatePct:seeds.length?Math.round(current.length/seeds.length*1000)/10:0,blockedCount:diagnostics.filter(x=>x.blocked).length,httpFailureCount:diagnostics.filter(x=>Number(x.statusCode)>=400).length,diagnostics},policy:{...comparison.policy,externalRequestsTriggered:seeds.length}};
await fs.writeFile(out,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:output.schemaVersion,requested:output.refresh.requested,validCurrent:output.refresh.validCurrent,successRatePct:output.refresh.successRatePct,comparableCount:output.manifest.comparableCount,priceDeltaKnownCount:output.manifest.priceDeltaKnownCount,ratingDeltaKnownCount:output.manifest.ratingDeltaKnownCount,reviewDeltaKnownCount:output.manifest.reviewDeltaKnownCount,blockedCount:output.refresh.blockedCount,httpFailureCount:output.refresh.httpFailureCount,policy:output.policy},null,2));
if(output.policy.providerSpendEur!==0||output.policy.paidCallsTriggered!==0||output.policy.purchaseAuthorized!==false||output.policy.demandTrendAuthorized!==false||output.policy.reviewGrowthIsSales!==false)throw new Error('AMAZON_METRIC_POLICY_INVARIANT_VIOLATION');
