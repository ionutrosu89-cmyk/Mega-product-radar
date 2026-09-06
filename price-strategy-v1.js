import {freightCeilingV1} from './freight-ceiling-v1.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function priceStrategyV1({
  quantity,
  goodsCostPerUnitRon,
  observedPricesRon=[],
  allocatedFreightTotalRon=null,
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45},
  stretchPricesRon=[],
  marketRangeMinRon=null,
  marketRangeMaxRon=null
}={}){
  const observed=(Array.isArray(observedPricesRon)?observedPricesRon:[]).filter(finite).map(Number).sort((a,b)=>a-b);
  const stretch=(Array.isArray(stretchPricesRon)?stretchPricesRon:[]).filter(finite).map(Number);
  const prices=[...new Set([...observed,...stretch])].sort((a,b)=>a-b);
  const rangeMin=finite(marketRangeMinRon)?Number(marketRangeMinRon):(observed.length?Math.min(...observed):null);
  const rangeMax=finite(marketRangeMaxRon)?Number(marketRangeMaxRon):(observed.length?Math.max(...observed):null);
  const rows=prices.map(price=>{
    const ceiling=freightCeilingV1({
      quantity,goodsCostPerUnitRon,sellPriceGrossRon:price,sellerSettings,
      minMarginPct:target.minMarginPct,minRoiPct:target.minRoiPct
    });
    const freight=finite(allocatedFreightTotalRon)?Number(allocatedFreightTotalRon):null;
    const remaining=ceiling.maxEligibleFreightTotalRon===null||freight===null?null:ceiling.maxEligibleFreightTotalRon-freight;
    const perUnit=remaining===null?null:remaining/Number(quantity);
    const baseStatus=!ceiling.currentPriceEligibleBeforeFreight?'REJECT_PRICE_BEFORE_FREIGHT':remaining!==null&&remaining<0?'REJECT_AFTER_ALLOCATED_FREIGHT':'SCREENING_CANDIDATE';
    const exactObserved=observed.includes(price);
    const insideObservedRange=rangeMin!==null&&rangeMax!==null&&price>=rangeMin&&price<=rangeMax;
    const marketRangeScenario=!exactObserved&&insideObservedRange;
    const robustness=baseStatus!=='SCREENING_CANDIDATE'?'NOT_APPLICABLE'
      :perUnit===null?'UNKNOWN_IMPORT_BUFFER'
      :exactObserved?(perUnit<0.5?'VERY_TIGHT_UNKNOWN_COST_BUFFER':perUnit<1.5?'TIGHT_UNKNOWN_COST_BUFFER':'HEALTHY_SCREENING_BUFFER')
      :marketRangeScenario?(perUnit<0.5?'VERY_TIGHT_MARKET_RANGE_BUFFER':perUnit<1.5?'TIGHT_MARKET_RANGE_BUFFER':'HEALTHY_MARKET_RANGE_SCREENING_BUFFER')
      :'STRETCH_PRICE_REQUIRES_MARKET_VALIDATION';
    return Object.freeze({
      sellPriceGrossRon:price,
      observedMarketPrice:exactObserved,
      marketRangeScenario,
      insideObservedMarketRange:insideObservedRange,
      stretchScenario:!exactObserved&&!insideObservedRange,
      goodsOnlyEligible:ceiling.currentPriceEligibleBeforeFreight,
      maxAdditionalLandedHeadroomRon:ceiling.maxEligibleFreightTotalRon,
      allocatedFreightTotalRon:freight,
      remainingImportCostAllowanceRon:remaining===null?null:round(remaining),
      remainingImportCostAllowancePerUnitRon:perUnit===null?null:round(perUnit),
      status:baseStatus,
      robustness
    });
  });
  const observedCandidates=rows.filter(x=>x.observedMarketPrice&&x.status==='SCREENING_CANDIDATE'&&x.remainingImportCostAllowanceRon>0);
  const healthyObserved=observedCandidates.filter(x=>x.robustness==='HEALTHY_SCREENING_BUFFER').sort((a,b)=>a.sellPriceGrossRon-b.sellPriceGrossRon)[0]||null;
  const marketRangeCandidates=rows.filter(x=>x.marketRangeScenario&&x.status==='SCREENING_CANDIDATE'&&x.remainingImportCostAllowanceRon>0);
  const healthyMarketRange=marketRangeCandidates.filter(x=>x.robustness==='HEALTHY_MARKET_RANGE_SCREENING_BUFFER').sort((a,b)=>a.sellPriceGrossRon-b.sellPriceGrossRon)[0]||null;
  const bestObserved=observedCandidates.sort((a,b)=>b.remainingImportCostAllowanceRon-a.remainingImportCostAllowanceRon)[0]||null;
  const fallback=rows.filter(x=>x.status==='SCREENING_CANDIDATE'&&x.remainingImportCostAllowanceRon>0).sort((a,b)=>a.sellPriceGrossRon-b.sellPriceGrossRon)[0]||null;
  const recommended=healthyObserved||healthyMarketRange||bestObserved||fallback;
  return Object.freeze({
    schemaVersion:'MPR_PRICE_STRATEGY_V1',
    status:recommended?'SCREENING_PRICE_AVAILABLE':'NO_ELIGIBLE_PRICE',
    primaryPrice:recommended,
    recommendedEvidenceClass:recommended?.observedMarketPrice?'EXACT_OBSERVED_MARKET_PRICE':recommended?.marketRangeScenario?'MARKET_RANGE_SCENARIO_NOT_EXACT_OFFER':recommended?'STRETCH_SCENARIO':'NONE',
    observedMarketRange:rangeMin!==null&&rangeMax!==null?Object.freeze({minRon:rangeMin,maxRon:rangeMax}):null,
    scenarios:Object.freeze(rows),
    purchaseAuthorized:false,
    policy:'Prefer a healthy exact observed price. If exact observed prices are too tight, a price inside the current high-match observed market range may be used as a screening scenario, explicitly marked as not an exact observed offer. Prices outside the observed range remain stretch scenarios.'
  });
}
