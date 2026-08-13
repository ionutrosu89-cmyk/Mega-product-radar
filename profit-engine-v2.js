const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v)));

export const PROFIT_DEFAULTS={
  vatRate:21,
  marketplaceRate:17,
  adsRate:8,
  returnsReserveRate:4,
  paymentRate:1.2,
  fulfillmentPerUnit:6,
  packagingPerUnit:2.5,
  warrantyReserveRate:1,
  overheadPerUnit:2
};

export function profitEngineV2(p={},settings={}){
  const s={...PROFIT_DEFAULTS,...settings};
  const sell=n(p.sellTarget||p.sell);
  const landed=n(p.confirmedLanded||p.landedEstimate||p.landed);
  const priceComplete=sell>0&&landed>0;
  if(!priceComplete)return{priceComplete:false,sell,landed,netRevenue:0,profit:0,margin:0,roi:0,breakEvenSell:0,costs:{}};
  const vat=sell-(sell/(1+s.vatRate/100));
  const netRevenue=sell-vat;
  const marketplace=sell*s.marketplaceRate/100;
  const ads=sell*s.adsRate/100;
  const returnsReserve=sell*s.returnsReserveRate/100;
  const payment=sell*s.paymentRate/100;
  const warrantyReserve=sell*s.warrantyReserveRate/100;
  const variable=marketplace+ads+returnsReserve+payment+warrantyReserve;
  const fixed=s.fulfillmentPerUnit+s.packagingPerUnit+s.overheadPerUnit;
  const totalCost=landed+variable+fixed;
  const profit=netRevenue-totalCost;
  const margin=sell?profit/sell*100:0;
  const roi=landed?profit/landed*100:0;
  const rate=(1/(1+s.vatRate/100))-(s.marketplaceRate+s.adsRate+s.returnsReserveRate+s.paymentRate+s.warrantyReserveRate)/100;
  const breakEvenSell=rate>0?(landed+fixed)/rate:0;
  const robustness=clamp((margin-12)*2+(roi-25)*.35+(profit-15)*.45);
  return{
    version:'2.0',priceComplete,sell,landed,netRevenue,profit,margin,roi,breakEvenSell,robustness,
    costs:{vat,marketplace,ads,returnsReserve,payment,warrantyReserve,fulfillment:s.fulfillmentPerUnit,packaging:s.packagingPerUnit,overhead:s.overheadPerUnit,totalCost},
    assumptions:s,
    validation:'Commercial estimate using configurable reserves; confirmed supplier, freight and marketplace terms should replace defaults before a large order.'
  };
}
