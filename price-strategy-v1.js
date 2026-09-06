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
  stretchPricesRon=[]
}={}){
  const observed=(Array.isArray(observedPricesRon)?observedPricesRon:[]).filter(finite).map(Number).sort((a,b)=>a-b);
  const stretch=(Array.isArray(stretchPricesRon)?stretchPricesRon:[]).filter(finite).map(Number);
  const prices=[...new Set([...observed,...stretch])].sort((a,b)=>a-b);
  const rows=prices.map(price=>{
    const ceiling=freightCeilingV1({
      quantity,goodsCostPerUnitRon,sellPriceGrossRon:price,sellerSettings,
      minMarginPct:target.minMarginPct,minRoiPct:target.minRoiPct
    });
    const freight=finite(allocatedFreightTotalRon)?Number(allocatedFreightTotalRon):null;
    const remaining=ceiling.maxEligibleFreightTotalRon===null||freight===null?null:ceiling.maxEligibleFreightTotalRon-freight;
    const perUnit=remaining===null?null:remaining/Number(quantity);
    const baseStatus=!ceiling.currentPriceEligibleBeforeFreight?'REJECT_PRICE_BEFORE_FREIGHT':remaining!==null&&remaining<0?'REJECT_AFTER_ALLOCATED_FREIGHT':'SCREENING_CANDIDATE';
    const robustness=baseStatus!=='SCREENING_CANDIDATE'?'NOT_APPLICABLE'
      :!observed.includes(price)?'STRETCH_PRICE_REQUIRES_MARKET_VALIDATION'
      :perUnit===null?'UNKNOWN_IMPORT_BUFFER'
      :perUnit<0.5?'VERY_TIGHT_UNKNOWN_COST_BUFFER'
      :perUnit<1.5?'TIGHT_UNKNOWN_COST_BUFFER'
      :'HEALTHY_SCREENING_BUFFER';
    return Object.freeze({
      sellPriceGrossRon:price,
      observedMarketPrice:observed.includes(price),
      stretchScenario:!observed.includes(price),
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
  const primary=observedCandidates.sort((a,b)=>b.remainingImportCostAllowanceRon-a.remainingImportCostAllowanceRon)[0]||null;
  const fallback=rows.filter(x=>x.status==='SCREENING_CANDIDATE'&&x.remainingImportCostAllowanceRon>0).sort((a,b)=>a.sellPriceGrossRon-b.sellPriceGrossRon)[0]||null;
  return Object.freeze({
    schemaVersion:'MPR_PRICE_STRATEGY_V1',
    status:primary||fallback?'SCREENING_PRICE_AVAILABLE':'NO_ELIGIBLE_PRICE',
    primaryPrice:primary||fallback,
    scenarios:Object.freeze(rows),
    purchaseAuthorized:false,
    policy:'Prefer verified observed-market prices, but expose robustness separately. A mathematically positive price with a very small unknown-import-cost buffer is not commercially robust. Stretch prices remain scenario-only until market evidence exists.'
  });
}
