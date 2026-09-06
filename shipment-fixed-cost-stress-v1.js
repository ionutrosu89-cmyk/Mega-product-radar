import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function shipmentFixedCostStressV1({
  quantities=[30,50,100,300],
  sellPricesRon=[],
  goodsCostPerUnitRon,
  screeningFreightPerUnitRon,
  variableUnknownImportCostPerUnitRon=0,
  fixedShipmentCostScenariosRon=[50,100,200,300,500],
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45}
}={}){
  const goods=finite(goodsCostPerUnitRon)?Number(goodsCostPerUnitRon):null;
  const freight=finite(screeningFreightPerUnitRon)?Number(screeningFreightPerUnitRon):null;
  if(goods===null||freight===null)return Object.freeze({schemaVersion:'MPR_SHIPMENT_FIXED_COST_STRESS_V1',status:'UNKNOWN',blockers:Object.freeze(['GOODS_AND_SCREENING_FREIGHT_REQUIRED'])});
  const variable=finite(variableUnknownImportCostPerUnitRon)?Number(variableUnknownImportCostPerUnitRon):0;
  const rows=[];
  for(const q0 of quantities){
    const quantity=Math.max(1,Math.round(Number(q0)||1));
    for(const price0 of sellPricesRon){
      const price=Number(price0);
      if(!finite(price)||price<=0)continue;
      for(const fixed0 of fixedShipmentCostScenariosRon){
        const fixed=Number(fixed0);
        if(!finite(fixed)||fixed<0)continue;
        const fixedPerUnit=fixed/quantity;
        const landed=goods+freight+variable+fixedPerUnit;
        const e=profitEngineV2({sellTarget:price,confirmedLanded:landed},sellerSettings);
        const pass=e.priceComplete&&e.profit>0&&e.margin>=Number(target.minMarginPct??20)&&e.roi>=Number(target.minRoiPct??45);
        rows.push(Object.freeze({
          quantity,
          sellPriceGrossRon:round(price),
          fixedShipmentCostScenarioRon:round(fixed),
          fixedCostPerUnitRon:round(fixedPerUnit,4),
          variableUnknownImportCostPerUnitRon:round(variable,4),
          screeningLandedPerUnitRon:round(landed,4),
          profitPerUnitRon:round(e.profit),
          marginPct:round(e.margin),
          roiPct:round(e.roi),
          passesTargets:pass,
          truth:'HYPOTHETICAL_FIXED_SHIPMENT_COST_STRESS'
        }));
      }
    }
  }
  const maxFixedPassing={};
  for(const q0 of quantities){
    const q=Number(q0); maxFixedPassing[String(q)]={};
    for(const p0 of sellPricesRon){
      const p=Number(p0);
      const best=rows.filter(x=>x.quantity===q&&x.sellPriceGrossRon===p&&x.passesTargets).sort((a,b)=>b.fixedShipmentCostScenarioRon-a.fixedShipmentCostScenarioRon)[0]||null;
      maxFixedPassing[String(q)][String(p)]=best?{
        maxFixedShipmentCostScenarioRon:best.fixedShipmentCostScenarioRon,
        fixedCostPerUnitRon:best.fixedCostPerUnitRon,
        marginPct:best.marginPct,
        roiPct:best.roiPct,
        profitPerUnitRon:best.profitPerUnitRon
      }:null;
    }
  }
  return Object.freeze({
    schemaVersion:'MPR_SHIPMENT_FIXED_COST_STRESS_V1',
    status:'CALCULATED_SCREENING',
    variableUnknownImportCostPerUnitRon:round(variable,4),
    rows:Object.freeze(rows),
    maxFixedPassingByQuantityPrice:Object.freeze(maxFixedPassing),
    purchaseAuthorized:false,
    policy:'Fixed shipment charges are hypothetical stress scenarios, not quotes. This module measures dilution by quantity and never replaces actual brokerage, CFS, documentation or local delivery evidence.'
  });
}
