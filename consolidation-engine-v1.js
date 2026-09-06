const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));

export function seaLclChargeableMeasure({volumeM3,grossWeightKg}={}){
  const v=finite(volumeM3)&&Number(volumeM3)>=0?Number(volumeM3):null;
  const w=finite(grossWeightKg)&&Number(grossWeightKg)>=0?Number(grossWeightKg)/1000:null;
  if(v===null&&w===null)return Object.freeze({known:false,revenueTon:null,basis:'UNKNOWN'});
  if(v!==null&&w!==null)return Object.freeze({known:true,revenueTon:Math.max(v,w),basis:v>=w?'VOLUME_M3':'WEIGHT_TON'});
  return Object.freeze({known:true,revenueTon:v??w,basis:v!==null?'VOLUME_ONLY_FLOOR':'WEIGHT_ONLY_FLOOR'});
}

export function consolidationAllocatorV1({
  mode='SEA_LCL',
  items=[],
  minimumBillableMeasure=1,
  ratePerMeasure=null,
  fixedShipmentCost=0,
  quotedMinimumShipmentCost=null
}={}){
  if(String(mode).toUpperCase()!=='SEA_LCL')return Object.freeze({schemaVersion:'MPR_CONSOLIDATION_ALLOCATOR_V1',status:'UNSUPPORTED_MODE'});
  const min=finite(minimumBillableMeasure)?Math.max(0,Number(minimumBillableMeasure)):null;
  const rate=finite(ratePerMeasure)?Math.max(0,Number(ratePerMeasure)):null;
  const fixed=finite(fixedShipmentCost)?Math.max(0,Number(fixedShipmentCost)):0;
  const quote=finite(quotedMinimumShipmentCost)?Math.max(0,Number(quotedMinimumShipmentCost)):null;
  if(min===null||(rate===null&&quote===null))return Object.freeze({schemaVersion:'MPR_CONSOLIDATION_ALLOCATOR_V1',status:'RATE_OR_MINIMUM_QUOTE_REQUIRED'});

  const rows=(Array.isArray(items)?items:[]).map((x,i)=>{
    const m=seaLclChargeableMeasure(x);
    return {...x,id:String(x.id||`item-${i+1}`),measure:m.revenueTon,basis:m.basis,known:m.known};
  });
  if(!rows.length||rows.some(x=>!x.known))return Object.freeze({schemaVersion:'MPR_CONSOLIDATION_ALLOCATOR_V1',status:'ITEM_MEASURE_UNKNOWN',items:Object.freeze(rows)});

  const totalMeasure=rows.reduce((s,x)=>s+x.measure,0);
  const billable=Math.max(min,totalMeasure);
  const transport=quote!==null?Math.max(quote,rate!==null?billable*rate:0):billable*rate;
  const shipmentTotal=transport+fixed;
  const allocBase=totalMeasure>0?totalMeasure:1;
  const allocated=rows.map(x=>{
    const share=x.measure/allocBase;
    return Object.freeze({...x,sharePct:round(share*100,2),allocatedShipmentCost:round(shipmentTotal*share,2)});
  });

  return Object.freeze({
    schemaVersion:'MPR_CONSOLIDATION_ALLOCATOR_V1',
    status:'CALCULATED_SCREENING',
    totalPhysicalMeasure:round(totalMeasure,6),
    minimumBillableMeasure:min,
    billableMeasure:round(billable,6),
    minimumChargePenaltyMeasure:round(Math.max(0,billable-totalMeasure),6),
    transportCost:round(transport,2),
    fixedShipmentCost:round(fixed,2),
    shipmentTotalCost:round(shipmentTotal,2),
    items:Object.freeze(allocated),
    allocationTruth:rows.every(x=>x.basis==='VOLUME_M3'||x.basis==='WEIGHT_TON')?'FULL_MEASURE':'PARTIAL_MEASURE_FLOOR',
    purchaseAuthorized:false,
    policy:'Consolidation allocates the shipment-level minimum/fixed cost across SKU chargeable measures. If an item has only volume or only weight, allocation is a screening floor, not confirmed landed cost.'
  });
}

export function consolidationOpportunityV1({itemMeasure,minimumBillableMeasure=1,minimumShipmentCost}={}){
  if(!finite(itemMeasure)||Number(itemMeasure)<=0||!finite(minimumShipmentCost)||Number(minimumShipmentCost)<0)return Object.freeze({status:'UNKNOWN'});
  const m=Number(itemMeasure),min=Math.max(Number(minimumBillableMeasure)||0,0),cost=Number(minimumShipmentCost);
  const soloBillable=Math.max(min,m);
  const soloCost=cost*(soloBillable/min);
  const fullConsolidationAllocated=cost*(m/min);
  return Object.freeze({
    status:'CALCULATED_SCREENING',
    itemMeasure:round(m,6),
    minimumBillableMeasure:min,
    soloMinimumCost:round(soloCost,2),
    allocatedCostIfMinimumIsFullyShared:round(fullConsolidationAllocated,2),
    theoreticalSaving:round(soloCost-fullConsolidationAllocated,2),
    fillRequiredFromOtherSkus:round(Math.max(0,min-m),6),
    policy:'Fully-shared allocation is a theoretical consolidation case. It assumes other SKUs fill the unused minimum billable measure; it is not a carrier quote.'
  });
}
