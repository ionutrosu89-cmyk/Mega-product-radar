import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function customsDutySensitivityV1({
  quantity,
  sellPriceGrossRon,
  goodsCostPerUnitRon,
  freightPerUnitRon,
  variableImportCostPerUnitRon=0,
  fixedShipmentCostRon=0,
  dutyRateScenariosPct=[],
  sellerSettings={},
  target={minMarginPct:20,minRoiPct:45}
}={}){
  const q=Math.max(1,Math.round(Number(quantity)||0));
  const sell=finite(sellPriceGrossRon)?Number(sellPriceGrossRon):null;
  const goods=finite(goodsCostPerUnitRon)?Number(goodsCostPerUnitRon):null;
  const freight=finite(freightPerUnitRon)?Number(freightPerUnitRon):null;
  if(!q||sell===null||goods===null||freight===null)return Object.freeze({schemaVersion:'MPR_CUSTOMS_DUTY_SENSITIVITY_V1',status:'UNKNOWN'});
  const fixedPerUnit=Number(fixedShipmentCostRon||0)/q;
  const variable=Number(variableImportCostPerUnitRon||0);
  const customsValuePerUnit=goods+freight;
  const rows=(Array.isArray(dutyRateScenariosPct)?dutyRateScenariosPct:[]).filter(finite).map(rate0=>{
    const rate=Number(rate0);
    const duty=customsValuePerUnit*rate/100;
    const landed=goods+freight+variable+fixedPerUnit+duty;
    const e=profitEngineV2({sellTarget:sell,confirmedLanded:landed},sellerSettings);
    const pass=e.priceComplete&&e.profit>0&&e.margin>=Number(target.minMarginPct??20)&&e.roi>=Number(target.minRoiPct??45);
    return Object.freeze({
      dutyRateScenarioPct:rate,
      customsDutyPerUnitRon:round(duty,4),
      screeningLandedPerUnitRon:round(landed,4),
      profitPerUnitRon:round(e.profit),
      marginPct:round(e.margin),
      roiPct:round(e.roi),
      passesTargets:pass,
      truth:'CLASSIFICATION_SENSITIVITY_SCENARIO_NOT_APPLICABLE_DUTY'
    });
  });
  return Object.freeze({
    schemaVersion:'MPR_CUSTOMS_DUTY_SENSITIVITY_V1',
    status:rows.length?'CALCULATED_SCREENING':'NO_SCENARIOS',
    quantity:q,
    sellPriceGrossRon:sell,
    rows:Object.freeze(rows),
    purchaseAuthorized:false,
    policy:'Duty rates are sensitivity scenarios derived from plausible research headings, not a tariff classification. They never replace CN/TARIC evidence.'
  });
}
