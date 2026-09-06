import fs from 'node:fs/promises';
import path from 'node:path';
import {freightModeViabilityV1} from '../freight-mode-viability-v1.js';
import {freightCeilingV1} from '../freight-ceiling-v1.js';
import {priceStrategyV1} from '../price-strategy-v1.js';
import {finalistTestGateV1} from '../finalist-test-gate-v1.js';
import {importCostStressV1} from '../import-cost-stress-v1.js';
import {shipmentFixedCostStressV1} from '../shipment-fixed-cost-stress-v1.js';
import {lclScreeningRangeV1,localChargeScopeGuardV1} from '../lcl-local-charge-guard-v1.js';
import {conservativeLandedEnvelopeV1} from '../conservative-landed-envelope-v1.js';
import {residualLocalCostCeilingV1} from '../residual-local-cost-ceiling-v1.js';
import {customsDutySensitivityV1} from '../customs-duty-sensitivity-v1.js';
import {finalistScreeningVerdictV1} from '../finalist-screening-verdict-v1.js';
import {customsRepresentationHeadroomV1} from '../customs-representation-headroom-v1.js';

const GOLDEN='golden-pipeline-live.json';
const SUPPLIERS='supplier-page-evidence-live.json';
const SALES='public-sales-estimation-live.json';
const OBS='commercial-observations.json';
const MARKET='market-intelligence-live.json';
const OUT='finalist-economics-live.json';
const FREIGHT='data/freight-benchmarks/china-romania-public-freight-market-2026-09-06.json';
const CONSOLIDATION='consolidation-basket-live.json';
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
  const selectedConsolidation=consolidation?.selected||null;
  const selectedDims=selectedConsolidation?.finalistLogisticsEvidence?.dimensions||null;
  const selectedFinalistMeasure=selectedDims
    ?(Number(selectedDims.lengthCm||0)*Number(selectedDims.widthCm||0)*Number(selectedDims.heightCm||0)/1_000_000)*300
    :null;
  const selectedTotalMeasure=num(selectedConsolidation?.result?.totalMeasure);
  const selectedShipmentBenchmark=num(consolidation?.benchmark1M3Ron);
  const allocatedFreight300=selectedFinalistMeasure&&selectedTotalMeasure&&selectedShipmentBenchmark
    ?selectedShipmentBenchmark*(selectedFinalistMeasure/selectedTotalMeasure)
    :null;
  const consolidatedFinalist=selectedFinalistMeasure?{
    allocatedBenchmarkLogisticsRon:allocatedFreight300,
    allocatedBenchmarkLogisticsPerUnitRon:allocatedFreight300/300,
    measureBasis:'VOLUME_FLOOR',
    canonicalKey:canonical
  }:null;
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
  const finalistBareMeasure=consolidation?.selected?.finalistLogisticsEvidence?.dimensions
    ?(Number(consolidation.selected.finalistLogisticsEvidence.dimensions.lengthCm||0)*Number(consolidation.selected.finalistLogisticsEvidence.dimensions.widthCm||0)*Number(consolidation.selected.finalistLogisticsEvidence.dimensions.heightCm||0)/1_000_000)*300
    :null;
  const conservativeLandedEnvelope=supplierUnitRon===null||!publicLclRange?.historicalAllInBeforeDutyVatRonMax||!num(consolidation?.selected?.result?.totalMeasure)||!finalistBareMeasure?null:conservativeLandedEnvelopeV1({
    quantity:300,
    unitGoodsCostRon:supplierUnitRon,
    skuChargeableMeasure:finalistBareMeasure,
    consolidatedTotalMeasure:num(consolidation.selected.result.totalMeasure),
    shipmentLogisticsBeforeDutyVatRon:publicLclRange.historicalAllInBeforeDutyVatRonMax,
    dutyRateScenariosPct:[3,6.5,10],
    importVatRatePct:21,
    vatRecoverableModes:['RECOVERABLE','NON_RECOVERABLE'],
    sellPricesRon:[44.74,49.99]
  });
  const fclToLclScopeGuard=lclRangeEvidence?.officialRomaniaContainerChargeContext?localChargeScopeGuardV1({
    shipmentMode:'SEA_LCL',
    chargeScope:lclRangeEvidence.officialRomaniaContainerChargeContext.scope,
    unit:'per container',
    explicitLclAllocation:false
  }):null;
  const worstCaseEnvelopeRow=conservativeLandedEnvelope?.rows?.find(x=>x.dutyRateScenarioPct===10&&x.vatTreatment==='NON_RECOVERABLE'&&x.sellPriceGrossRon===49.99)||null;
  const recoverableWorstCaseEnvelopeRow=conservativeLandedEnvelope?.rows?.find(x=>x.dutyRateScenarioPct===10&&x.vatTreatment==='RECOVERABLE'&&x.sellPriceGrossRon===49.99)||null;
  const residualLocalCostCeiling=worstCaseEnvelopeRow?residualLocalCostCeilingV1({
    quantity:300,
    baseEconomicLandedPerUnitRon:worstCaseEnvelopeRow.economicLandedPerUnitRon,
    sellPriceGrossRon:49.99
  }):null;
  const residualLocalCostCeilingRecoverableVat=recoverableWorstCaseEnvelopeRow?residualLocalCostCeilingV1({
    quantity:300,
    baseEconomicLandedPerUnitRon:recoverableWorstCaseEnvelopeRow.economicLandedPerUnitRon,
    sellPriceGrossRon:49.99
  }):null;
  const publicBrokerBenchmarks=arr(importProcessingEvidence?.publicCustomsRepresentationBenchmarks).map(x=>{
    const amount=num(x.primaryDeclarationOneArticleRon)??num(x.clearanceProcessingRon);
    return amount===null?null:{
      provider:x.provider,
      serviceScope:x.serviceScope,
      amountRon:amount,
      applicableDirectlyToSeaLcl:x.applicableDirectlyToSeaLcl===true
    };
  }).filter(Boolean);
  const customsRepresentationHeadroom=residualLocalCostCeiling?customsRepresentationHeadroomV1({
    residualLocalCostCeilingTotalRon:residualLocalCostCeiling.maxAdditionalLocalImportCostTotalRon,
    publicBenchmarks:publicBrokerBenchmarks
  }):null;
  const customsDutySensitivity=supplierUnitRon===null||screeningFreightPerUnit300===null?null:customsDutySensitivityV1({
    quantity:300,
    sellPriceGrossRon:49.99,
    goodsCostPerUnitRon:supplierUnitRon,
    freightPerUnitRon:screeningFreightPerUnit300,
    variableImportCostPerUnitRon:0.5,
    fixedShipmentCostRon:300,
    dutyRateScenariosPct:arr(customs?.dutySensitivityScenariosPct).length?customs.dutySensitivityScenariosPct:[3,6.5,10]
  });
  const worstCaseEnvelopePass=Boolean(worstCaseEnvelopeRow?.passesTargets);
  const screeningVerdict=finalistScreeningVerdictV1({
    stage:g.stage,
    quantity:300,
    screeningPriceRon:num(priceStrategy?.primaryPrice?.sellPriceGrossRon),
    residualLocalCostCeilingPerUnitRon:num(residualLocalCostCeiling?.maxAdditionalLocalImportCostPerUnitRon),
    conservativeWorstCasePass:worstCaseEnvelopePass,
    priceInsideObservedMarketRange:priceStrategy?.primaryPrice?.insideObservedMarketRange===true,
    salesReady:se?.status==='ESTIMATED_HIGH_CONFIDENCE'&&num(se?.confidence)>=75,
    supplierPageReady:Boolean(supplierLeader)
  });
  const recoverableWorstCasePass=Boolean(recoverableWorstCaseEnvelopeRow?.passesTargets);
  const screeningVerdictRecoverableVat=finalistScreeningVerdictV1({
    stage:g.stage,
    quantity:300,
    screeningPriceRon:num(priceStrategy?.primaryPrice?.sellPriceGrossRon),
    residualLocalCostCeilingPerUnitRon:num(residualLocalCostCeilingRecoverableVat?.maxAdditionalLocalImportCostPerUnitRon),
    conservativeWorstCasePass:recoverableWorstCasePass,
    priceInsideObservedMarketRange:priceStrategy?.primaryPrice?.insideObservedMarketRange===true,
    salesReady:se?.status==='ESTIMATED_HIGH_CONFIDENCE'&&num(se?.confidence)>=75,
    supplierPageReady:Boolean(supplierLeader)
  });
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
    conservativeLandedEnvelope,
    residualLocalCostCeiling,
    residualLocalCostCeilingsByVatTreatment:{
      NON_RECOVERABLE:residualLocalCostCeiling,
      RECOVERABLE:residualLocalCostCeilingRecoverableVat
    },
    customsRepresentationHeadroom,
    localChargeScopeGuard:fclToLclScopeGuard,
    importProcessingEvidence:importProcessingEvidence?{
      sourceFile:IMPORT_PROCESSING,
      carrier:importProcessingEvidence.carrier,
      lclLocalChargesStatus:importProcessingEvidence?.lclLocalCharges?.status||'UNKNOWN',
      policy:importProcessingEvidence.policy
    }:null,
    customsDutySensitivity,
    screeningVerdict,
    screeningVerdictsByVatTreatment:{
      NON_RECOVERABLE:screeningVerdict,
      RECOVERABLE:screeningVerdictRecoverableVat
    },
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
