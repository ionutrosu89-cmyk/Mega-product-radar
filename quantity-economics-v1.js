import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const pickTier=(tiers=[],qty)=>{
  const valid=(Array.isArray(tiers)?tiers:[]).filter(x=>finite(x.minQty)&&Number(x.minQty)<=qty&&finite(x.unitPriceRon)&&Number(x.unitPriceRon)>0).sort((a,b)=>Number(b.minQty)-Number(a.minQty));
  return valid[0]||null;
};
const pickFreight=(rows=[],qty)=>{
  const exact=(Array.isArray(rows)?rows:[]).filter(x=>Number(x.quantity)===qty&&finite(x.totalFreightRon)&&Number(x.totalFreightRon)>=0&&x.verified===true);
  return exact.sort((a,b)=>Number(a.totalFreightRon)-Number(b.totalFreightRon))[0]||null;
};

export function analyzeQuantityEconomics({
  quantities=[30,50,100,300],
  supplierPriceTiers=[],
  freightByQuantity=[],
  customsDutyRate=null,
  importVatRate=0.21,
  importVatRecoverable=false,
  brokerageByQuantity=[],
  otherImportCostPerUnitRon=0,
  sellPriceGrossRon=null,
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45}
}={}){
  const rows=(Array.isArray(quantities)?quantities:[]).map(rawQty=>{
    const qty=Math.max(0,Math.round(Number(rawQty)||0));
    const tier=pickTier(supplierPriceTiers,qty),freight=pickFreight(freightByQuantity,qty);
    const brokerage=(Array.isArray(brokerageByQuantity)?brokerageByQuantity:[]).find(x=>Number(x.quantity)===qty&&finite(x.totalRon)&&x.verified===true)||null;
    const blockers=[];
    if(!qty)blockers.push('INVALID_QUANTITY');
    if(!tier)blockers.push('VERIFIED_SUPPLIER_PRICE_TIER_MISSING');
    if(!freight)blockers.push('VERIFIED_FREIGHT_FOR_QUANTITY_MISSING');
    if(!finite(customsDutyRate)||Number(customsDutyRate)<0)blockers.push('CUSTOMS_DUTY_RATE_REQUIRED');
    if(!finite(importVatRate)||Number(importVatRate)<0)blockers.push('IMPORT_VAT_RATE_REQUIRED');
    if(!finite(sellPriceGrossRon)||Number(sellPriceGrossRon)<=0)blockers.push('SELL_PRICE_REQUIRED');
    if(blockers.length)return Object.freeze({quantity:qty,status:'UNKNOWN',blockers});
    const goods=qty*Number(tier.unitPriceRon),freightTotal=Number(freight.totalFreightRon);
    const customsValue=goods+freightTotal;
    const duty=customsValue*Number(customsDutyRate);
    const broker=brokerage?Number(brokerage.totalRon):0;
    const vatBase=customsValue+duty+broker;
    const importVat=vatBase*Number(importVatRate);
    const cashTotal=goods+freightTotal+duty+broker+importVat+qty*Number(otherImportCostPerUnitRon||0);
    const economicTotal=cashTotal-(importVatRecoverable?importVat:0);
    const landedPerUnit=economicTotal/qty;
    const profit=profitEngineV2({sellTarget:Number(sellPriceGrossRon),confirmedLanded:landedPerUnit},sellerSettings);
    const margin=profit.priceComplete?profit.margin:null,roi=profit.priceComplete?profit.roi:null;
    const passes=profit.priceComplete&&margin>=Number(target.minMarginPct??20)&&roi>=Number(target.minRoiPct??45)&&profit.profit>0;
    return Object.freeze({
      quantity:qty,status:'CALCULATED',passesTargets:passes,
      supplierTierMinQty:Number(tier.minQty),supplierUnitPriceRon:round(tier.unitPriceRon),
      freightTotalRon:round(freightTotal),freightPerUnitRon:round(freightTotal/qty),
      customsDutyRon:round(duty),importVatRon:round(importVat),cashTotalRon:round(cashTotal),
      landedCostPerUnitRon:round(landedPerUnit),cashLandedPerUnitRon:round(cashTotal/qty),
      profitPerUnitRon:round(profit.profit),marginPct:round(margin),roiPct:round(roi),
      breakEvenSellPriceRon:round(profit.breakEvenSell),
      capitalRequiredRon:round(cashTotal),
      evidence:{supplierTierRef:tier.evidenceRef||null,freightRef:freight.evidenceRef||null,brokerageRef:brokerage?.evidenceRef||null}
    });
  });
  const calculated=rows.filter(x=>x.status==='CALCULATED');
  const passing=calculated.filter(x=>x.passesTargets);
  const bestRoi=passing.slice().sort((a,b)=>b.roiPct-a.roiPct||a.capitalRequiredRon-b.capitalRequiredRon)[0]||null;
  const lowestCapitalPassing=passing.slice().sort((a,b)=>a.capitalRequiredRon-b.capitalRequiredRon||b.roiPct-a.roiPct)[0]||null;
  return Object.freeze({
    schemaVersion:'MPR_QUANTITY_ECONOMICS_V1',
    status:calculated.length?'CALCULATED':'UNKNOWN_FAIL_CLOSED',
    rows:Object.freeze(rows),
    bestRoiQuantity:bestRoi?.quantity??null,
    lowestCapitalPassingQuantity:lowestCapitalPassing?.quantity??null,
    recommendation:lowestCapitalPassing?Object.freeze({quantity:lowestCapitalPassing.quantity,reason:'LOWEST_CAPITAL_THAT_MEETS_MARGIN_AND_ROI_TARGETS'}):null,
    policy:'Quantity optimization is derived economics, not purchase authority. A quantity is recommendable only when its supplier tier, freight, customs and selling economics are evidence-backed.'
  });
}
