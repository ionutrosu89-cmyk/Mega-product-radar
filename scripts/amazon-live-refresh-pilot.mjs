import fs from 'node:fs/promises';
import path from 'node:path';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
const observedAt=new Date().toISOString();
const USER_APPROVAL='USER_APPROVED_LIVE_REFRESH_PILOT_2026_08_25';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const limit=Math.max(5,Math.min(50,Number(args.limit)||20));
const out=String(args.out||'artifacts/amazon-live-refresh-pilot.json');

const compact=JSON.parse(await fs.readFile('data/real-products-1000.compact.json','utf8'));
const fields=compact.fields;const index=Object.fromEntries(fields.map((x,i)=>[x,i]));
const seeds=compact.products.slice(0,limit).map(r=>({asin:clean(r[index.asin]).toUpperCase(),title:clean(r[index.title])}));

function extract(html,asin){
  const title=clean(html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,' '));
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
  return{title:title||null,rating,reviewCount,price,blocked,pageIdentity};
}

async function fetchOne(seed){
  const url=`https://www.amazon.com/dp/${seed.asin}`;
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await r.text();
    const x=extract(html,seed.asin);
    const valid=r.ok&&!x.blocked&&x.pageIdentity&&Boolean(x.title||x.rating!==null||x.reviewCount!==null||x.price!==null);
    return{asin:seed.asin,url,statusCode:r.status,htmlBytes:html.length,valid,...x,error:null};
  }catch(e){return{asin:seed.asin,url,statusCode:null,htmlBytes:0,valid:false,title:null,rating:null,reviewCount:null,price:null,blocked:false,pageIdentity:false,error:String(e?.message||e)};}
}

const diagnostics=[];const observations=[];
for(let i=0;i<seeds.length;i+=4){
  const chunk=seeds.slice(i,i+4);
  const results=await Promise.all(chunk.map(fetchOne));
  for(const x of results){
    diagnostics.push(x);
    if(!x.valid)continue;
    observations.push({sourceKey:'AMAZON_LIVE_PUBLIC_PAGE_PILOT',platform:'AMAZON',externalId:x.asin,url:x.url,title:x.title,price:x.price,currency:x.price!==null?'USD':null,rating:x.rating,reviewCount:x.reviewCount,sourceRank:null,observedAt,freshnessClass:'LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,provenance:{userApproval:USER_APPROVAL,statusCode:x.statusCode,htmlBytes:x.htmlBytes,identityConfirmed:x.pageIdentity,providerSpendEur:0}});
  }
}

const payload={schemaVersion:'AMAZON_LIVE_REFRESH_PILOT_V1',generatedAt:observedAt,requested:seeds.length,validObservations:observations.length,successRatePct:Math.round(observations.length/seeds.length*1000)/10,observations,diagnostics,policy:{providerSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:true,executionReason:'EXPLICIT_USER_APPROVAL_TO_CONTINUE_PROJECT',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false}};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({requested:payload.requested,validObservations:payload.validObservations,successRatePct:payload.successRatePct,blocked:diagnostics.filter(x=>x.blocked).length,httpFailures:diagnostics.filter(x=>x.statusCode&&x.statusCode>=400).length},null,2));
if(payload.validObservations<5){console.error(`LIVE_PILOT_TOO_LOW ${payload.validObservations}/${payload.requested}`);process.exitCode=2;}
