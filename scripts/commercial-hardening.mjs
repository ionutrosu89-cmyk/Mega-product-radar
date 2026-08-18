import fs from 'node:fs/promises';

const MARKET='market-intelligence-live.json';
const OBS='commercial-observations.json';
const OUT='commercial-hardening-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,num(v)));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const arr=v=>Array.isArray(v)?v:[];
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function verifiedPricing(p,o){
  const offers=arr(o?.romaniaPricing?.offers).filter(x=>num(x.priceRon)>0&&x.url&&x.verifiedAt);
  const domains=[...new Set(offers.map(x=>{try{return new URL(x.url).hostname.replace(/^www\./,'')}catch{return''}}).filter(Boolean))];
  const prices=offers.map(x=>num(x.priceRon)).sort((a,b)=>a-b);
  const already=Boolean(p?.economics?.pricingVerified||p?.profitEngineV2?.pricingVerified);
  const verified=already||(offers.length>=2&&domains.length>=2);
  const median=prices.length?prices[Math.floor(prices.length/2)]:num(p?.profitEngineV2?.derivedSalePrice);
  return {verified,status:verified?'VERIFIED':offers.length?'PARTIAL':'MISSING',offerCount:offers.length,domainCount:domains.length,minPriceRon:prices[0]||null,medianPriceRon:median||null,maxPriceRon:prices.at(-1)||null,offers,policy:'VERIFIED requires an already confirmed price or at least two dated Romanian offers from distinct domains.'};
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
  return {salesVerified,status:salesVerified?'VERIFIED_SALES':(keywordVolume||roLinks?'PROXY_ONLY':'MISSING'),verifiedUnits30d:verifiedUnits||null,verifiedRevenue30dRon:verifiedRevenue||null,observations,proxyDemandScore:round(proxy),romaniaSaturationScore:round(saturation),romaniaDomains:roDomains,policy:'Proxy demand is never presented as sales. VERIFIED_SALES requires a dated observation with units or revenue from a named source.'};
}

function supplierCommercial(p,o){
  const quotes=arr(o?.supplierQuotes).filter(x=>x.supplier&&x.platform&&num(x.unitPrice)>0&&num(x.moq)>0&&x.verifiedAt);
  const complete=quotes.filter(x=>num(x.shippingRon)>=0&&num(x.sampleCostRon)>=0&&x.leadTimeDays!==undefined);
  const best=complete.slice().sort((a,b)=>(num(a.unitPrice)+num(a.shippingRon)/Math.max(1,num(a.moq)))-(num(b.unitPrice)+num(b.shippingRon)/Math.max(1,num(b.moq))))[0]||null;
  const verified=complete.length>0;
  return {verified,status:verified?'COMMERCIAL_VERIFIED':quotes.length?'QUOTE_PARTIAL':'MISSING',quoteCount:quotes.length,completeQuoteCount:complete.length,bestQuote:best,quotes,policy:'Supplier is commercially verified only when a dated quote includes unit price, MOQ, shipping, sample cost and lead time.'};
}

function reviews(p,o){
  const manual=arr(o?.reviewEvidence).filter(x=>x.source&&x.verifiedAt&&String(x.text||'').trim());
  const existingCount=num(p?.reviewIntelligenceV2?.snippetCount||p?.reviews?.snippetCount);
  const existingSources=num(p?.reviewIntelligenceV2?.sourceCount||p?.reviews?.sourceCount);
  const total=existingCount+manual.length;
  const sources=existingSources+new Set(manual.map(x=>x.source)).size;
  const themes=[...new Set([...arr(p?.reviewIntelligenceV2?.negativeThemes),...manual.flatMap(x=>arr(x.negativeThemes))].map(x=>String(x).trim()).filter(Boolean))];
  const verified=sources>=1&&total>=2;
  return {verified,status:verified?'EVIDENCE_READY':total?'PARTIAL':'MISSING',sourceCount:sources,snippetCount:total,negativeThemes:themes.slice(0,10),manualEvidence:manual,policy:'Review evidence requires at least two concrete snippets across one or more named sources.'};
}

function feedback(p,o){
  const tests=arr(o?.commercialTests).filter(x=>x.startedAt&&num(x.quantity)>0&&num(x.unitLandedCostRon)>0&&num(x.salePriceRon)>0);
  const completed=tests.filter(x=>x.completedAt&&num(x.unitsSold)>=0);
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
  p.commercialHardening={version:'1.0',pricing,competitorSales:competitor,supplierCommercial:supplier,reviewEvidence:review,feedback:fb,gates,readiness};
  rows.push({name:p.name,cat:p.cat,goldenStage:p?.goldenPipeline?.stage||'DISCOVERED',readiness,gates,pricingStatus:pricing.status,salesStatus:competitor.status,supplierStatus:supplier.status,reviewStatus:review.status,feedbackStatus:fb.status});
}

const completedFeedback=market.products.map(p=>p?.commercialHardening?.feedback?.latest).filter(x=>x&&x.completedAt&&Number.isFinite(Number(x.predictionErrorUnitProfitRon)));
const mae=completedFeedback.length?completedFeedback.reduce((s,x)=>s+Math.abs(num(x.predictionErrorUnitProfitRon)),0)/completedFeedback.length:null;
const calibration={sampleSize:completedFeedback.length,unitProfitMaeRon:mae===null?null:round(mae),autoCalibrationEnabled:completedFeedback.length>=5,policy:'Weights must not auto-calibrate before at least 5 completed real commercial tests.'};
market.commercialHardening={version:'1.0',updatedAt:new Date().toISOString(),stats:{products:rows.length,pricingVerified:rows.filter(x=>x.gates.pricingVerified).length,salesVerified:rows.filter(x=>x.gates.salesVerified).length,supplierVerified:rows.filter(x=>x.gates.supplierVerified).length,reviewVerified:rows.filter(x=>x.gates.reviewVerified).length,fullyVerified:rows.filter(x=>x.readiness===100).length},calibration};
market.updatedAt=new Date().toISOString();
await fs.writeFile(MARKET,JSON.stringify(market,null,2)+'\n');
await fs.writeFile(OUT,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),policy:'Commercial facts are separated from proxies. Missing evidence never becomes zero or verified.',stats:market.commercialHardening.stats,calibration,items:rows},null,2)+'\n');
console.log(`Commercial hardening: ${rows.length} products · pricing ${market.commercialHardening.stats.pricingVerified} · sales ${market.commercialHardening.stats.salesVerified} · supplier ${market.commercialHardening.stats.supplierVerified} · reviews ${market.commercialHardening.stats.reviewVerified} · fully verified ${market.commercialHardening.stats.fullyVerified}.`);
