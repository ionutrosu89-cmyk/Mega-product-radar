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
    return Object.freeze({
      sellPriceGrossRon:price,
      observedMarketPrice:observed.includes(price),
      stretchScenario:!observed.includes(price),
      goodsOnlyEligible:ceiling.currentPriceEligibleBeforeFreight,
      maxAdditionalLandedHeadroomRon:ceiling.maxEligibleFreightTotalRon,
      allocatedFreightTotalRon:freight,
      remainingImportCostAllowanceRon:remaining===null?null:round(remaining),
      remainingImportCostAllowancePerUnitRon:remaining===null?null:round(remaining/Number(quantity)),
      status:!ceiling.currentPriceEligibleBeforeFreight?'REJECT_PRICE_BEFORE_FREIGHT':remaining!==null&&remaining<0?'REJECT_AFTER_ALLOCATED_FREIGHT':'SCREENING_CANDIDATE'
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
    policy:'Prefer a verified observed-market price that leaves positive landed-cost allowance. Stretch prices are scenario-only and never become recommended prices without market evidence.'
  });
}
