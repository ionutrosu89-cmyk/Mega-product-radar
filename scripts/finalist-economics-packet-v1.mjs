import fs from 'node:fs/promises';
import path from 'node:path';
import {freightModeViabilityV1} from '../freight-mode-viability-v1.js';

const GOLDEN='golden-pipeline-live.json';
const SUPPLIERS='supplier-page-evidence-live.json';
const SALES='public-sales-estimation-live.json';
const OBS='commercial-observations.json';
const MARKET='market-intelligence-live.json';
const OUT='finalist-economics-live.json';
const FREIGHT='data/freight-benchmarks/china-romania-public-freight-market-2026-09-06.json';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const key=s=>norm(s).replace(/\s+/g,'-');
const arr=v=>Array.isArray(v)?v:[];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const read=async(p,f)=>{try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return f;}};

const golden=await read(GOLDEN,{items:[]});
const suppliers=await read(SUPPLIERS,{products:[]});
const sales=await read(SALES,{items:[]});
const observations=await read(OBS,{products:{}});
const market=await read(MARKET,{products:[]});
const freight=await read(FREIGHT,{modes:[]});
const rows=[];

for(const g of arr(golden.items).filter(x=>x.stage==='FINALIST')){
  const canonical=key(g.name);
  const sp=arr(suppliers.products).find(x=>key(x.canonicalKey||x.title)===canonical)||null;
  const se=arr(sales.items).find(x=>key(x.productCanonicalKey)===canonical)||null;
  const obs=observations.products?.[norm(g.name)]||{};
  const offers=arr(obs?.romaniaPricing?.offers).filter(x=>num(x.priceRon)>0);
  const prices=offers.map(x=>num(x.priceRon)).sort((a,b)=>a-b);
  const marketProduct=arr(market.products).find(x=>norm(x.name)===norm(g.name))||{};
  const supplierLeader=sp?.bestScreeningCandidate||null;
  const ceilingPath=`data/screening-economics/${canonical}-quantity-freight-ceiling-2026-09-06.json`;
  const ceilings=await read(ceilingPath,null);
  const scenario49=arr(ceilings?.scenarios).filter(x=>Number(x.sellPriceGrossRon)===49.99);
  const scenario44=arr(ceilings?.scenarios).filter(x=>Number(x.sellPriceGrossRon)===44.74);
  const modes=arr(freight.modes).map(x=>({id:x.id,mode:x.mode,knownMinimumFreightRon:num(x.knownMinimumFreightRon),sourceClass:x.sourceClass,sourceUrl:x.sourceUrl})).filter(x=>num(x.knownMinimumFreightRon)!==null);

  const quantityScreens={};
  for(const s of [...scenario44,...scenario49]){
    const q=Number(s.quantity);
    const price=Number(s.sellPriceGrossRon);
    const k=`${price.toFixed(2)}@${q}`;
    quantityScreens[k]=freightModeViabilityV1({freightCeilingRon:s.maxFreightTotalRon,modes});
  }

  const blockers=[];
  if(!supplierLeader)blockers.push('DIRECT_SUPPLIER_PAGE_EVIDENCE_REQUIRED');
  if(!se||se.status!=='ESTIMATED_HIGH_CONFIDENCE')blockers.push('HIGH_CONFIDENCE_SALES_ESTIMATE_REQUIRED');
  blockers.push('EXACT_CN_TARIC_CLASSIFICATION_REQUIRED');
  blockers.push('FULLY_LOADED_FREIGHT_OR_FORWARDER_COST_REQUIRED');
  blockers.push('BROKERAGE_DESTINATION_HANDLING_LOCAL_DELIVERY_REQUIRED');
  blockers.push('CONFIRMED_LANDED_COST_REQUIRED');

  rows.push({
    canonicalKey:canonical,
    title:g.name,
    category:g.cat,
    goldenRank:g.rank,
    goldenStage:g.stage,
    status:'FINALIST_LANDED_ECONOMICS_SCREENING',
    romaniaPricing:{
      verifiedOfferCount:offers.length,
      observedPricesRon:prices,
      minRon:prices[0]??null,
      medianRon:prices.length?prices[Math.floor(prices.length/2)]:null,
      maxRon:prices.at(-1)??null
    },
    supplierPage:{
      leader:supplierLeader?.supplierName||null,
      directProductUrl:supplierLeader?.sourceUrl||null,
      conservativeUnitPriceUsd:supplierLeader?.conservativeScreeningUnitPriceUsd??null,
      publicMoq:supplierLeader?.publicMoq??null,
      evidenceClass:supplierLeader?.evidenceClass||null,
      contactRequired:false,
      ranking:sp?.supplierPageRanking||null
    },
    salesEstimate:se?{
      status:se.status,
      confidence:se.confidence,
      estimatedUnits30d:se.estimatedUnits30d,
      rangeLow:se.rangeLow,
      rangeHigh:se.rangeHigh,
      method:se.method,
      verifiedCompetitorSales:false,
      sourceProvider:se.sourceProvider
    }:null,
    currentMarketSignals:{
      romaniaDemandStatus:g.romaniaDemandStatus,
      evidenceReady:g.evidenceReady,
      commercialReadiness:g.commercialReadiness,
      dataConfidence:g.confidence,
      trend:g.historicalDirection
    },
    importPolicy:{
      market:'RO',
      vatRatePct:21,
      importRegime:'B2B_STOCK_IMPORT',
      customsDutyStatus:'UNKNOWN_PENDING_CN_TARIC'
    },
    quantityFreightScreens:quantityScreens,
    preferredAutonomousFocus:'SEA_LCL_AT_LARGER_LOT_OR_OTHER_LOW_COST_CONSOLIDATED_FORWARDER',
    blockers,
    testReady:false,
    buyReady:false,
    supplierContactRequired:false,
    purchaseAuthorized:false,
    policy:'FINALIST packet consolidates screening evidence only. Page-backed supplier sourcing and high-confidence estimated demand may advance FINALIST, but TEST requires independent confirmed landed cost. Unknown customs/freight/import costs never become zero.'
  });
}

const out={
  schemaVersion:'MPR_FINALIST_ECONOMICS_LIVE_V1',
  updatedAt:new Date().toISOString(),
  finalists:rows.length,
  testReady:rows.filter(x=>x.testReady).length,
  items:rows,
  supplierOutreachEnabled:false,
  purchaseAuthorized:false,
  policy:'One evidence packet per FINALIST. No supplier outreach. No purchase authority. TEST requires confirmed landed economics.'
};
await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Finalist Economics: ${rows.length} finalist packets · TEST ready ${out.testReady}.`);
