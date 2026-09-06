import {profitEngineV2,PROFIT_DEFAULTS} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

function economics(sell,landed,settings){
  return profitEngineV2({sellTarget:sell,confirmedLanded:landed},settings);
}

export function freightCeilingV1(input={}){
  const qty=finite(input.quantity)?Math.max(1,Math.round(Number(input.quantity))):null;
  const goodsPerUnit=finite(input.goodsCostPerUnitRon)?Number(input.goodsCostPerUnitRon):null;
  const sell=finite(input.sellPriceGrossRon)?Number(input.sellPriceGrossRon):null;
  const settings={...PROFIT_DEFAULTS,...(input.sellerSettings||{})};
  const minMargin=finite(input.minMarginPct)?Number(input.minMarginPct):20;
  const minRoi=finite(input.minRoiPct)?Number(input.minRoiPct):45;
  const blockers=[];
  if(!qty)blockers.push('QUANTITY_REQUIRED');
  if(goodsPerUnit===null||goodsPerUnit<=0)blockers.push('GOODS_COST_REQUIRED');
  if(sell===null||sell<=0)blockers.push('SELL_PRICE_REQUIRED');
  if(blockers.length)return Object.freeze({schemaVersion:'MPR_FREIGHT_CEILING_V1',status:'UNKNOWN',blockers:Object.freeze(blockers)});

  const goodsOnly=economics(sell,goodsPerUnit,settings);
  let maxLanded=null;
  for(let landed=0.01;landed<=Math.max(1000,sell*3);landed+=0.01){
    const e=economics(sell,landed,settings);
    if(e.priceComplete&&e.profit>0&&e.margin>=minMargin&&e.roi>=minRoi)maxLanded=landed;
    else if(maxLanded!==null&&landed>maxLanded+1)break;
  }
  const maxFreightTotal=maxLanded===null?null:(maxLanded-goodsPerUnit)*qty;

  let minSell=null;
  for(let price=0.01;price<=Math.max(1000,sell*5);price+=0.01){
    const e=economics(price,goodsPerUnit,settings);
    if(e.priceComplete&&e.profit>0&&e.margin>=minMargin&&e.roi>=minRoi){minSell=price;break;}
  }

  return Object.freeze({
    schemaVersion:'MPR_FREIGHT_CEILING_V1',
    status:'CALCULATED',
    quantity:qty,
    goodsCostPerUnitRon:round(goodsPerUnit),
    sellPriceGrossRon:round(sell),
    goodsOnlyEconomics:Object.freeze({profit:round(goodsOnly.profit),marginPct:round(goodsOnly.margin),roiPct:round(goodsOnly.roi)}),
    target:Object.freeze({minMarginPct:minMargin,minRoiPct:minRoi}),
    maxEligibleLandedPerUnitRon:maxLanded===null?null:round(maxLanded),
    maxEligibleFreightTotalRon:maxFreightTotal===null?null:round(maxFreightTotal),
    minimumSellPriceGrossAtGoodsOnlyRon:minSell===null?null:round(minSell),
    currentPriceEligibleBeforeFreight:Boolean(maxFreightTotal!==null&&maxFreightTotal>=0),
    decision:maxFreightTotal===null||maxFreightTotal<0?'CURRENT_PRICE_TOO_LOW_BEFORE_FREIGHT':'FREIGHT_CEILING_AVAILABLE',
    purchaseAuthorized:false,
    policy:'Freight ceiling is a derived maximum under explicitly configured seller economics. Customs/brokerage/import costs are not assumed zero for final landed cost; they are excluded here only to measure the theoretical freight headroom.'
  });
}
