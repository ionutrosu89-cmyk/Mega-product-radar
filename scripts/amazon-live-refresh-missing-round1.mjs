import fs from 'node:fs/promises';
import path from 'node:path';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const observedAt=new Date().toISOString();
const USER_APPROVAL='USER_APPROVED_MISSING_ROUND1_REFRESH_2026_08_25';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const maxProducts=Math.max(1,Math.min(846,Number(args.max)||846));
const out=String(args.out||'artifacts/amazon-live-refresh-missing-round1.json');

const bootstrap=JSON.parse(await fs.readFile('data/real-products-1000.compact.json','utf8'));
const bootIndex=Object.fromEntries(bootstrap.fields.map((x,i)=>[x,i]));
const first=JSON.parse(await fs.readFile('data/live-snapshots/amazon-2026-08-25-batch-000.compact.json','utf8'));
const partial=JSON.parse(await fs.readFile('data/live-snapshots/amazon-round1-remaining.compact.json','utf8'));
const captured=new Set([
  ...first.snapshots.map(r=>clean(r[0]).toUpperCase()),
  ...partial.products.map(r=>clean(r[0]).toUpperCase())
]);
const allSeeds=bootstrap.products.map(r=>({asin:clean(r[bootIndex.asin]).toUpperCase(),baselineTitle:clean(r[bootIndex.title])}));
const missing=allSeeds.filter(x=>!captured.has(x.asin));
const seeds=missing.slice(0,maxProducts);

if(captured.size!==154)throw new Error(`CAPTURED_BASELINE_COUNT_MISMATCH_${captured.size}`);
if(missing.length!==846)throw new Error(`MISSING_SET_COUNT_MISMATCH_${missing.length}`);

function decodeEntities(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');}
function extract(html,asin){
  const title=clean(decodeEntities(html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,' ')));
  const rating=num(html.match(/([0-5](?:\.[0-9])?)\s*out of 5 stars/i)?.[1]);
  const reviewCount=num(html.match(/([0-9][0-9,\.]*)\s+(?:ratings|global ratings|reviews)/i)?.[1]);
  const priceCandidates=[
    html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([^<]+)/i)?.[1],
    html.match(/id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)/i)?.[1],
    html.match(/id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)/i)?.[1]
  ];
  const price=num(priceCandidates.find(Boolean));
  const blocked=/robot check|enter the characters you see below|sorry! something went wrong/i.test(html);
  const pageIdentity=html.toUpperCase().includes(asin);
  const usable=Boolean(title||rating!==null||reviewCount!==null||price!==null);
  return{title:title||null,rating,reviewCount,price,blocked,pageIdentity,usable};
}

const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
async function attempt(seed,attemptNo){
  const url=`https://www.amazon.com/dp/${seed.asin}`;
  try{
    const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(12000)});
    const html=await r.text();const x=extract(html,seed.asin);
    const valid=r.ok&&!x.blocked&&x.pageIdentity&&x.usable;
    return{asin:seed.asin,url,statusCode:r.status,htmlBytes:html.length,valid,...x,error:null,attemptNo};
  }catch(e){return{asin:seed.asin,url,statusCode:null,htmlBytes:0,valid:false,title:null,rating:null,reviewCount:null,price:null,blocked:false,pageIdentity:false,usable:false,error:String(e?.message||e),attemptNo};}
}
async function fetchOne(seed){
  const firstTry=await attempt(seed,1);
  if(firstTry.valid||firstTry.blocked)return firstTry;
  await sleep(1400);
  const secondTry=await attempt(seed,2);
  return secondTry.valid?secondTry:{...secondTry,firstAttempt:{statusCode:firstTry.statusCode,htmlBytes:firstTry.htmlBytes,pageIdentity:firstTry.pageIdentity,usable:firstTry.usable,error:firstTry.error}};
}

const diagnostics=[];const observations=[];
for(let i=0;i<seeds.length;i+=2){
  const results=await Promise.all(seeds.slice(i,i+2).map(fetchOne));
  for(const x of results){
    diagnostics.push(x);
    if(!x.valid)continue;
    observations.push({
      sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',platform:'AMAZON',externalId:x.asin,url:x.url,title:x.title,
      price:x.price,currency:x.price!==null?'USD':null,rating:x.rating,reviewCount:x.reviewCount,sourceRank:null,
      observedAt,freshnessClass:'LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,
      provenance:{userApproval:USER_APPROVAL,statusCode:x.statusCode,htmlBytes:x.htmlBytes,identityConfirmed:x.pageIdentity,providerSpendEur:0,retryAttempt:x.attemptNo,collectionScope:'MISSING_ROUND1_ONLY'}
    });
  }
  if(i+2<seeds.length)await sleep(350);
}

const ids=new Set(observations.map(x=>x.externalId));
const overlap=[...ids].filter(x=>captured.has(x));
const coverage={withPrice:observations.filter(x=>x.price!==null).length,withRating:observations.filter(x=>x.rating!==null).length,withReviews:observations.filter(x=>x.reviewCount!==null).length};
const payload={
  schemaVersion:'AMAZON_LIVE_REFRESH_MISSING_ROUND1_V1',generatedAt:observedAt,
  baselineCapturedCount:captured.size,missingBeforeRun:missing.length,requested:seeds.length,validObservations:observations.length,
  successRatePct:seeds.length?Math.round(observations.length/seeds.length*1000)/10:0,coverage,
  overlapWithAlreadyCaptured:overlap.length,observations,diagnostics,
  policy:{providerSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:true,executionReason:'EXPLICIT_USER_APPROVAL_TO_CONTINUE_PROJECT',freshnessClass:'LIVE_PUBLIC_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,trendAuthorized:false,minObservationHoursBeforeTrend:24}
};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({baselineCapturedCount:payload.baselineCapturedCount,missingBeforeRun:payload.missingBeforeRun,requested:payload.requested,validObservations:payload.validObservations,successRatePct:payload.successRatePct,coverage,overlapWithAlreadyCaptured:payload.overlapWithAlreadyCaptured,blocked:diagnostics.filter(x=>x.blocked).length,httpFailures:diagnostics.filter(x=>x.statusCode&&x.statusCode>=400).length,retried:diagnostics.filter(x=>x.attemptNo===2).length},null,2));
if(ids.size!==observations.length)throw new Error('DUPLICATE_ASIN_IN_RESULT');
if(overlap.length!==0)throw new Error('CAPTURED_ASIN_REFETCHED');
