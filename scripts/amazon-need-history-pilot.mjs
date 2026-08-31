import fs from 'node:fs/promises';
import path from 'node:path';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const input=String(args.input||'artifacts/amazon-need-history-targets.json');
const out=String(args.out||'artifacts/amazon-need-history-pilot.json');
const observedAt=new Date().toISOString();
const body=JSON.parse(await fs.readFile(input,'utf8'));
const targets=Array.isArray(body.targets)?body.targets:[];
if(targets.length<1||targets.length>25)throw new Error('TARGET_COUNT_INVALID');
if(new Set(targets.map(x=>x.external_id)).size!==targets.length)throw new Error('TARGET_DUPLICATES');
if(targets.some(x=>!/^([A-Z0-9]{10})$/.test(String(x.external_id||''))||Number(x.existing_observation_count)>1))throw new Error('TARGET_SCOPE_INVALID');

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
async function fetchOne(t){
  const asin=String(t.external_id).toUpperCase();
  const sourceUrl=`https://www.amazon.com/dp/${asin}`;
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const r=await fetch(sourceUrl,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await r.text(); const x=extract(html,asin);
    const valid=r.ok&&!x.blocked&&x.pageIdentity&&Boolean(x.title||x.rating!==null||x.reviewCount!==null||x.price!==null);
    return{asin,sourceUrl,statusCode:r.status,htmlBytes:html.length,valid,...x,error:null};
  }catch(e){return{asin,sourceUrl,statusCode:null,htmlBytes:0,valid:false,title:null,rating:null,reviewCount:null,price:null,blocked:false,pageIdentity:false,error:String(e?.message||e)};}
}

const diagnostics=[]; const observations=[];
for(let i=0;i<targets.length;i+=5){
  const results=await Promise.all(targets.slice(i,i+5).map(fetchOne));
  for(const x of results){
    diagnostics.push(x); if(!x.valid)continue;
    observations.push({externalId:x.asin,title:x.title,price:x.price,currency:x.price!==null?'USD':null,rating:x.rating,reviewCount:x.reviewCount,observedAt,sourceUrl:x.sourceUrl,sourceKey:'AMAZON_NEED_HISTORY_PUBLIC_PAGE_V1',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false});
  }
}
const payload={schemaVersion:'MPR_AMAZON_NEED_HISTORY_PILOT_V1',generatedAt:observedAt,requested:targets.length,validObservations:observations.length,successRatePct:targets.length?Math.round(observations.length/targets.length*1000)/10:0,observations,diagnostics,policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,verifiedSales:false}};
await fs.mkdir(path.dirname(out),{recursive:true}); await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({requested:payload.requested,validObservations:payload.validObservations,successRatePct:payload.successRatePct,blocked:diagnostics.filter(x=>x.blocked).length,httpFailures:diagnostics.filter(x=>x.statusCode&&x.statusCode>=400).length},null,2));
if(payload.validObservations<Math.ceil(targets.length*0.6)){console.error('NEED_HISTORY_PILOT_COVERAGE_TOO_LOW');process.exitCode=2;}
