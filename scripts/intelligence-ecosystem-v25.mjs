import fs from 'node:fs/promises';

const MARKET='market-intelligence-live.json';
const HISTORY='market-intelligence-history.json';
const OBS='commercial-observations.json';
const OUT='intelligence-ecosystem-live.json';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,num(v)));
const arr=v=>Array.isArray(v)?v:[];
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const median=values=>{const a=values.map(num).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function historyFor(history,p){return history?.products?.[norm(p.name)]||history?.products?.[p.name]||null;}
function trendDelta(snaps,key){const pts=arr(snaps).filter(x=>x&&Number.isFinite(Number(x[key])));if(pts.length<2)return null;return round(num(pts.at(-1)[key])-num(pts[0][key]));}
function trendDirection(v){if(v===null)return'UNKNOWN';if(v>=15)return'ACCELERATING';if(v>=5)return'RISING';if(v<=-15)return'DECLINING';if(v<=-5)return'COOLING';return'STABLE';}

function historicalEngine(p,h){
  const snapshots=arr(h?.snapshots);
  const demandDelta=trendDelta(snapshots,'demand');
  const launchDelta=trendDelta(snapshots,'launch');
  const gapDelta=trendDelta(snapshots,'marketGap');
  const competitionDelta=trendDelta(snapshots,'competitionPressure');
  const keywordPoints=snapshots.filter(x=>Number.isFinite(Number(x?.keywordVolume))&&num(x.keywordVolume)>0);
  const pricePoints=snapshots.filter(x=>Number.isFinite(Number(x?.price))&&num(x.price)>0);
  const observedDays=snapshots.length>1?Math.max(0,(new Date(snapshots.at(-1).at)-new Date(snapshots[0].at))/86400000):0;
  const direction=trendDirection((demandDelta??0)+(launchDelta??0)*.5-(competitionDelta??0)*.25);
  const confidence=clamp(Math.min(50,snapshots.length*10)+Math.min(20,observedDays*2)+(keywordPoints.length?20:0)+(pricePoints.length?10:0));
  return {version:'1.0',snapshotCount:snapshots.length,observedDays:round(observedDays),direction,confidence:round(confidence),deltas:{demand:demandDelta,launch:launchDelta,marketGap:gapDelta,competitionPressure:competitionDelta},keywordHistoryPoints:keywordPoints.length,priceHistoryPoints:pricePoints.length,policy:'Historical intelligence uses stored snapshots only. Missing history remains unknown; no synthetic historical points are created.'};
}

function salesEstimation(p,hist){
  const kwVerified=p?.keywordDemand?.verifiedSearchVolume===true&&num(p?.keywordDemand?.searchVolume)>0;
  const kw=num(p?.keywordDemand?.searchVolume);
  const foreignLinks=num(p?.competitors?.foreign?.observedLinks);
  const foreignDomains=num(p?.competitors?.foreign?.domainCount);
  const demand=clamp(p?.demand?.score);
  const reviews=num(p?.commercialHardening?.reviewEvidence?.snippetCount||p?.reviews?.snippetCount);
  const reviewSources=num(p?.commercialHardening?.reviewEvidence?.sourceCount||p?.reviews?.sourceCount);
  const trend=String(p?.trendIntelligence?.status||hist?.direction||'UNKNOWN').toUpperCase();
  const concreteEvidence=num(p?.evidenceCoverage?.concreteRows);
  const actualSales=p?.commercialHardening?.competitorSales?.salesVerified===true;
  const actualUnits=num(p?.commercialHardening?.competitorSales?.verifiedUnits30d);
  let confidence=0;
  if(kwVerified)confidence+=30;
  if(foreignDomains>=2)confidence+=18;else if(foreignDomains===1)confidence+=9;
  if(foreignLinks>=3)confidence+=12;else if(foreignLinks>0)confidence+=6;
  if(hist?.snapshotCount>=3)confidence+=12;else if(hist?.snapshotCount>=2)confidence+=6;
  if(reviewSources>0&&reviews>=2)confidence+=10;
  if(concreteEvidence>=2)confidence+=8;
  if(['RISING','ACCELERATING','STABLE','COOLING','DECLINING'].includes(trend))confidence+=5;
  if(actualSales)confidence=100;
  confidence=clamp(confidence);

  let base=null;
  if(actualSales&&actualUnits>0)base=actualUnits;
  else if(kwVerified){
    const captureRate=clamp(3+demand*.05+Math.min(4,foreignDomains),3,12)/100;
    base=Math.max(1,kw*captureRate);
  }else if(confidence>=45&&foreignLinks>0){
    base=Math.max(1,(foreignLinks*6+foreignDomains*10)*(0.65+demand/200));
  }
  if(base!==null){
    if(trend==='ACCELERATING')base*=1.18;else if(trend==='RISING')base*=1.08;else if(trend==='DECLINING')base*=.82;else if(trend==='COOLING')base*=.92;
  }
  const estimate=base===null?null:Math.round(base);
  const uncertainty=confidence>=80?.2:confidence>=65?.3:confidence>=50?.45:.6;
  const low=estimate===null?null:Math.max(1,Math.round(estimate*(1-uncertainty)));
  const high=estimate===null?null:Math.max(low,Math.round(estimate*(1+uncertainty)));
  const status=actualSales?'ACTUAL_OBSERVED':estimate===null?'INSUFFICIENT_DATA':confidence>=75?'ESTIMATED_HIGH_CONFIDENCE':confidence>=55?'ESTIMATED_MEDIUM_CONFIDENCE':'ESTIMATED_LOW_CONFIDENCE';
  return {version:'1.0',status,estimatedUnits30d:estimate,rangeLow:low,rangeHigh:high,confidence:round(confidence),inputs:{keywordVolumeVerified:kwVerified,keywordVolume:kwVerified?kw:null,foreignDomains,foreignLinks,demandScore:round(demand),reviewSources,reviewSnippets:reviews,historicalSnapshots:hist?.snapshotCount||0,trend,actualSalesObserved:actualSales},policy:'Estimated sales are model outputs, never labelled verified sales. Actual competitor sales remain a separate observation. TEST may use a high-confidence estimate; BUY never does.'};
}

function romaniaDemandEngine(p){
  const keywordVerified=p?.keywordDemand?.verifiedSearchVolume===true&&num(p?.keywordDemand?.searchVolume)>0;
  const keywordVolume=keywordVerified?num(p.keywordDemand.searchVolume):null;
  const roDomains=num(p?.competitors?.romania?.domainCount);
  const roLinks=num(p?.competitors?.romania?.observedLinks);
  const roResultProxy=num(p?.competitors?.romania?.resultProxy);
  const pricingVerified=p?.commercialHardening?.pricing?.verified===true;
  const pricingDomains=num(p?.commercialHardening?.pricing?.domainCount);
  const evidenceReady=p?.evidenceCoverage?.evidenceReady===true;
  let score=0;
  if(keywordVerified)score+=clamp(Math.log10(keywordVolume+1)*22,0,55);
  score+=Math.min(18,roDomains*6)+Math.min(12,roLinks*2)+Math.min(8,roResultProxy);
  if(pricingVerified)score+=10;
  score=clamp(score);
  const proxyReady=!keywordVerified&&pricingVerified&&pricingDomains>=2&&evidenceReady&&roDomains>=1;
  const status=keywordVerified?'PROVIDER_VERIFIED':proxyReady?'MARKET_EVIDENCE_READY':'INSUFFICIENT';
  return {version:'1.0',status,score:round(score),providerVerified:keywordVerified,marketEvidenceReady:proxyReady,keywordVolume,romaniaDomains:roDomains,romaniaObservedLinks:roLinks,romaniaResultProxy:roResultProxy,pricingVerified,pricingDomains,evidenceReady,readyForTestDemandGate:keywordVerified||proxyReady,policy:'Provider-verified search volume is strongest. Multi-source Romanian market evidence may satisfy the TEST demand gate but is never labelled verified search volume.'};
}

function reverseKeywordEngine(p){
  const kd=p?.keywordDemand||{};
  const signals=arr(p?.evidenceCoverage?.rows);
  const competitorRows=signals.filter(x=>x.present&&(x.observedLinks>0||x.resultCount>0));
  const providerVerified=kd.verifiedSearchVolume===true&&num(kd.searchVolume)>0;
  const seedKeywords=[p.name,p.cat].map(x=>String(x||'').trim()).filter(Boolean);
  return {version:'1.0',status:providerVerified?'SEED_PROVIDER_READY':competitorRows.length>=2?'COMPETITOR_EVIDENCE_READY':'PROXY_ONLY',seedKeywords:[...new Set(seedKeywords)],verifiedKeywordCount:providerVerified?1:0,competitorEvidenceRows:competitorRows.length,searchVolume:providerVerified?num(kd.searchVolume):null,provider:providerVerified?(kd.provider||'PROVIDER'):'NONE',needsAsinKeywordProvider:true,policy:'This module exposes the reverse-keyword funnel without inventing competitor keywords. Exact ASIN→keyword ranks require a legitimate provider/API.'};
}

function reviewOpportunityEngine(p){
  const r=p?.commercialHardening?.reviewEvidence||{};
  const themes=arr(r.negativeThemes).map(x=>String(x).trim()).filter(Boolean);
  const snippets=num(r.snippetCount);
  const sources=num(r.sourceCount);
  const verified=r.verified===true;
  const score=clamp((verified?40:0)+Math.min(30,snippets*8)+Math.min(20,themes.length*6)+Math.min(10,sources*5));
  return {version:'1.0',status:verified?'EVIDENCE_READY':snippets?'PARTIAL':'MISSING',opportunityScore:round(score),sourceCount:sources,snippetCount:snippets,negativeThemes:themes.slice(0,10),topImprovementThemes:themes.slice(0,5),policy:'Review opportunity is based only on concrete review evidence. Theme frequency is not invented when snippet-level counts are unavailable.'};
}

function calibrationEngine(p,o){
  const tests=arr(o?.commercialTests).filter(x=>x.startedAt&&num(x.quantity)>0);
  const completed=tests.filter(x=>x.completedAt&&num(x.unitsSold)>=0);
  const latest=completed.at(-1)||null;
  if(!latest)return {version:'1.0',status:'NO_REAL_TEST',completedTests:completed.length,predictionError:null};
  const predicted=num(latest.predictedUnits30d||p?.salesEstimation?.estimatedUnits30d);
  const actual=num(latest.unitsSold);
  const error=predicted>0?round((actual-predicted)/predicted*100):null;
  return {version:'1.0',status:'REAL_FEEDBACK_AVAILABLE',completedTests:completed.length,predictedUnits:predicted||null,actualUnits:actual,predictionErrorPct:error,policy:'Calibration uses only completed real commercial tests. No automatic weight changes before a sufficient sample exists.'};
}

function buildNiches(products){
  const groups=new Map();
  for(const p of products){const key=String(p.cat||'Altele');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  const niches={};
  for(const [cat,items] of groups){
    const est=items.map(p=>p?.salesEstimation?.estimatedUnits30d).filter(v=>num(v)>0).map(num).sort((a,b)=>b-a);
    const prices=items.map(p=>p?.commercialHardening?.pricing?.medianPriceRon).filter(v=>num(v)>0).map(num);
    const reviews=items.map(p=>p?.reviewOpportunity?.snippetCount).filter(v=>num(v)>=0).map(num);
    const demandScores=items.map(p=>p?.romaniaDemand?.score).map(num);
    const totalEst=est.reduce((a,b)=>a+b,0);
    const top3=est.slice(0,3).reduce((a,b)=>a+b,0);
    const concentration=totalEst>0?top3/totalEst*100:null;
    const verifiedDemand=items.filter(p=>p?.romaniaDemand?.providerVerified).length;
    const highConfidenceSales=items.filter(p=>['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(p?.salesEstimation?.status)).length;
    const score=clamp((median(demandScores)||0)*.45+(100-(concentration??70))*.25+Math.min(20,highConfidenceSales*5)+(verifiedDemand?10:0));
    niches[cat]={version:'1.0',products:items.length,estimatedUnitsMedian:median(est),medianPriceRon:median(prices),medianReviewSnippets:median(reviews),medianRomaniaDemandScore:round(median(demandScores)||0),top3EstimatedSalesConcentrationPct:concentration===null?null:round(concentration),highConfidenceSalesModels:highConfidenceSales,providerVerifiedDemandProducts:verifiedDemand,nicheScore:round(score),status:items.length>=3?'TRACKABLE':'THIN_SAMPLE'};
  }
  return niches;
}

const market=await read(MARKET,{products:[]});
const history=await read(HISTORY,{products:{}});
const observations=await read(OBS,{products:{}});
const obsByName=observations.products&&typeof observations.products==='object'?observations.products:{};

for(const p of arr(market.products)){
  const h=historyFor(history,p);
  const hist=historicalEngine(p,h);
  p.historicalIntelligence=hist;
  p.salesEstimation=salesEstimation(p,hist);
  p.romaniaDemand=romaniaDemandEngine(p);
  p.reverseKeywordIntelligence=reverseKeywordEngine(p);
  p.reviewOpportunity=reviewOpportunityEngine(p);
  const o=obsByName[norm(p.name)]||obsByName[p.name]||{};
  p.calibrationEngine=calibrationEngine(p,o);
}

const niches=buildNiches(arr(market.products));
for(const p of arr(market.products))p.nicheIntelligence=niches[String(p.cat||'Altele')]||null;

const completedTests=arr(market.products).reduce((s,p)=>s+num(p?.calibrationEngine?.completedTests),0);
const stats={
  products:arr(market.products).length,
  salesHighConfidence:arr(market.products).filter(p=>['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(p?.salesEstimation?.status)).length,
  salesMediumConfidence:arr(market.products).filter(p=>p?.salesEstimation?.status==='ESTIMATED_MEDIUM_CONFIDENCE').length,
  romaniaDemandReady:arr(market.products).filter(p=>p?.romaniaDemand?.readyForTestDemandGate).length,
  providerVerifiedRomaniaDemand:arr(market.products).filter(p=>p?.romaniaDemand?.providerVerified).length,
  reverseKeywordProviderReady:arr(market.products).filter(p=>p?.reverseKeywordIntelligence?.verifiedKeywordCount>0).length,
  reviewOpportunityReady:arr(market.products).filter(p=>p?.reviewOpportunity?.status==='EVIDENCE_READY').length,
  historicalTrackable:arr(market.products).filter(p=>p?.historicalIntelligence?.snapshotCount>=2).length,
  niches:Object.keys(niches).length,
  completedRealTests:completedTests
};

market.intelligenceEcosystem={version:'2.5',updatedAt:new Date().toISOString(),policy:'Helium10/JungleScout/Keepa/SmartScout/SellerSprite-inspired methodology implemented with our own evidence-first models. Estimates remain estimates; actual observations remain separate. TEST may use high-confidence estimated demand; BUY requires our own real test.',engines:{salesEstimation:true,nicheIntelligence:true,romaniaDemand:true,reverseKeyword:true,historicalOpportunity:true,reviewOpportunity:true,calibration:true},stats};
market.updatedAt=new Date().toISOString();
await fs.writeFile(MARKET,JSON.stringify(market,null,2)+'\n');
await fs.writeFile(OUT,JSON.stringify({version:'2.5',updatedAt:new Date().toISOString(),policy:market.intelligenceEcosystem.policy,stats,niches,items:arr(market.products).map(p=>({name:p.name,cat:p.cat,salesEstimation:p.salesEstimation,romaniaDemand:p.romaniaDemand,nicheIntelligence:p.nicheIntelligence,historicalIntelligence:p.historicalIntelligence,reverseKeywordIntelligence:p.reverseKeywordIntelligence,reviewOpportunity:p.reviewOpportunity,calibrationEngine:p.calibrationEngine}))},null,2)+'\n');
console.log(`Intelligence Ecosystem V2.5: ${stats.products} products · sales high ${stats.salesHighConfidence} · RO demand ready ${stats.romaniaDemandReady} · history ${stats.historicalTrackable} · review ready ${stats.reviewOpportunityReady} · niches ${stats.niches}.`);
