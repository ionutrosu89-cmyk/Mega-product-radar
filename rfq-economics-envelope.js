import {PROFIT_DEFAULTS} from './profit-engine-v2.js';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(n(v)*100)/100;

export function targetCostEnvelope(sellPrice,settings={},thresholds={}){
  const sell=n(sellPrice);
  const s={...PROFIT_DEFAULTS,...settings};
  const minMarginPct=n(thresholds.minMarginPct??20);
  const minRoiPct=n(thresholds.minRoiPct??45);
  if(sell<=0)return{feasible:false,sellPrice:sell,maxLandedCostRon:0,blocker:'INVALID_SELL_PRICE'};

  const vat=sell-(sell/(1+s.vatRate/100));
  const netRevenue=sell-vat;
  const variableRate=(s.marketplaceRate+s.adsRate+s.returnsReserveRate+s.paymentRate+s.warrantyReserveRate)/100;
  const variableCosts=sell*variableRate;
  const fixedCosts=s.fulfillmentPerUnit+s.packagingPerUnit+s.overheadPerUnit;
  const contributionBeforeLanded=netRevenue-variableCosts-fixedCosts;

  const maxByMargin=contributionBeforeLanded-sell*(minMarginPct/100);
  const maxByRoi=contributionBeforeLanded/(1+minRoiPct/100);
  const rawCeiling=Math.min(maxByMargin,maxByRoi);
  const maxLandedCostRon=Math.max(0,rawCeiling);
  const bindingConstraint=maxByMargin<=maxByRoi?'MARGIN':'ROI';

  return{
    version:'1.0',
    feasible:maxLandedCostRon>0,
    sellPrice:round(sell),
    thresholds:{minMarginPct,minRoiPct},
    maxLandedCostRon:round(maxLandedCostRon),
    maxByMarginRon:round(Math.max(0,maxByMargin)),
    maxByRoiRon:round(Math.max(0,maxByRoi)),
    bindingConstraint,
    costModel:{vatRate:s.vatRate,marketplaceRate:s.marketplaceRate,adsRate:s.adsRate,returnsReserveRate:s.returnsReserveRate,paymentRate:s.paymentRate,warrantyReserveRate:s.warrantyReserveRate,fulfillmentPerUnit:s.fulfillmentPerUnit,packagingPerUnit:s.packagingPerUnit,overheadPerUnit:s.overheadPerUnit},
    components:{netRevenue:round(netRevenue),variableCosts:round(variableCosts),fixedCosts:round(fixedCosts),contributionBeforeLanded:round(contributionBeforeLanded)},
    policy:'Internal negotiation ceiling only. This is not a supplier quote, not a confirmed landed cost and not permission to TEST or BUY. Confirmed economics still require a complete manually verified quote and real import costs.'
  };
}
