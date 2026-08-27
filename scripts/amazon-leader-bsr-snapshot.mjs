import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {extractAmazonBestSellerRanks} from '../amazon-product-bsr-evidence-v1.js';
import {buildAmazonSnapshotTrust} from '../amazon-snapshot-trust-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const targetPath=String(args.targets||'data/amazon-round2-review-growth-leaders-bsr-targets-v1.json');
const out=String(args.out||'artifacts/amazon-leader-bsr-snapshot.json');
const now=new Date().toISOString();
const runId=String(process.env.GITHUB_RUN_ID||`local-${Date.now()}`);
const payload=JSON.parse(await fs.readFile(targetPath,'utf8'));
const targets=Array.isArray(payload.targets)?payload.targets:[];
if(payload.schemaVersion!=='MPR_AMAZON_ROUND2_BSR_TARGETS_V1'||targets.length!==13)throw new Error('BSR_TARGET_SET_INVALID');
if(payload.policy?.providerSpendEur!==0||payload.policy?.paidCallsAuthorized!==false||payload.policy?.purchaseAuthorized!==false)throw new Error('BSR_TARGET_POLICY_INVALID');

const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
async function fetchOne(t){
  const asin=String(t.asin).trim().toUpperCase();const url=`https://www.amazon.com/dp/${asin}`;
  try{
    const response=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await response.text();
    const contentSha256=crypto.createHash('sha256').update(html).digest('hex');
    const parsed=extractAmazonBestSellerRanks(html,{asin});
    return{asin,title:t.title||null,reviewDelta:t.reviewDelta??null,url,statusCode:response.status,htmlBytes:html.length,contentSha256,observedAt:now,ok:response.ok&&parsed.ok,...parsed,error:null};
  }catch(error){return{asin,title:t.title||null,reviewDelta:t.reviewDelta??null,url,statusCode:null,htmlBytes:0,contentSha256:null,observedAt:now,ok:false,status:'FETCH_ERROR',identityConfirmed:false,entries:[],rankEvidenceCount:0,error:String(error?.message||error)};}
}

const rows=[];
for(let i=0;i<targets.length;i+=4)rows.push(...await Promise.all(targets.slice(i,i+4).map(fetchOne)));
const evaluatedRows=rows.map(r=>({
  ...r,
  trust:buildAmazonSnapshotTrust(r,{
    runId,
    intendedUse:'analysis',
    sourceRights:{analysisAllowed:false,commercialUseAllowed:false,basis:'NOT_CONFIRMED'}
  })
}));
const observations=evaluatedRows.filter(r=>r.ok&&r.rankEvidenceCount>0).map(r=>({
  sourceKey:'AMAZON_PRODUCT_BSR_PUBLIC_PAGE',platform:'AMAZON',externalId:r.asin,asin:r.asin,url:r.url,title:r.title,reviewDelta:r.reviewDelta,
  observedAt:r.observedAt,bsrEntries:r.entries,rankEvidenceCount:r.rankEvidenceCount,sourceRank:null,
  evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,
  evidenceEnvelope:r.trust.envelope,trustDecision:r.trust.policy.decision,trustReasons:r.trust.policy.reasons,
  provenance:{statusCode:r.statusCode,htmlBytes:r.htmlBytes,identityConfirmed:r.identityConfirmed,contentSha256:r.contentSha256,providerSpendEur:0}
}));
const result={
  schemaVersion:'MPR_AMAZON_LEADER_BSR_SNAPSHOT_V1',generatedAt:now,targetCount:targets.length,
  validPageCount:evaluatedRows.filter(r=>r.ok).length,productsWithExplicitBsr:observations.length,
  explicitBsrEntryCount:observations.reduce((n,o)=>n+o.rankEvidenceCount,0),observations,
  diagnostics:evaluatedRows.map(r=>({
    asin:r.asin,statusCode:r.statusCode,htmlBytes:r.htmlBytes,contentSha256:r.contentSha256,ok:r.ok,status:r.status,
    identityConfirmed:r.identityConfirmed,rankEvidenceCount:r.rankEvidenceCount,error:r.error,
    trustDecision:r.trust.policy.decision,trustReasons:r.trust.policy.reasons
  })),
  policy:{
    explicitBsrOnly:true,preserveAllCategoryRanks:true,choosePrimaryRank:false,htmlPositionIsNotRank:true,minimumRankTrendIntervalHours:24,
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,
    evidenceEnvelopeSchema:'EvidenceEnvelopeV2',policyKernelVersion:1,sourceRightsAnalysisConfirmed:false,sourceRightsCommercialConfirmed:false
  }
};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({targetCount:result.targetCount,validPageCount:result.validPageCount,productsWithExplicitBsr:result.productsWithExplicitBsr,explicitBsrEntryCount:result.explicitBsrEntryCount},null,2));
