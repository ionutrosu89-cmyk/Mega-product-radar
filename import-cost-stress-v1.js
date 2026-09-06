import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function importCostStressV1({
  quantities=[30,50,100,300],
  sellPricesRon=[],
  goodsCostPerUnitRon,
  screeningFreightPerUnitRon=null,
  unknownImportCostPerUnitScenariosRon=[0.5,1,2,3],
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45}
}={}){
  const goods=finite(goodsCostPerUnitRon)?Number(goodsCostPerUnitRon):null;
  const freight=finite(screeningFreightPerUnitRon)?Number(screeningFreightPerUnitRon):null;
  if(goods===null||freight===null)return Object.freeze({schemaVersion:'MPR_IMPORT_COST_STRESS_V1',status:'UNKNOWN',blockers:Object.freeze(['GOODS_AND_SCREENING_FREIGHT_REQUIRED'])});
  const rows=[];
  for(const q0 of quantities){
    const quantity=Math.max(1,Math.round(Number(q0)||1));
    for(const price0 of sellPricesRon){
      const price=Number(price0);
      if(!finite(price)||price<=0)continue;
      for(const reserve0 of unknownImportCostPerUnitScenariosRon){
        const reserve=Number(reserve0);
        if(!finite(reserve)||reserve<0)continue;
        const landed=goods+freight+reserve;
        const e=profitEngineV2({sellTarget:price,confirmedLanded:landed},sellerSettings);
        const pass=e.priceComplete&&e.profit>0&&e.margin>=Number(target.minMarginPct??20)&&e.roi>=Number(target.minRoiPct??45);
        rows.push(Object.freeze({
          quantity,
          sellPriceGrossRon:round(price),
          screeningFreightPerUnitRon:round(freight,4),
          unknownImportCostReservePerUnitRon:round(reserve),
          screeningLandedPerUnitRon:round(landed,4),
          profitPerUnitRon:round(e.profit),
          marginPct:round(e.margin),
          roiPct:round(e.roi),
          passesTargets:pass,
          capitalAtScreeningLandedRon:round(landed*quantity),
          truth:'STRESS_SCENARIO_NOT_CONFIRMED_LANDED_COST'
        }));
      }
    }
  }
  const grouped={};
  for(const q of quantities){
    grouped[String(q)]={};
    for(const p of sellPricesRon){
      const r=rows.filter(x=>x.quantity===Number(q)&&x.sellPriceGrossRon===Number(p)&&x.passesTargets).sort((a,b)=>b.unknownImportCostReservePerUnitRon-a.unknownImportCostReservePerUnitRon)[0]||null;
      grouped[String(q)][String(p)]=r?{maxStressReservePerUnitRon:r.unknownImportCostReservePerUnitRon,marginPct:r.marginPct,roiPct:r.roiPct,profitPerUnitRon:r.profitPerUnitRon}:null;
    }
  }
  return Object.freeze({
    schemaVersion:'MPR_IMPORT_COST_STRESS_V1',
    status:'CALCULATED_SCREENING',
    rows:Object.freeze(rows),
    maxPassingStressByQuantityPrice:Object.freeze(grouped),
    purchaseAuthorized:false,
    policy:'Stress reserves are hypothetical unknown-import-cost scenarios used only to test robustness. They never replace customs duty, brokerage, handling, delivery or confirmed landed cost evidence.'
  });
}
