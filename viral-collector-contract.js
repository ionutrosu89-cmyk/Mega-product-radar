import {createHash} from 'node:crypto';
import {canonicalConceptKey,viralGrowthSignal} from './viral-growth-engine.js';

const ALLOWED_PLATFORMS=new Set(['TIKTOK','META','GOOGLE_TRENDS','GOOGLE_SHOPPING','AMAZON','YOUTUBE','PINTEREST','REDDIT']);
const ALLOWED_MARKETS=new Set(['US','GB','DE','FR','IT','ES','PL','RO']);
const ALLOWED_EVIDENCE=new Set(['DIRECT','DERIVED','MANUAL','UNVERIFIED']);

export function normalizeViralObservation(raw,policy={}){
  const platform=String(raw.platform||'').toUpperCase();
  const countryCode=String(raw.countryCode||'').toUpperCase();
  if(!ALLOWED_PLATFORMS.has(platform))throw new Error('UNSUPPORTED_VIRAL_PLATFORM');
  if(!ALLOWED_MARKETS.has(countryCode))throw new Error('UNSUPPORTED_VIRAL_MARKET');
  if(!raw.sourceUrl||!/^https:\/\//.test(raw.sourceUrl))throw new Error('DIRECT_SOURCE_URL_REQUIRED');
  if(!raw.observedAt||!Number.isFinite(Date.parse(raw.observedAt)))throw new Error('VALID_OBSERVED_AT_REQUIRED');
  if(!raw.externalId)throw new Error('EXTERNAL_ID_REQUIRED');
  if(!raw.conceptName)throw new Error('GENERIC_CONCEPT_REQUIRED');
  const evidenceClass=String(raw.evidenceClass||'UNVERIFIED').toUpperCase();
  if(!ALLOWED_EVIDENCE.has(evidenceClass))throw new Error('INVALID_EVIDENCE_CLASS');
  const termsApproved=policy.termsApproved===true;
  const enabled=policy.enabled===true;
  return {
    canonicalKey:canonicalConceptKey({category:raw.category,conceptName:raw.conceptName}),
    conceptName:String(raw.conceptName).trim(),category:String(raw.category||'').trim()||null,
    detectedBrand:String(raw.detectedBrand||'').trim()||null,
    brandPolicyClass:String(raw.brandPolicyClass||'UNKNOWN_REVIEW'),
    platform,countryCode,externalId:String(raw.externalId),sourceUrl:String(raw.sourceUrl),
    title:String(raw.title||'').trim()||null,observedAt:new Date(raw.observedAt).toISOString(),
    evidenceClass,metrics:cleanMetrics(raw.metrics),
    ingestEligible:termsApproved&&enabled&&evidenceClass!=='UNVERIFIED',
    holdReason:!termsApproved?'TERMS_REVIEW_REQUIRED':!enabled?'SOURCE_DISABLED':evidenceClass==='UNVERIFIED'?'EVIDENCE_UNVERIFIED':null,
    purchaseAuthorized:false,providerDataSpendEur:0
  };
}

function cleanMetrics(value={}){
  const out={};
  for(const key of ['viewCount','engagementCount','activeAdCount','searchInterest','marketplaceRank','reviewCount']){
    if(value[key]===null||value[key]===undefined)continue;
    const n=Number(value[key]); if(Number.isFinite(n)&&n>=0)out[key]=n;
  }
  return out;
}

export function buildViralPilotReport(rows,{sourcePolicies={}}={}){
  const normalized=rows.map(row=>normalizeViralObservation(row,sourcePolicies[String(row.platform||'').toUpperCase()]||{}));
  const groups=new Map();
  for(const row of normalized){const list=groups.get(row.canonicalKey)||[];list.push(row);groups.set(row.canonicalKey,list);}
  const candidates=[...groups.entries()].map(([canonicalKey,list])=>{
    const eligible=list.filter(x=>x.ingestEligible);
    const platforms=[...new Set(eligible.map(x=>x.platform))];
    const countries=[...new Set(eligible.map(x=>x.countryCode))];
    const input=deriveScoreInput(eligible,platforms,countries,list[0]?.brandPolicyClass);
    return {canonicalKey,conceptName:list[0]?.conceptName,observations:list.length,eligibleObservations:eligible.length,platforms,countries,signal:viralGrowthSignal(input),holds:list.filter(x=>x.holdReason).map(x=>x.holdReason)};
  }).sort((a,b)=>(b.signal.score||-1)-(a.signal.score||-1));
  return {schema:'MPR_VIRAL_PILOT_REPORT_V1',generatedAt:new Date().toISOString(),inputObservations:rows.length,eligibleObservations:normalized.filter(x=>x.ingestEligible).length,candidates,policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,claimsSales:false,romaniaMissingAsScarcity:false},contentSha256:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')};
}

function deriveScoreInput(rows,platforms,countries,brandPolicyClass){
  const by=p=>rows.filter(x=>x.platform===p);
  return {observationCount:rows.length,platforms,countries,brandPolicyClass,
    tiktokVelocityScore:velocityScore(by('TIKTOK'),'viewCount'),
    metaAdMomentumScore:velocityScore(by('META'),'activeAdCount'),
    googleAccelerationScore:velocityScore(by('GOOGLE_TRENDS'),'searchInterest'),
    amazonDemandScore:rankScore(by('AMAZON')),
    romaniaEvidenceClass:'UNVERIFIED',romaniaScarcityScore:0};
}

function velocityScore(rows,key){
  const sorted=[...rows].filter(x=>Number.isFinite(x.metrics[key])).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  if(sorted.length<2)return 0;const first=sorted[0].metrics[key],last=sorted.at(-1).metrics[key];
  if(first<=0)return last>0?60:0;return Math.max(0,Math.min(100,Math.round((last-first)/first*100)));
}
function rankScore(rows){
  const ranked=rows.filter(x=>Number.isFinite(x.metrics.marketplaceRank));
  if(!ranked.length)return 0;const best=Math.min(...ranked.map(x=>x.metrics.marketplaceRank));return Math.max(0,Math.min(100,Math.round(100-best/1000)));
}
