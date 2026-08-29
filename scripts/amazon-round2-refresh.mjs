import fs from 'node:fs/promises';
import path from 'node:path';
import { buildAmazonRound2Plan, deriveAmazonRound2Movement, summarizeAmazonRound2Movements } from '../amazon-round2-orchestrator-v1.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[^0-9.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const out=String(args.out||'artifacts/amazon-round2-refresh.json');
const maxItems=Math.max(1,Math.min(255,Number(args.maxItems)||255));
const targetAsinsFile=args.targetAsinsFile?String(args.targetAsinsFile):null;
const now=new Date().toISOString();
const snapshotFiles=[
  'data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',
  'data/live-snapshots/amazon-round1-remaining.compact.json',
  'data/live-snapshots/amazon-round1-missing-retry.compact.json'
];
const payloads=await Promise.all(snapshotFiles.map(async p=>JSON.parse(await fs.readFile(p,'utf8'))));
const plan=buildAmazonRound2Plan(payloads,now,24);
let targetAsins=null;
if(targetAsinsFile){
  const targetPayload=JSON.parse(await fs.readFile(targetAsinsFile,'utf8'));
  const raw=Array.isArray(targetPayload)?targetPayload:(targetPayload.leaders||targetPayload.asins||[]);
  targetAsins=new Set(raw.map(x=>clean(typeof x==='string'?x:x?.asin)).filter(Boolean));
  if(targetAsins.size===0) throw new Error('TARGET_ASINS_EMPTY');
}
const eligibleTargets=targetAsins?plan.eligible.filter(x=>targetAsins.has(x.asin)):plan.eligible;
const targets=eligibleTargets.slice(0,maxItems);

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
  return{title:title||null,rating,reviewCount,price,blocked,pageIdentity};
}

async function fetchOne(target){
  const url=`https://www.amazon.com/dp/${target.asin}`;
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const response=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await response.text();
    const x=extract(html,target.asin);
    const valid=response.ok&&!x.blocked&&x.pageIdentity&&Boolean(x.title||x.rating!==null||x.reviewCount!==null||x.price!==null);
    return {target,url,statusCode:response.status,htmlBytes:html.length,valid,...x,error:null};
  }catch(error){
    return {target,url,statusCode:null,htmlBytes:0,valid:false,title:null,rating:null,reviewCount:null,price:null,blocked:false,pageIdentity:false,error:String(error?.message||error)};
  }
}

const diagnostics=[];const observations=[];const movements=[];
for(let i=0;i<targets.length;i+=5){
  const results=await Promise.all(targets.slice(i,i+5).map(fetchOne));
  for(const r of results){
    diagnostics.push({asin:r.target.asin,statusCode:r.statusCode,htmlBytes:r.htmlBytes,valid:r.valid,blocked:r.blocked,pageIdentity:r.pageIdentity,error:r.error});
    if(!r.valid)continue;
    const observation={sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',platform:'AMAZON',externalId:r.target.asin,url:r.url,title:r.title,price:r.price,currency:r.price!==null?'USD':null,rating:r.rating,reviewCount:r.reviewCount,sourceRank:null,observedAt:now,freshnessClass:'LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,provenance:{statusCode:r.statusCode,htmlBytes:r.htmlBytes,identityConfirmed:r.pageIdentity,providerSpendEur:0,round:2,minIntervalHours:24}};
    observations.push(observation);
    movements.push(deriveAmazonRound2Movement(r.target,observation));
  }
}

const result={
  schemaVersion:'MPR_AMAZON_ROUND2_REFRESH_V1',
  generatedAt:now,
  plan:{capturedCount:plan.capturedCount,eligibleCount:plan.eligibleCount,blockedCount:plan.blockedCount,nextEligibleAt:plan.nextEligibleAt,allEligibleAt:plan.allEligibleAt,minIntervalHours:plan.minIntervalHours},
  targeting:{mode:targetAsins?'EXPLICIT_ASIN_SET':'ALL_ELIGIBLE',targetAsinsFile,targetAsinCount:targetAsins?.size??null,eligibleTargetCount:eligibleTargets.length},
  requested:targets.length,
  validObservations:observations.length,
  successRatePct:targets.length?Math.round(observations.length/targets.length*1000)/10:0,
  observations,
  movements,
  movementSummary:summarizeAmazonRound2Movements(movements),
  diagnostics,
  policy:{providerSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:targets.length>0,salesEvidenceClass:'NOT_VERIFIED_SALES',rankVelocityAvailable:false,purchaseAuthorized:false,minimumObservationIntervalHours:24}
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(result,null,2));
console.log(JSON.stringify({plan:result.plan,targeting:result.targeting,requested:result.requested,validObservations:result.validObservations,successRatePct:result.successRatePct,movementSummary:result.movementSummary},null,2));
if(targets.length===0){console.error(`ROUND2_NOT_ELIGIBLE next=${plan.nextEligibleAt||plan.allEligibleAt}`);process.exitCode=3;}
