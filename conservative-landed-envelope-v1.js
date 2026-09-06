import {profitEngineV2} from './profit-engine-v2.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));

export function conservativeLandedEnvelopeV1({
  quantity,
  unitGoodsCostRon,
  skuChargeableMeasure,
  consolidatedTotalMeasure,
  shipmentLogisticsBeforeDutyVatRon,
  dutyRateScenariosPct=[3,6.5,10],
  importVatRatePct=21,
  vatRecoverableModes=['RECOVERABLE','NON_RECOVERABLE'],
  sellPricesRon=[],
  sellerSettings={}
}={}){
  const q=Math.max(0,Math.round(Number(quantity)||0));
  const goods=finite(unitGoodsCostRon)?Number(unitGoodsCostRon):null;
  const skuM=finite(skuChargeableMeasure)?Number(skuChargeableMeasure):null;
  const totalM=finite(consolidatedTotalMeasure)?Number(consolidatedTotalMeasure):null;
  const shipment=finite(shipmentLogisticsBeforeDutyVatRon)?Number(shipmentLogisticsBeforeDutyVatRon):null;
  const vatRate=finite(importVatRatePct)?Number(importVatRatePct)/100:null;
  const blockers=[];
  if(!q)blockers.push('QUANTITY_REQUIRED');
  if(goods===null||goods<=0)blockers.push('UNIT_GOODS_COST_REQUIRED');
  if(skuM===null||skuM<=0)blockers.push('SKU_CHARGEABLE_MEASURE_REQUIRED');
  if(totalM===null||totalM<=0||skuM>totalM)blockers.push('CONSOLIDATED_TOTAL_MEASURE_REQUIRED');
  if(shipment===null||shipment<0)blockers.push('SHIPMENT_LOGISTICS_BENCHMARK_REQUIRED');
  if(vatRate===null||vatRate<0)blockers.push('IMPORT_VAT_RATE_REQUIRED');
  if(blockers.length)return Object.freeze({schemaVersion:'MPR_CONSERVATIVE_LANDED_ENVELOPE_V1',status:'UNKNOWN',blockers:Object.freeze(blockers)});

  const share=skuM/totalM;
  const allocatedLogistics=shipment*share;
  const goodsTotal=goods*q;
  const customsValue=goodsTotal+allocatedLogistics;
  const rows=[];
  for(const dutyPct0 of dutyRateScenariosPct){
    const dutyPct=Number(dutyPct0);
    if(!finite(dutyPct)||dutyPct<0)continue;
    const duty=customsValue*dutyPct/100;
    const vatBase=customsValue+duty;
    const importVat=vatBase*vatRate;
    const cashTotal=goodsTotal+allocatedLogistics+duty+importVat;
    for(const mode0 of vatRecoverableModes){
      const mode=String(mode0||'').toUpperCase();
      const recoverable=mode==='RECOVERABLE';
      const economicTotal=cashTotal-(recoverable?importVat:0);
      for(const price0 of sellPricesRon){
        const price=Number(price0);
        if(!finite(price)||price<=0)continue;
        const landed=economicTotal/q;
        const e=profitEngineV2({sellTarget:price,confirmedLanded:landed},sellerSettings);
        rows.push(Object.freeze({
          dutyRateScenarioPct:dutyPct,
          vatTreatment:recoverable?'RECOVERABLE':'NON_RECOVERABLE',
          sellPriceGrossRon:round(price,2),
          allocatedLogisticsRon:round(allocatedLogistics,2),
          customsDutyRon:round(duty,2),
          importVatCashRon:round(importVat,2),
          cashLandedPerUnitRon:round(cashTotal/q,4),
          economicLandedPerUnitRon:round(landed,4),
          profitPerUnitRon:round(e.profit,2),
          marginPct:round(e.margin,2),
          roiPct:round(e.roi,2),
          passesTargets:Boolean(e.priceComplete&&e.profit>0&&e.margin>=20&&e.roi>=45),
          truth:'CONSERVATIVE_PUBLIC_BENCHMARK_ENVELOPE_NOT_CONFIRMED_LANDED_COST'
        }));
      }
    }
  }
  return Object.freeze({
    schemaVersion:'MPR_CONSERVATIVE_LANDED_ENVELOPE_V1',
    status:'CALCULATED_SCREENING',
    quantity:q,
    skuMeasure:round(skuM,6),
    consolidatedTotalMeasure:round(totalM,6),
    allocationSharePct:round(share*100,4),
    allocatedLogisticsRon:round(allocatedLogistics,2),
    rows:Object.freeze(rows),
    purchaseAuthorized:false,
    policy:'Uses a public all-in-before-duty/VAT shipment benchmark allocated by chargeable measure. Duty rates are sensitivity scenarios unless TARIC is verified. VAT recoverability is shown as separate economic/cash treatments. This is never confirmed landed cost.'
  });
}
