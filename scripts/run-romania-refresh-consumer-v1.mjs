import fs from 'node:fs/promises';
import path from 'node:path';
import { buildEmagSearchUrl, parseEmagSearchHtml } from '../emag-public-search-probe.js';

const endpoint=String(process.env.MPR_ROMANIA_REFRESH_URL||'').trim();
const token=String(process.env.OIDC_TOKEN||'').trim();
const limit=Math.max(1,Math.min(25,Number(process.env.MPR_ROMANIA_REFRESH_LIMIT||6)));
const out=String(process.env.MPR_ROMANIA_REFRESH_RECEIPT||'artifacts/romania-refresh-consumer-v1.json');
if(!endpoint) throw new Error('MPR_ROMANIA_REFRESH_URL_REQUIRED');
if(!token) throw new Error('OIDC_TOKEN_REQUIRED');

async function edge(body){
  const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text();
  let parsed; try{parsed=JSON.parse(text)}catch{parsed={raw:text.slice(0,500)}}
  if(!response.ok) throw new Error(`EDGE_${response.status}:${JSON.stringify(parsed).slice(0,700)}`);
  return parsed;
}

async function collectEmag(job){
  const observedAt=new Date().toISOString();
  const query=String(job.title||'').trim();
  if(!query) return {outcome:'DEFERRED',error:'EMPTY_CANONICAL_TITLE',retryAfterSeconds:86400};
  const sourceUrl=buildEmagSearchUrl(query);
  try{
    const response=await fetch(sourceUrl,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'ro-RO,ro;q=0.9,en;q=0.7'},redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await response.text();
    const parsed=parseEmagSearchHtml(html,{nicheKey:`canonical:${job.canonical_key}`,comparabilityKey:null,query});
    const usable=response.ok&&!parsed.blocked&&parsed.productLinkLowerBound>0;
    if(!usable){
      return {outcome:'DEFERRED',error:`EMAG_PUBLIC_PROBE_UNUSABLE status=${response.status} blocked=${parsed.blocked} lowerBound=${parsed.productLinkLowerBound}`,retryAfterSeconds:21600};
    }
    return {
      outcome:'COMPLETED',
      evidence:{
        surface:'EMAG_RO',observedAt,sourceUrl,searchQuery:query,
        evidenceClass:'LIVE_PUBLIC_MARKET_SEARCH_PAGE',freshnessClass:'LIVE_PUBLIC_SEARCH_PAGE',
        productLinkLowerBound:parsed.productLinkLowerBound,
        declaredResultCountCandidate:parsed.declaredResultCountCandidate,
        declaredResultCountTrusted:false,sellerCount:null,
        comparableScopeConfirmed:false,marketWideCompetitionReady:false,comparabilityConfidence:null,
        salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false,
        collectorVersion:'romania-refresh-consumer-v1',statusCode:response.status,blocked:parsed.blocked,
        productUrls:parsed.productUrls.slice(0,30),policy:parsed.policy
      }
    };
  }catch(error){
    return {outcome:'DEFERRED',error:`EMAG_PUBLIC_PROBE_ERROR:${String(error?.message||error).slice(0,320)}`,retryAfterSeconds:21600};
  }
}

async function collect(job){
  if(job.target_surface==='EMAG_RO') return collectEmag(job);
  if(job.target_surface==='TRENDYOL_RO') return {outcome:'DEFERRED',error:'TRENDYOL_RO_ADAPTER_NOT_YET_APPROVED',retryAfterSeconds:86400};
  if(job.target_surface==='RO_RETAIL_WEB') return {outcome:'DEFERRED',error:'RO_RETAIL_WEB_ADAPTER_NOT_YET_APPROVED',retryAfterSeconds:86400};
  return {outcome:'FAILED',error:'SURFACE_NOT_SUPPORTED',retryAfterSeconds:86400};
}

const claimed=await edge({action:'claim',limit});
if(claimed?.policy?.providerSpendEur!==0||claimed?.policy?.paidCallsTriggered!==0||claimed?.policy?.purchaseAuthorized!==false) throw new Error('CLAIM_POLICY_INVARIANT_FAILED');
const jobs=Array.isArray(claimed.jobs)?claimed.jobs:[];
const receipts=[];
for(const job of jobs){
  const result=await collect(job);
  const finish=await edge({action:'finish',jobId:job.id,outcome:result.outcome,evidence:result.evidence||{},error:result.error||null,retryAfterSeconds:result.retryAfterSeconds||21600});
  const receipt=finish?.receipt||{};
  if(receipt.paidCallsTriggered!==0||receipt.providerSpendEur!==0||receipt.purchaseAuthorized!==false||receipt.salesEvidenceClass!=='NOT_VERIFIED_SALES') throw new Error(`FINISH_POLICY_INVARIANT_FAILED:${job.id}`);
  receipts.push({jobId:job.id,surface:job.target_surface,title:job.title,outcome:result.outcome,receipt,error:result.error||null});
  await new Promise(resolve=>setTimeout(resolve,job.target_surface==='EMAG_RO'?900:100));
}

const payload={
  schemaVersion:'MPR_ROMANIA_REFRESH_CONSUMER_RECEIPT_V1',
  generatedAt:new Date().toISOString(),
  claimed:jobs.length,
  completed:receipts.filter(x=>x.outcome==='COMPLETED').length,
  deferred:receipts.filter(x=>x.outcome==='DEFERRED').length,
  failed:receipts.filter(x=>x.outcome==='FAILED').length,
  bySurface:Object.fromEntries(['EMAG_RO','TRENDYOL_RO','RO_RETAIL_WEB'].map(s=>[s,receipts.filter(x=>x.surface===s).length])),
  receipts,
  policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({claimed:payload.claimed,completed:payload.completed,deferred:payload.deferred,failed:payload.failed,bySurface:payload.bySurface,policy:payload.policy},null,2));
