import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function residualLocalCostCeilingV1({
  quantity,
  baseEconomicLandedPerUnitRon,
  sellPriceGrossRon,
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45},
  searchMaxPerUnitRon=20
}={}){
  const q=Math.max(0,Math.round(Number(quantity)||0));
  const base=finite(baseEconomicLandedPerUnitRon)?Number(baseEconomicLandedPerUnitRon):null;
  const sell=finite(sellPriceGrossRon)?Number(sellPriceGrossRon):null;
  if(!q||base===null||sell===null)return Object.freeze({schemaVersion:'MPR_RESIDUAL_LOCAL_COST_CEILING_V1',status:'UNKNOWN'});
  let max=0,last=null;
  for(let extra=0;extra<=Number(searchMaxPerUnitRon);extra+=0.01){
    const e=profitEngineV2({sellTarget:sell,confirmedLanded:base+extra},sellerSettings);
    const pass=e.priceComplete&&e.profit>0&&e.margin>=Number(target.minMarginPct??20)&&e.roi>=Number(target.minRoiPct??45);
    if(pass){max=extra;last=e;} else if(extra>max+0.05)break;
  }
  return Object.freeze({
    schemaVersion:'MPR_RESIDUAL_LOCAL_COST_CEILING_V1',
    status:'CALCULATED_SCREENING',
    quantity:q,
    baseEconomicLandedPerUnitRon:round(base,4),
    sellPriceGrossRon:round(sell),
    maxAdditionalLocalImportCostPerUnitRon:round(max),
    maxAdditionalLocalImportCostTotalRon:round(max*q),
    economicsAtCeiling:last?Object.freeze({profitPerUnitRon:round(last.profit),marginPct:round(last.margin),roiPct:round(last.roi)}):null,
    purchaseAuthorized:false,
    policy:'This is the remaining economic headroom for still-unknown local import charges after the selected screening envelope. It is not an assumed local charge and never confirms landed cost.'
  });
}
