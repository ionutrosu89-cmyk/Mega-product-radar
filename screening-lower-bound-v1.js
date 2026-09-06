import {profitEngineV2,PROFIT_DEFAULTS} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function screeningLowerBoundV1(input={}){
  const blockers=[];
  const qty=finite(input.quantity)?Math.max(0,Math.round(Number(input.quantity))):0;
  const unitForeign=finite(input.publicUnitPriceForeign)?Number(input.publicUnitPriceForeign):null;
  const fx=finite(input.fxToRon)?Number(input.fxToRon):null;
  const freightFloor=finite(input.freightKnownFloorRon)?Number(input.freightKnownFloorRon):null;
  const sell=finite(input.sellPriceGrossRon)?Number(input.sellPriceGrossRon):null;
  if(!qty)blockers.push('QUANTITY_REQUIRED');
  if(unitForeign===null||unitForeign<=0)blockers.push('PUBLIC_UNIT_PRICE_REQUIRED');
  if(fx===null||fx<=0)blockers.push('FX_REQUIRED');
  if(freightFloor===null||freightFloor<0)blockers.push('FREIGHT_FLOOR_REQUIRED');
  if(sell===null||sell<=0)blockers.push('SELL_PRICE_REQUIRED');
  if(blockers.length)return Object.freeze({schemaVersion:'MPR_SCREENING_LOWER_BOUND_V1',status:'UNKNOWN',blockers:Object.freeze(blockers),decision:null});

  const goodsRon=qty*unitForeign*fx;
  const landedFloorTotalRon=goodsRon+freightFloor;
  const landedFloorPerUnitRon=landedFloorTotalRon/qty;
  const settings={...PROFIT_DEFAULTS,...(input.sellerSettings||{})};
  const economics=profitEngineV2({sellTarget:sell,confirmedLanded:landedFloorPerUnitRon},settings);
  const impossible=economics.priceComplete&&economics.profit<=0;

  return Object.freeze({
    schemaVersion:'MPR_SCREENING_LOWER_BOUND_V1',
    status:'CALCULATED_LOWER_BOUND',
    quantity:qty,
    publicUnitPriceForeign:unitForeign,
    fxToRon:fx,
    goodsRon:round(goodsRon),
    freightKnownFloorRon:round(freightFloor),
    landedFloorTotalRon:round(landedFloorTotalRon),
    landedFloorPerUnitRon:round(landedFloorPerUnitRon),
    sellPriceGrossRon:sell,
    profitUpperBoundPerUnitRon:round(economics.profit),
    marginUpperBoundPct:round(economics.margin),
    roiUpperBoundPct:round(economics.roi),
    decision:impossible?'REJECT_TRANSPORT_METHOD_AT_CURRENT_PRICE':'POTENTIALLY_FEASIBLE_MORE_COSTS_REQUIRED',
    unknownPositiveCostsExcluded:Object.freeze(['customsDuty','importVATCostIfNonRecoverable','brokerage','unknownFuelSurcharge','unknownCarrierSurcharges','localDelivery']),
    purchaseAuthorized:false,
    policy:'This is a mathematical best-case lower bound, not landed cost. Unknown positive costs are excluded only to prove impossibility. Negative profit at this floor safely rejects the transport method; positive profit never proves viability.'
  });
}
