const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

export const ROMANIA_GAP_COVERAGE_CLASSES=Object.freeze(['EXACT','EXHAUSTIVE_QUERY','ESTIMATED']);
export const ROMANIA_GAP_COMPARABILITY=Object.freeze(['EXACT','COMPARABLE','NOT_COMPARABLE','UNKNOWN']);

function validCoverage(v){const x=upper(v);return ROMANIA_GAP_COVERAGE_CLASSES.includes(x)?x:null;}
function validComparability(v){const x=upper(v);return ROMANIA_GAP_COMPARABILITY.includes(x)?x:'UNKNOWN';}

function dedupeComparableListings(listings=[]){
  const map=new Map();
  for(const raw of listings||[]){
    const comparability=validComparability(raw?.comparability||raw?.comparisonClass);
    if(!['EXACT','COMPARABLE'].includes(comparability))continue;
    const listingId=text(raw.listingId||raw.externalId||raw.url);
    const variantKey=text(raw.variantKey||raw.variantGroupId||listingId);
    const key=variantKey||listingId;
    if(!key)continue;
    const price=Number(raw.priceRon);
    const reviewCount=Number(raw.reviewCount);
    const row={listingId:listingId||null,variantKey:key,sellerId:text(raw.sellerId||raw.sellerName)||null,brand:text(raw.brand)||null,priceRon:Number.isFinite(price)?price:null,reviewCount:Number.isFinite(reviewCount)?reviewCount:null,comparability,evidenceClass:upper(raw.evidenceClass)||'UNKNOWN'};
    const existing=map.get(key);
    if(!existing||comparability==='EXACT'&&existing.comparability!=='EXACT')map.set(key,row);
  }
  return [...map.values()];
}

function concentration(rows=[]){
  if(!rows.length)return null;
  const counts=new Map();
  for(const r of rows){const k=r.sellerId||'UNKNOWN_SELLER';counts.set(k,(counts.get(k)||0)+1);}
  const top=Math.max(...counts.values());
  return Number(((top/rows.length)*100).toFixed(2));
}

function computeGapScore({comparableCount,coverageClass,localDemandScore,reviewBarrier,priceSpreadPct,sellerConcentrationPct}){
  let score=50;
  if(comparableCount===0)score+=30;
  else if(comparableCount<=3)score+=22;
  else if(comparableCount<=10)score+=10;
  else if(comparableCount>=30)score-=20;
  if(Number.isFinite(localDemandScore)){score+=(localDemandScore-50)*0.25;}
  if(Number.isFinite(reviewBarrier)){if(reviewBarrier<=25)score+=8;else if(reviewBarrier>=500)score-=10;}
  if(Number.isFinite(sellerConcentrationPct)){if(sellerConcentrationPct>=70)score+=6;else if(sellerConcentrationPct<=30)score-=3;}
  if(Number.isFinite(priceSpreadPct)&&priceSpreadPct>80)score-=5;
  if(coverageClass==='ESTIMATED')score=Math.min(score,70);
  return clamp(Number(score.toFixed(2)));
}

function computeConfidence({canonicalProductId,coverageClass,observedAt,source,sourceUrl,listingInputCount,comparableCount,unknownComparabilityCount,localDemandEvidence}){
  if(!canonicalProductId)return 0;
  let c=0;
  if(coverageClass==='EXHAUSTIVE_QUERY')c+=40;else if(coverageClass==='EXACT')c+=30;else if(coverageClass==='ESTIMATED')c+=15;
  if(text(observedAt))c+=10;
  if(text(source))c+=10;
  if(text(sourceUrl))c+=5;
  if(listingInputCount>0)c+=10;
  if(comparableCount>=0)c+=5;
  if(unknownComparabilityCount===0)c+=10;else if(unknownComparabilityCount<=Math.max(1,listingInputCount*0.1))c+=5;
  if(localDemandEvidence?.evidenceClass&&upper(localDemandEvidence.evidenceClass)!=='UNKNOWN')c+=10;
  if(coverageClass==='ESTIMATED')c=Math.min(c,50);
  return clamp(c);
}

export function analyzeRomaniaGapV2({canonicalProductId=null,queryEvidence={},listings=[],localDemandEvidence=null}={}){
  const id=text(canonicalProductId).toLowerCase()||null;
  const coverageClass=validCoverage(queryEvidence.coverageClass);
  const observedAt=text(queryEvidence.observedAt)||null;
  const source=text(queryEvidence.source)||null;
  const sourceUrl=text(queryEvidence.sourceUrl)||null;
  const scope=text(queryEvidence.scope)||'QUERY_SURFACE';
  const input=Array.isArray(listings)?listings:[];
  const comparable=dedupeComparableListings(input);
  const unknownComparabilityCount=input.filter(x=>validComparability(x?.comparability||x?.comparisonClass)==='UNKNOWN').length;
  const sellers=new Set(comparable.map(x=>x.sellerId).filter(Boolean));
  const brands=new Set(comparable.map(x=>x.brand).filter(Boolean));
  const prices=comparable.map(x=>x.priceRon).filter(Number.isFinite);
  const reviews=comparable.map(x=>x.reviewCount).filter(Number.isFinite);
  const medianPriceRon=median(prices);
  const reviewBarrier=median(reviews);
  const minPrice=prices.length?Math.min(...prices):null,maxPrice=prices.length?Math.max(...prices):null;
  const priceSpreadPct=minPrice!==null&&minPrice>0&&maxPrice!==null?Number((((maxPrice-minPrice)/minPrice)*100).toFixed(2)):null;
  const sellerConcentrationPct=concentration(comparable);
  const localDemandScore=Number.isFinite(Number(localDemandEvidence?.score))?clamp(localDemandEvidence.score):null;
  const gapScore=coverageClass?computeGapScore({comparableCount:comparable.length,coverageClass,localDemandScore,reviewBarrier,priceSpreadPct,sellerConcentrationPct}):null;
  const confidence=computeConfidence({canonicalProductId:id,coverageClass,observedAt,source,sourceUrl,listingInputCount:input.length,comparableCount:comparable.length,unknownComparabilityCount,localDemandEvidence});

  const reasons=[];
  let gateStatus='UNKNOWN';
  if(!id)reasons.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(!coverageClass)reasons.push('VALID_COVERAGE_CLASS_REQUIRED');
  if(!source)reasons.push('SOURCE_REQUIRED');
  if(!observedAt)reasons.push('OBSERVED_AT_REQUIRED');
  if(unknownComparabilityCount>0)reasons.push('UNKNOWN_LISTING_COMPARABILITY_REMAINS');
  if(!localDemandEvidence||upper(localDemandEvidence.evidenceClass||'UNKNOWN')==='UNKNOWN')reasons.push('LOCAL_DEMAND_EVIDENCE_MISSING');

  const decisionEligible=Boolean(id&&coverageClass&&source&&observedAt);
  if(decisionEligible){
    if(coverageClass==='ESTIMATED'){gateStatus='REVIEW';reasons.push('ESTIMATED_COVERAGE_CANNOT_PROVE_GAP');}
    else if(unknownComparabilityCount>0){gateStatus='REVIEW';}
    else if(localDemandScore===null){gateStatus='REVIEW';}
    else if((gapScore??0)>=65&&confidence>=60){gateStatus='PASS';reasons.push('LOW_LOCAL_COMPARABLE_SUPPLY_WITH_SUPPORTED_DEMAND');}
    else {gateStatus='REVIEW';reasons.push('GAP_EVIDENCE_NOT_STRONG_ENOUGH_FOR_PASS');}
  }

  const marketWideClaimAllowed=Boolean(coverageClass==='EXHAUSTIVE_QUERY'&&upper(scope)==='MARKET_WIDE'&&queryEvidence.marketWideVerified===true);

  return Object.freeze({
    schemaVersion:'MPR_ROMANIA_GAP_V2',canonicalProductId:id,decisionEligible,gateStatus,gapScore,confidence,coverageClass:coverageClass||'UNKNOWN',scope,
    comparableListingCount:comparable.length,sellerCount:sellers.size,brandCount:brands.size,medianPriceRon,reviewBarrier,priceSpreadPct,sellerConcentrationPct,
    localDemandScore,unknownComparabilityCount,source,sourceUrl,observedAt,marketWideClaimAllowed,
    comparableListings:Object.freeze(comparable),reasons:Object.freeze([...new Set(reasons)]),evidenceClass:'DERIVED',
    canPromoteToFinalist:false,canPromoteToTestReady:false,canPromoteToBuyReady:false,autoPromoteOpportunityStage:false,purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'EXACT_COMPARABILITY_ONLY; VARIANT_DEDUP; COVERAGE_CLASS_MUST_BE_EXPLICIT; ESTIMATED_NEVER_PROVES_MARKET_GAP; ZERO_ON_REVIEWED_SURFACE_IS_NOT_MARKET_WIDE_ZERO; LOCAL_DEMAND_REQUIRED_FOR_PASS'
  });
}
