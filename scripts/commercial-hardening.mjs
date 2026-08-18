import fs from 'node:fs/promises';

const MARKET='market-intelligence-live.json';
const OBS='commercial-observations.json';
const OUT='commercial-hardening-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,num(v)));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const arr=v=>Array.isArray(v)?v:[];
const hasOwn=(o,k)=>Boolean(o&&Object.prototype.hasOwnProperty.call(o,k));
const explicitFinite=(o,k)=>hasOwn(o,k)&&o[k]!==null&&o[k]!==''&&Number.isFinite(Number(o[k]));
const domainOf=url=>{try{return new URL(String(url||'')).hostname.replace(/^www\./,'').toLowerCase();}catch{return'';}};
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function verifiedPricing(p,o){
  const offers=arr(o?.romaniaPricing?.offers).filter(x=>num(x.priceRon)>0&&x.url&&x.verifiedAt&&String(x.matchQuality||'HIGH').toUpperCase()!=='LOW');
  const domains=[...new Set(offers.map(x=>domainOf(x.url)).filter(Boolean))];
  const prices=offers.map(x=>num(x.priceRon)).sort((a,b)=>a-b);
  const already=Boolean(p?.economics?.pricingVerified||p?.profitEngineV2?.pricingVerified);
  const verified=already||(offers.length>=2&&domains.length>=2);
  const median=prices.length?prices[Math.floor(prices.length/2)]:num(p?.profitEngineV2?.derivedSalePrice);
  return {
    verified,
    status:verified?'VERIFIED':offers.length?'PARTIAL':'MISSING',
    offerCount:offers.length,
    domainCount:domains.length,
    domains,
    minPriceRon:prices[0]||null,
    medianPriceRon:median||null,
    maxPriceRon:prices.at(-1)||null,
    offers,
    policy:'VERIFIED requires an already confirmed price or at least two dated Romanian/comparable-market offers from distinct domains. LOW-quality matches never qualify.'
  };
}

function competitorSales(p,o){
  const observations=arr(o?.competitorSales?.observations).filter(x=>x.source&&x.verifiedAt&&(num(x.units30d)>0||num(x.revenue30dRon)>0||num(x.reviewVelocity30d)>0));
  const verifiedUnits=observations.reduce((s,x)=>s+num(x.units30d),0);
  const verifiedRevenue=observations.reduce((s,x)=>s+num(x.revenue30dRon),0);
  const roDomains=num(p?.competitors?.romania?.domainCount);
  const roLinks=num(p?.competitors?.romania?.observedLinks);
  const keywordVolume=p?.keywordDemand?.verifiedSearchVolume?num(p.keywordDemand.searchVolume):0;
  const salesVerified=observations.some(x=>num(x.units30d)>0||num(x.revenue30dRon)>0);
  const proxy=clamp(Math.log10(keywordVolume+1)*20+Math.min(30,roLinks*5)+Math.min(20,roDomains*8));
  const saturation=clamp(num(p?.competitors?.saturationScore));
  return {
    salesVerified,
    status:salesVerified?'VERIFIED_SALES':(keywordVolume||roLinks?'PROXY_ONLY':'MISSING'),
    verifiedUnits30d:verifiedUnits||null,
    verifiedRevenue30dRon:verifiedRevenue||null,
    observations,
    proxyDemandScore:round(proxy),
    romaniaSaturationScore:round(saturation),
    romaniaDomains:roDomains,
    romaniaObservedLinks:roLinks,
    policy:'Proxy demand, result counts, ratings and lifetime sold counts are never presented as 30-day sales. VERIFIED_SALES requires a dated observation with actual units30d or revenue30d from a named source.'
  };
}

function supplierCommercial(p,o){
  const quotes=arr(o?.supplierQuotes).filter(x=>x.supplier&&x.platform&&num(x.unitPrice)>0&&num(x.moq)>0&&x.verifiedAt&&(x.sourceUrl||x.url));
  const complete=quotes.filter(x=>
    explicitFinite(x,'shippingRon')&&num(x.shippingRon)>=0&&
    explicitFinite(x,'sampleCostRon')&&num(x.sampleCostRon)>=0&&
    explicitFinite(x,'leadTimeDays')&&num(x.leadTimeDays)>0
  );
  const best=complete.slice().sort((a,b)=>(num(a.unitPrice)+num(a.shippingRon)/Math.max(1,num(a.moq)))-(num(b.unitPrice)+num(b.shippingRon)/Math.max(1,num(b.moq))))[0]||null;
  const verified=complete.length>0;
  const scannerSignals=arr(p?.sourcing?.items).map(x=>({platform:x?.platform||x?.source||'',url:x?.url||x?.sourceUrl||'',label:x?.name||x?.title||''})).filter(x=>x.url||x.platform);
  return {
    verified,
    status:verified?'COMMERCIAL_VERIFIED':quotes.length?'QUOTE_PARTIAL':scannerSignals.length?'LISTING_SIGNAL_ONLY':'MISSING',
    quoteCount:quotes.length,
    completeQuoteCount:complete.length,
    bestQuote:best,
    quotes,
    scannerListingSignals:scannerSignals.slice(0,10),
    policy:'Supplier is commercially verified only when a dated source-linked quote explicitly includes unit price, MOQ, shippingRon, sampleCostRon and a positive leadTimeDays. Missing numeric fields are never coerced to zero.'
  };
}

function reviews(p,o){
  const manual=arr(o?.reviewEvidence).filter(x=>x.source&&x.verifiedAt&&String(x.text||'').trim());
  const existingCount=num(p?.reviewIntelligenceV2?.snippetCount||p?.reviews?.snippetCount);
  const existingSources=num(p?.reviewIntelligenceV2?.sourceCount||p?.reviews?.sourceCount);
  const total=existingCount+manual.length;
  const sources=existingSources+new Set(manual.map(x=>x.source)).size;
  const themes=[...new Set([...arr(p?.reviewIntelligenceV2?.negativeThemes),...manual.flatMap(x=>arr(x.negativeThemes))].map(x=>String(x).trim()).filter(Boolean))];
  const verified=sources>=1&&total>=2;
  return {
    verified,
    status:verified?'EVIDENCE_READY':total?'PARTIAL':'MISSING',
    sourceCount:sources,
    snippetCount:total,
    negativeThemes:themes.slice(0,10),
    manualEvidence:manual,
    policy:'Review evidence requires at least two concrete snippets across one or more named sources. Comparable-product evidence informs pain points but does not prove sales.'
  };
}

function feedback(p,o){
  const tests=arr(o?.commercialTests).filter(x=>x.startedAt&&num(x.quantity)>0&&num(x.unitLandedCostRon)>0&&num(x.salePriceRon)>0);
  const completed=tests.filter(x=>x.completedAt&&explicitFinite(x,'unitsSold')&&num(x.unitsSold)>=0);
  const latest=completed.at(-1)||tests.at(-1)||null;
  if(!latest)return {status:'NO_REAL_TEST',tests:tests.length,completed:completed.length,latest:null};
  const revenue=num(latest.unitsSold)*num(latest.salePriceRon);
  const cogs=num(latest.unitsSold)*num(latest.unitLandedCostRon);
  const grossProfit=revenue-cogs-num(latest.adSpendRon)-num(latest.returnCostRon);
  const sellThrough=num(latest.quantity)>0?num(latest.unitsSold)/num(latest.quantity)*100:0;
  const actualMargin=revenue>0?grossProfit/revenue*100:0;
  const predictedProfit=num(p?.economics?.profit);
  const actualUnitProfit=num(latest.unitsSold)>0?grossProfit/num(latest.unitsSold):0;
  return {status:latest.completedAt?'COMPLETED':'RUNNING',tests:tests.length,completed:completed.length,latest:{...latest,revenueRon:round(revenue),grossProfitRon:round(grossProfit),sellThroughPct:round(sellThrough),actualMarginPct:round(actualMargin),actualUnitProfitRon:round(actualUnitProfit),predictionErrorUnitProfitRon:round(actualUnitProfit-predictedProfit)}};
}

function nextActions(gates,pricing,competitor,supplier,review){
  const missing=[];
  if(!gates.pricingVerified)missing.push('pricingVerified');
  if(!gates.salesVerified)missing.push('salesVerified');
  if(!gates.supplierVerified)missing.push('supplierVerified');
  if(!gates.reviewVerified)missing.push('reviewVerified');
  const actions=[];
  if(!gates.pricingVerified)actions.push('Capture at least two dated Romanian offers from distinct domains.');
  if(!gates.salesVerified)actions.push('Obtain actual dated 30-day units or revenue from a legitimate provider/source; do not substitute reviews or result counts.');
  if(!gates.supplierVerified)actions.push(supplier.quoteCount?'Complete supplier quote with explicit shippingRon, sampleCostRon and leadTimeDays.':'Capture a source-linked supplier quote with unit price and MOQ, then complete logistics/sample terms.');
  if(!gates.reviewVerified)actions.push('Collect at least two concrete review snippets from named sources to identify recurring product pain points.');
  return {missingEvidence:missing,nextActions:actions,proofSummary:{romaniaOffers:pricing.offerCount,romaniaDomains:pricing.domainCount,salesObservations:competitor.observations.length,supplierQuotes:supplier.quoteCount,completeSupplierQuotes:supplier.completeQuoteCount,reviewSnippets:review.snippetCount,reviewSources:review.sourceCount}};
}

const market=await read(MARKET,{products:[],stats:{}});
const observations=await read(OBS,{version:'1.0',products:{}});
const byName=observations.products&&typeof observations.products==='object'?observations.products:{};
const rows=[];
for(const p of arr(market.products)){
  const o=byName[norm(p.name)]||byName[p.name]||{};
  const pricing=verifiedPricing(p,o);
  const competitor=competitorSales(p,o);
  const supplier=supplierCommercial(p,o);
  const review=reviews(p,o);
  const fb=feedback(p,o);
  const gates={pricingVerified:pricing.verified,salesVerified:competitor.salesVerified,supplierVerified:supplier.verified,reviewVerified:review.verified};
  const verifiedCount=Object.values(gates).filter(Boolean).length;
  const readiness=round(verifiedCount/4*100);
  const actionState=nextActions(gates,pricing,competitor,supplier,review);
  p.commercialHardening={version:'1.1',pricing,competitorSales:competitor,supplierCommercial:supplier,reviewEvidence:review,feedback:fb,gates,readiness,...actionState};
  rows.push({name:p.name,cat:p.cat,goldenStage:p?.goldenPipeline?.stage||'DISCOVERED',readiness,gates,pricingStatus:pricing.status,salesStatus:competitor.status,supplierStatus:supplier.status,reviewStatus:review.status,feedbackStatus:fb.status,...actionState});
}

const completedFeedback=arr(market.products).map(p=>p?.commercialHardening?.feedback?.latest).filter(x=>x&&x.completedAt&&Number.isFinite(Number(x.predictionErrorUnitProfitRon)));
const mae=completedFeedback.length?completedFeedback.reduce((s,x)=>s+Math.abs(num(x.predictionErrorUnitProfitRon)),0)/completedFeedback.length:null;
const calibration={sampleSize:completedFeedback.length,unitProfitMaeRon:mae===null?null:round(mae),autoCalibrationEnabled:completedFeedback.length>=5,policy:'Weights must not auto-calibrate before at least 5 completed real commercial tests.'};
const stats={products:rows.length,pricingVerified:rows.filter(x=>x.gates.pricingVerified).length,salesVerified:rows.filter(x=>x.gates.salesVerified).length,supplierVerified:rows.filter(x=>x.gates.supplierVerified).length,reviewVerified:rows.filter(x=>x.gates.reviewVerified).length,fullyVerified:rows.filter(x=>x.readiness===100).length,withSupplierPartial:rows.filter(x=>x.supplierStatus==='QUOTE_PARTIAL').length,withPublicPricing:rows.filter(x=>x.proofSummary.romaniaOffers>0).length};
market.commercialHardening={version:'1.1',updatedAt:new Date().toISOString(),stats,calibration,policy:'Commercial facts are separated from proxies. Missing evidence never becomes zero or verified. Public provider evidence may reduce unknowns but cannot bypass TEST/BUY gates.'};
market.updatedAt=new Date().toISOString();
await fs.writeFile(MARKET,JSON.stringify(market,null,2)+'\n');
await fs.writeFile(OUT,JSON.stringify({version:'1.1',updatedAt:new Date().toISOString(),policy:'Commercial facts are separated from proxies. Missing evidence never becomes zero or verified. Supplier completeness requires explicit fields; public evidence cannot invent sales.',stats,calibration,items:rows},null,2)+'\n');
console.log(`Commercial hardening: ${rows.length} products · pricing ${stats.pricingVerified} · sales ${stats.salesVerified} · supplier ${stats.supplierVerified} · reviews ${stats.reviewVerified} · supplier partial ${stats.withSupplierPartial} · fully verified ${stats.fullyVerified}.`);
