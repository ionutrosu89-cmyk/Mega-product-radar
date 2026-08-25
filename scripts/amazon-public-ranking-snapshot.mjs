import fs from 'node:fs/promises';
import path from 'node:path';
import {parseAmazonPublicRankingHtml} from '../amazon-public-ranking-snapshot-v1.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const out=String(args.out||'artifacts/amazon-public-ranking-snapshot.json');
const categoryKey=clean(args.categoryKey||'amazon:office-products:best-sellers');
const categoryLabel=clean(args.categoryLabel||'Office Products');
const sourceUrl=clean(args.url||'https://www.amazon.com/gp/bestsellers/office-products?language=en_US');
const observedAt=new Date().toISOString();

function blockedPayload({statusCode=null,error=null,htmlBytes=0,diagnostics=[]}={}){
  return {
    schemaVersion:'MPR_AMAZON_PUBLIC_RANKING_SNAPSHOT_V1',generatedAt:observedAt,sourceUrl,categoryKey,categoryLabel,
    status:'NO_USABLE_RANKING_EVIDENCE',statusCode,htmlBytes,error,
    observations:[],rankEvidenceCount:0,diagnostics,
    policy:{sourceKey:'AMAZON_PUBLIC_RANKINGS',scope:'PUBLIC_RANKING_SURFACE',explicitRankOnly:true,htmlPositionIsNotRank:true,salesEvidenceClass:'NOT_VERIFIED_SALES',providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,automaticExecutionAllowed:false}
  };
}

let payload;
try{
  const r=await fetch(sourceUrl,{
    headers:{
      'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'accept':'text/html,application/xhtml+xml',
      'accept-language':'en-US,en;q=0.9'
    },
    redirect:'follow',signal:AbortSignal.timeout(15000)
  });
  const html=await r.text();
  const parsed=parseAmazonPublicRankingHtml({html,sourceUrl,observedAt,categoryKey,categoryLabel});
  payload={
    schemaVersion:'MPR_AMAZON_PUBLIC_RANKING_SNAPSHOT_V1',generatedAt:observedAt,sourceUrl,categoryKey,categoryLabel,
    status:r.ok&&parsed.ok?'RANKING_EVIDENCE_CAPTURED':'NO_USABLE_RANKING_EVIDENCE',statusCode:r.status,htmlBytes:html.length,error:null,
    observations:parsed.observations,rankEvidenceCount:parsed.rankEvidenceCount,diagnostics:parsed.diagnostics,rejected:parsed.rejected||[],
    policy:{sourceKey:'AMAZON_PUBLIC_RANKINGS',scope:'PUBLIC_RANKING_SURFACE',explicitRankOnly:true,htmlPositionIsNotRank:true,salesEvidenceClass:'NOT_VERIFIED_SALES',providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,automaticExecutionAllowed:false}
  };
}catch(e){
  payload=blockedPayload({error:String(e?.message||e),diagnostics:['AMAZON_PUBLIC_RANKING_FETCH_FAILED']});
}

await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({status:payload.status,statusCode:payload.statusCode,rankEvidenceCount:payload.rankEvidenceCount,diagnostics:payload.diagnostics,providerSpendEur:payload.policy.providerSpendEur,paidCallsTriggered:payload.policy.paidCallsTriggered,purchaseAuthorized:payload.policy.purchaseAuthorized},null,2));

if(payload.policy.providerSpendEur!==0||payload.policy.paidCallsTriggered!==0||payload.policy.purchaseAuthorized!==false)process.exitCode=3;
else if(payload.status!=='RANKING_EVIDENCE_CAPTURED'||payload.rankEvidenceCount<5)process.exitCode=2;
