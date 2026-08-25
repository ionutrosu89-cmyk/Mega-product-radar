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
  const comparabilityKey=String(row.comparabilityKey??'').trim();
  const comparableScopeConfirmed=row.comparableScopeConfirmed===true;

  const marketEvidenceEligible=Boolean(platform&&observedAt&&marketWide&&!sellerScoped&&!storeScoped&&publicObserved&&manualReviewed);
  const globalDemandEligible=marketEvidenceEligible&&GLOBAL_MARKET_PLATFORMS.has(platform)&&rankingObserved;
  const localMarketEligible=marketEvidenceEligible&&LOCAL_PUBLIC_PLATFORMS.has(platform);
  const localComparableEligible=localMarketEligible&&Boolean(comparabilityKey)&&comparableScopeConfirmed;
  const hybridConfirmationEligible=marketEvidenceEligible&&HYBRID_CONFIRMATION_PLATFORMS.has(platform);

  return {
    platform,observedAt,scope,evidenceType,manualReviewed,sellerScoped,storeScoped,marketWide,
    rank:n(row.rank),listingCount,sellerCount,saturationScore,trendScore,confidence,
    comparabilityKey,comparableScopeConfirmed,
    marketEvidenceEligible,globalDemandEligible,localMarketEligible,localComparableEligible,hybridConfirmationEligible,
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
  const local=latestPerPlatform(rows).filter(x=>x.localMarketEligible);
  if(!local.length)return {sellerCount:null,listingCount:null,saturationScore:null,competitionVerified:false,platforms:[],comparabilityKey:null,blockers:['ROMANIA_PUBLIC_MARKET_EVIDENCE_MISSING']};

  const comparable=local.filter(x=>x.localComparableEligible);
  if(!comparable.length)return {sellerCount:null,listingCount:null,saturationScore:null,competitionVerified:false,platforms:local.map(x=>x.platform),comparabilityKey:null,blockers:['ROMANIA_COMPARABLE_SCOPE_MISSING']};

  const groups=new Map();
  for(const row of comparable){
    const arr=groups.get(row.comparabilityKey)||[];
    arr.push(row);
    groups.set(row.comparabilityKey,arr);
  }
  const ranked=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);
  const [comparabilityKey,evidence]=ranked[0]||[null,[]];
  const platforms=[...new Set(evidence.map(x=>x.platform))];
  if(platforms.length<2){
    return {sellerCount:null,listingCount:null,saturationScore:null,competitionVerified:false,platforms,comparabilityKey,blockers:['ROMANIA_COMPARABLE_PLATFORM_PAIR_MISSING']};
  }

  const sumComplete=key=>{const vals=evidence.map(x=>n(x[key]));return vals.every(x=>x!==null)?vals.reduce((a,b)=>a+b,0):null;};
  const avgComplete=key=>{const vals=evidence.map(x=>n(x[key]));return vals.every(x=>x!==null)?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
  const listingCount=sumComplete('listingCount');
  const sellerCount=sumComplete('sellerCount');
  const saturationScore=avgComplete('saturationScore');
  if(listingCount===null&&sellerCount===null&&saturationScore===null){
    return {sellerCount:null,listingCount:null,saturationScore:null,competitionVerified:false,platforms,comparabilityKey,blockers:['ROMANIA_COMPARABLE_EXACT_COMPETITION_VALUES_MISSING']};
  }
  return {sellerCount,listingCount,saturationScore,competitionVerified:true,platforms,comparabilityKey,blockers:[]};
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
  const blockers=[...new Set([...(base.blockers||[]),...(romaniaCompetition.blockers||[])])];
  const forcedIncomplete=Boolean(romaniaCompetition.blockers?.length);

  return {
    version:'2.1',...base,
    ...(forcedIncomplete?{status:'INCOMPLETE',score:null,band:'UNKNOWN',blockers}:{blockers}),
    provenance:{
      globalDemandPlatforms:globalPlatforms,
      romaniaPublicPlatforms:localPlatforms,
      hybridConfirmationPlatforms:hybridConfirmations,
      rejectedScopedPlatforms:rejectedScoped,
      independentPlatformCount,
      romaniaComparabilityKey:romaniaCompetition.comparabilityKey||null
    },
    confidenceClass:forcedIncomplete||base.status!=='READY'?'INSUFFICIENT':globalPlatforms.length>=2&&localPlatforms.length>=2?'MULTI_MARKET_STRONG':globalPlatforms.length>=1&&localPlatforms.length>=2?'MULTI_MARKET_PARTIAL':'INSUFFICIENT',
    policy:'ONLY_MANUALLY_REVIEWED_MARKET_WIDE_PUBLIC_EVIDENCE_WITH_CONFIRMED_SHARED_COMPARABILITY_SCOPE_CAN_FEED_ROMANIA_COMPETITION; SELLER_OR_STORE_SCOPED_DATA_IS_EXCLUDED; LOWER_BOUNDS_ARE_NOT_EXACT_COUNTS; NO_VERIFIED_SALES_CLAIM',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,paidCallsTriggered:0
  };
}

export function buildRomaniaGapMultiMarketRadar(rows=[]){
  const out=(rows||[]).map(row=>({productKey:row.productKey||row.identity||null,title:row.title||row.name||null,...calculateRomaniaMarketGapV2(row)}));
  const ready=out.filter(x=>x.status==='READY').sort((a,b)=>b.score-a.score);
  const incomplete=out.filter(x=>x.status!=='READY');
  return {version:'2.1',total:out.length,ready:ready.length,incomplete:incomplete.length,strongMultiMarket:ready.filter(x=>x.confidenceClass==='MULTI_MARKET_STRONG').length,rows:[...ready,...incomplete],policy:'RADAR_ONLY_NO_PURCHASE_AUTHORIZATION',paidCallsTriggered:0,purchaseAuthorized:false};
}
