import fs from 'node:fs/promises';
import path from 'node:path';
import {freightModeViabilityV1} from '../freight-mode-viability-v1.js';
import {freightCeilingV1} from '../freight-ceiling-v1.js';
import {priceStrategyV1} from '../price-strategy-v1.js';
import {finalistTestGateV1} from '../finalist-test-gate-v1.js';
import {importCostStressV1} from '../import-cost-stress-v1.js';
import {shipmentFixedCostStressV1} from '../shipment-fixed-cost-stress-v1.js';
import {lclScreeningRangeV1,localChargeScopeGuardV1} from '../lcl-local-charge-guard-v1.js';

const GOLDEN='golden-pipeline-live.json';
const SUPPLIERS='supplier-page-evidence-live.json';
const SALES='public-sales-estimation-live.json';
const OBS='commercial-observations.json';
const MARKET='market-intelligence-live.json';
const OUT='finalist-economics-live.json';
const FREIGHT='data/freight-benchmarks/china-romania-public-freight-market-2026-09-06.json';
const CONSOLIDATION='data/consolidation/current-multi-sku-basket-2026-09-06.json';
const CUSTOMS_DIR='data/customs-classification';
const LCL_RANGE='data/freight-benchmarks/china-romania-lcl-public-range-2026-09-06.json';
const IMPORT_PROCESSING='data/import-processing/romania-public-import-processing-2026-09-06.json';
const ROMANIA_PRICE_DIR='data/romania-pricing';
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
const consolidation=await read(CONSOLIDATION,null);
const lclRangeEvidence=await read(LCL_RANGE,null);
const importProcessingEvidence=await read(IMPORT_PROCESSING,null);
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
  const modes=arr(freight.modes).map(x=>({id:x.id,mode:x.mode,knownMinimumFreightRon:num(x.knownMinimumFreightRon),sourceClass:x.sourceClass,sourceUrl:x.sourceUrl})).filter(x=>num(x.knownMinimumFreightRon)!==null);
  const supplierUnitUsd=num(supplierLeader?.conservativeScreeningUnitPriceUsd);
  const fxUsdRon=4.5199;
  const supplierUnitRon=supplierUnitUsd===null?null:supplierUnitUsd*fxUsdRon;
  const quantityScreens={};
  const freightCeilings=[];
  if(supplierUnitRon!==null){
    for(const price of [44.74,49.99]){
      for(const q of [30,50,100,300]){
        const ceiling=freightCeilingV1({quantity:q,goodsCostPerUnitRon:supplierUnitRon,sellPriceGrossRon:price});
        freightCeilings.push({sellPriceGrossRon:price,quantity:q,maxAdditionalLandedHeadroomRon:ceiling.maxEligibleFreightTotalRon,minimumSellPriceGrossAtGoodsOnlyRon:ceiling.minimumSellPriceGrossAtGoodsOnlyRon,status:ceiling.decision});
        const k=`${price.toFixed(2)}@${q}`;
        quantityScreens[k]=freightModeViabilityV1({freightCeilingRon:ceiling.maxEligibleFreightTotalRon,modes});
      }
    }
  }

  const customs=await read(`${CUSTOMS_DIR}/${canonical}-2026-09-06.json`,null);
  const consolidatedFinalist=arr(consolidation?.items).find(x=>key(x.canonicalKey)===canonical)||null;
  const allocatedFreight300=num(consolidatedFinalist?.allocatedBenchmarkLogisticsRon);
  const currentPriceEvidence=await read(`${ROMANIA_PRICE_DIR}/${canonical}-2026-09-06.json`,null);
  const currentHighMatchPrices=arr(currentPriceEvidence?.exactOrHighMatchOffers).map(x=>num(x.priceRon)).filter(x=>x!==null);
  const observedPriceList=[...new Set([...prices,...currentHighMatchPrices])].sort((a,b)=>a-b);
  const priceStrategy=supplierUnitRon===null?null:priceStrategyV1({
    quantity:300,
    goodsCostPerUnitRon:supplierUnitRon,
    observedPricesRon:observedPriceList,
    allocatedFreightTotalRon:allocatedFreight300,
    stretchPricesRon:[49.99],
    marketRangeMinRon:num(currentPriceEvidence?.highMatchObservedMinRon),
    marketRangeMaxRon:num(currentPriceEvidence?.highMatchObservedMaxRon)
  });
  const screeningFreightPerUnit300=allocatedFreight300===null?null:allocatedFreight300/300;
  const importCostStress=supplierUnitRon===null||screeningFreightPerUnit300===null?null:importCostStressV1({
    quantities:[30,50,100,300],
    sellPricesRon:[44.74,49.99],
    goodsCostPerUnitRon:supplierUnitRon,
    screeningFreightPerUnitRon:screeningFreightPerUnit300,
    unknownImportCostPerUnitScenariosRon:[0.1,0.5,1,1.5,2,3]
  });
  const fixedShipmentCostStress=supplierUnitRon===null||screeningFreightPerUnit300===null?null:shipmentFixedCostStressV1({
    quantities:[30,50,100,300],
    sellPricesRon:[44.74,49.99],
    goodsCostPerUnitRon:supplierUnitRon,
    screeningFreightPerUnitRon:screeningFreightPerUnit300,
    variableUnknownImportCostPerUnitRon:0.5,
    fixedShipmentCostScenariosRon:[50,100,200,300,500,750,1000]
  });
  const publicLclRange=lclRangeEvidence?lclScreeningRangeV1({
    usdRon:fxUsdRon,
    sources:[
      {
        lclSeaFreightUsdPerCbmMin:num(lclRangeEvidence?.sources?.[0]?.lclSeaFreightUsdPerCbmMin),
        lclSeaFreightUsdPerCbmMax:num(lclRangeEvidence?.sources?.[0]?.lclSeaFreightUsdPerCbmMax)
      },
      {
        totalBeforeDutyVatUsd:num(lclRangeEvidence?.sources?.[1]?.oneCbmScenario?.totalBeforeDutyVatUsd)
      }
    ]
  }):null;
  const fclToLclScopeGuard=lclRangeEvidence?.officialRomaniaContainerChargeContext?localChargeScopeGuardV1({
    shipmentMode:'SEA_LCL',
    chargeScope:lclRangeEvidence.officialRomaniaContainerChargeContext.scope,
    unit:'per container',
    explicitLclAllocation:false
  }):null;
  const customsReady=Boolean(customs?.exactCnCode)&&Boolean(customs?.customsDutyRate!==null&&customs?.customsDutyRate!==undefined)&&String(customs?.status||'').startsWith('VERIFIED');
  const testGate=finalistTestGateV1({
    stage:g.stage,
    romaniaDemandReady:['PROVIDER_VERIFIED','MARKET_EVIDENCE_READY'].includes(String(g.romaniaDemandStatus||'')),
    salesStatus:se?.status,
    salesConfidence:se?.confidence,
    supplierPageReady:Boolean(supplierLeader),
    cnCode:customs?.exactCnCode||null,
    taricStatus:customsReady?'VERIFIED':'UNKNOWN',
    customsDutyRateVerified:customsReady,
    freightFullyLoaded:false,
    freightTotalRon:null,
    importCostsReady:false,
    landedCostConfirmed:false,
    landedCostPerUnitRon:null,
    marginPct:null,roiPct:null,profitPerUnitRon:null,
    complianceReady:true
  });

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
      currentHighMatchPricesRon:currentHighMatchPrices,
      combinedObservedPricesRon:observedPriceList,
      minRon:observedPriceList[0]??null,
      medianRon:observedPriceList.length?observedPriceList[Math.floor(observedPriceList.length/2)]:null,
      maxRon:observedPriceList.at(-1)??null,
      currentPriceEvidenceFile:currentPriceEvidence?`${ROMANIA_PRICE_DIR}/${canonical}-2026-09-06.json`:null
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
    freightCeilings,
    quantityFreightScreens:quantityScreens,
    consolidationScreen:consolidatedFinalist?{
      allocatedBenchmarkLogisticsRon:allocatedFreight300,
      allocatedBenchmarkLogisticsPerUnitRon:num(consolidatedFinalist.allocatedBenchmarkLogisticsPerUnitRon),
      measureBasis:consolidatedFinalist.measureBasis,
      sourceFile:CONSOLIDATION,
      status:'SCREENING_ONLY'
    }:null,
    priceStrategy,
    importCostStress,
    fixedShipmentCostStress,
    publicLclRange,
    localChargeScopeGuard:fclToLclScopeGuard,
    importProcessingEvidence:importProcessingEvidence?{
      sourceFile:IMPORT_PROCESSING,
      carrier:importProcessingEvidence.carrier,
      lclLocalChargesStatus:importProcessingEvidence?.lclLocalCharges?.status||'UNKNOWN',
      policy:importProcessingEvidence.policy
    }:null,
    customsClassification:customs?{status:customs.status,exactCnCode:customs.exactCnCode,exactTaricCode:customs.exactTaricCode,customsDutyRate:customs.customsDutyRate,sourceFile:`${CUSTOMS_DIR}/${canonical}-2026-09-06.json`}:null,
    testGate,
    preferredAutonomousFocus:'SEA_LCL_MULTI_SKU_CONSOLIDATION_AND_PUBLIC_IMPORT_COST_EVIDENCE',
    blockers,
    testReady:testGate.testReady,
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
