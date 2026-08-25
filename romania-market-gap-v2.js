import {calculateRomaniaMarketGap} from './romania-market-gap-v1.js';

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const t=v=>String(v??'').trim().toUpperCase();

const GLOBAL_MARKET_PLATFORMS=new Set(['AMAZON','EBAY']);
const LOCAL_PUBLIC_PLATFORMS=new Set(['EMAG','TRENDYOL']);
const HYBRID_CONFIRMATION_PLATFORMS=new Set(['ALIEXPRESS','SHEIN']);

function validObservedAt(value){
  const ms=Date.parse(String(value??''));
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}

export function normalizeMarketEvidence(row={}){
  const platform=t(row.platform);
  const scope=t(row.scope||row.evidenceScope);
  const evidenceType=t(row.evidenceType||row.type);
  const observedAt=validObservedAt(row.observedAt);
  const manualReviewed=row.manualReviewed===true;
  const sellerScoped=row.sellerScoped===true||scope.includes('SELLER');
  const storeScoped=row.storeScoped===true||scope.includes('STORE');
  const marketWide=row.marketWide===true||scope==='MARKET_WIDE';
  const publicObserved=evidenceType==='PUBLIC_MARKET_SIGNAL'||evidenceType==='PUBLIC_RANKING'||evidenceType==='PUBLIC_CATALOGUE';
  const rankingObserved=evidenceType==='PUBLIC_RANKING'&&n(row.rank)!==null&&n(row.rank)>0;
  const listingCount=n(row.listingCount);
  const sellerCount=n(row.sellerCount);
  const saturationScore=n(row.saturationScore);
  const trendScore=n(row.trendScore??row.score);
  const confidence=n(row.confidence);

  const marketEvidenceEligible=Boolean(platform&&observedAt&&marketWide&&!sellerScoped&&!storeScoped&&publicObserved&&manualReviewed);
  const globalDemandEligible=marketEvidenceEligible&&GLOBAL_MARKET_PLATFORMS.has(platform)&&rankingObserved;
  const localMarketEligible=marketEvidenceEligible&&LOCAL_PUBLIC_PLATFORMS.has(platform);
  const hybridConfirmationEligible=marketEvidenceEligible&&HYBRID_CONFIRMATION_PLATFORMS.has(platform);

  return {
    platform,observedAt,scope,evidenceType,manualReviewed,sellerScoped,storeScoped,marketWide,
    rank:n(row.rank),listingCount,sellerCount,saturationScore,trendScore,confidence,
    marketEvidenceEligible,globalDemandEligible,localMarketEligible,hybridConfirmationEligible,
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
}

function latestPerPlatform(rows=[]){
  const map=new Map();
  for(const raw of rows||[]){
    const row=normalizeMarketEvidence(raw);
    if(!row.platform)continue;
    const prev=map.get(row.platform);
    if(!prev||String(row.observedAt||'')>String(prev.observedAt||''))map.set(row.platform,row);
  }
  return [...map.values()];
}

function deriveGlobalTrend(rows=[]){
  const evidence=latestPerPlatform(rows).filter(x=>x.globalDemandEligible);
  if(!evidence.length)return {score:null,confidence:null,platforms:[],blockers:['GLOBAL_MARKET_EVIDENCE_MISSING']};
  const parts=evidence.map(x=>{
    const rankSignal=x.rank===null?null:clamp(100-(Math.min(x.rank,100)-1));
    const explicit=n(x.trendScore);
    return explicit===null?rankSignal:clamp(explicit);
  }).filter(x=>x!==null);
  if(!parts.length)return {score:null,confidence:null,platforms:evidence.map(x=>x.platform),blockers:['GLOBAL_TREND_VALUE_MISSING']};
  const score=Number((parts.reduce((a,b)=>a+b,0)/parts.length).toFixed(1));
  const platformCount=evidence.length;
  const suppliedConfidence=evidence.map(x=>n(x.confidence)).filter(x=>x!==null);
  const base=suppliedConfidence.length?suppliedConfidence.reduce((a,b)=>a+b,0)/suppliedConfidence.length:50;
  const confidence=Number(clamp(base+(platformCount>=2?15:0),0,95).toFixed(1));
  return {score,confidence,platforms:evidence.map(x=>x.platform),blockers:[]};
}

function deriveRomaniaCompetition(rows=[]){
  const evidence=latestPerPlatform(rows).filter(x=>x.localMarketEligible);
  if(!evidence.length)return {sellerCount:null,listingCount:null,saturationScore:null,competitionVerified:false,platforms:[],blockers:['ROMANIA_PUBLIC_MARKET_EVIDENCE_MISSING']};
  const sumKnown=key=>{const vals=evidence.map(x=>n(x[key])).filter(x=>x!==null);return vals.length?vals.reduce((a,b)=>a+b,0):null;};
  const avgKnown=key=>{const vals=evidence.map(x=>n(x[key])).filter(x=>x!==null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
  return {
    sellerCount:sumKnown('sellerCount'),listingCount:sumKnown('listingCount'),
    saturationScore:avgKnown('saturationScore'),competitionVerified:evidence.length>=2,
    platforms:evidence.map(x=>x.platform),blockers:[]
  };
}

export function calculateRomaniaMarketGapV2({marketEvidence=[],romaniaDemand={}}={}){
  const normalized=latestPerPlatform(marketEvidence);
  const globalTrend=deriveGlobalTrend(normalized);
  const romaniaCompetition=deriveRomaniaCompetition(normalized);
  const base=calculateRomaniaMarketGap({globalTrend,romaniaDemand,romaniaCompetition});
  const rejectedScoped=normalized.filter(x=>x.sellerScoped||x.storeScoped).map(x=>x.platform);
  const hybridConfirmations=normalized.filter(x=>x.hybridConfirmationEligible).map(x=>x.platform);
  const localPlatforms=romaniaCompetition.platforms||[];
  const globalPlatforms=globalTrend.platforms||[];
  const independentPlatformCount=new Set([...localPlatforms,...globalPlatforms,...hybridConfirmations]).size;

  return {
    version:'2.0',...base,
    provenance:{
      globalDemandPlatforms:globalPlatforms,
      romaniaPublicPlatforms:localPlatforms,
      hybridConfirmationPlatforms:hybridConfirmations,
      rejectedScopedPlatforms:rejectedScoped,
      independentPlatformCount
    },
    confidenceClass:base.status!=='READY'?'INSUFFICIENT':globalPlatforms.length>=2&&localPlatforms.length>=2?'MULTI_MARKET_STRONG':globalPlatforms.length>=1&&localPlatforms.length>=1?'MULTI_MARKET_PARTIAL':'INSUFFICIENT',
    policy:'ONLY_MANUALLY_REVIEWED_MARKET_WIDE_PUBLIC_EVIDENCE_CAN_FEED_ROMANIA_GAP; SELLER_OR_STORE_SCOPED_DATA_IS_EXCLUDED; NO_VERIFIED_SALES_CLAIM',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,paidCallsTriggered:0
  };
}

export function buildRomaniaGapMultiMarketRadar(rows=[]){
  const out=(rows||[]).map(row=>({productKey:row.productKey||row.identity||null,title:row.title||row.name||null,...calculateRomaniaMarketGapV2(row)}));
  const ready=out.filter(x=>x.status==='READY').sort((a,b)=>b.score-a.score);
  const incomplete=out.filter(x=>x.status!=='READY');
  return {version:'2.0',total:out.length,ready:ready.length,incomplete:incomplete.length,strongMultiMarket:ready.filter(x=>x.confidenceClass==='MULTI_MARKET_STRONG').length,rows:[...ready,...incomplete],policy:'RADAR_ONLY_NO_PURCHASE_AUTHORIZATION',paidCallsTriggered:0,purchaseAuthorized:false};
}
