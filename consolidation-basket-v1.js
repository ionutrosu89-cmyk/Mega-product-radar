import {consolidationAllocatorV1} from './consolidation-engine-v1.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));

function unitMeasure(x={}){
  const dims=x.packageDimensions||x.productDimensions||null;
  const l=finite(dims?.lengthCm)?Number(dims.lengthCm):finite(dims?.packageLengthCm)?Number(dims.packageLengthCm):null;
  const w=finite(dims?.widthCm)?Number(dims.widthCm):finite(dims?.packageWidthCm)?Number(dims.packageWidthCm):null;
  const h=finite(dims?.heightCm)?Number(dims.heightCm):finite(dims?.packageHeightCm)?Number(dims.packageHeightCm):null;
  const volumeM3=l&&w&&h?(l*w*h)/1_000_000:null;
  const grossWeightKg=finite(x.unitGrossWeightKg)?Number(x.unitGrossWeightKg):null;
  return {volumeM3,grossWeightKg,dimensionsKnown:Boolean(volumeM3),weightKnown:grossWeightKg!==null};
}

export function buildConsolidationBasketV1({
  products=[],
  targetMinimumMeasure=1,
  ratePerMeasureRon=null,
  fixedShipmentCostRon=0,
  candidateQuantities=[30,50,100,300]
}={}){
  const rows=[];
  for(const p of Array.isArray(products)?products:[]){
    const m=unitMeasure(p);
    for(const rawQty of candidateQuantities){
      const qty=Math.max(0,Math.round(Number(rawQty)||0));
      if(!qty)continue;
      rows.push({
        productKey:p.productKey,
        title:p.title,
        quantity:qty,
        unitVolumeM3:m.volumeM3,
        unitGrossWeightKg:m.grossWeightKg,
        volumeM3:m.volumeM3===null?null:m.volumeM3*qty,
        grossWeightKg:m.grossWeightKg===null?null:m.grossWeightKg*qty,
        evidenceClass:p.evidenceClass||'UNKNOWN',
        sourceUrl:p.sourceUrl||null
      });
    }
  }
  const usable=rows.filter(x=>x.volumeM3!==null||x.grossWeightKg!==null);
  const ranked=usable.map(x=>{
    const alloc=consolidationAllocatorV1({
      minimumBillableMeasure:targetMinimumMeasure,
      ratePerMeasure:ratePerMeasureRon,
      fixedShipmentCost:fixedShipmentCostRon,
      items:[{id:x.productKey,volumeM3:x.volumeM3,grossWeightKg:x.grossWeightKg}]
    });
    return {...x,soloScreen:alloc};
  });
  return Object.freeze({
    schemaVersion:'MPR_CONSOLIDATION_BASKET_V1',
    status:ranked.length?'SCREENING_READY':'NO_LOGISTICS_DATA',
    targetMinimumMeasure,
    candidates:Object.freeze(ranked),
    policy:'Basket candidates use only public page-backed dimensions/weights. Missing dimensions or weight remain UNKNOWN. This screen does not authorize shipment or purchase.'
  });
}

export function optimizeTwoSkuFillV1({
  skuA,skuB,targetMeasure=1,maxQtyA=1000,maxQtyB=1000,stepA=10,stepB=10
}={}){
  const ma=unitMeasure(skuA),mb=unitMeasure(skuB);
  if(ma.volumeM3===null&&ma.grossWeightKg===null)return {status:'SKU_A_MEASURE_UNKNOWN'};
  if(mb.volumeM3===null&&mb.grossWeightKg===null)return {status:'SKU_B_MEASURE_UNKNOWN'};
  const measure=(m,q)=>Math.max(m.volumeM3===null?0:m.volumeM3*q,m.grossWeightKg===null?0:(m.grossWeightKg*q)/1000);
  let best=null;
  for(let a=0;a<=maxQtyA;a+=Math.max(1,stepA)){
    for(let b=0;b<=maxQtyB;b+=Math.max(1,stepB)){
      if(a===0&&b===0)continue;
      const total=measure(ma,a)+measure(mb,b);
      if(total<targetMeasure)continue;
      const overshoot=total-targetMeasure;
      const capital=(finite(skuA.unitPriceRon)?Number(skuA.unitPriceRon)*a:0)+(finite(skuB.unitPriceRon)?Number(skuB.unitPriceRon)*b:0);
      const score=overshoot*1000+capital/100000;
      if(!best||score<best.score)best={score,qtyA:a,qtyB:b,totalMeasure:total,overshoot,capitalRon:capital};
    }
  }
  if(!best)return {status:'NO_FILL_WITHIN_LIMITS'};
  return Object.freeze({
    schemaVersion:'MPR_TWO_SKU_FILL_V1',
    status:'SCREENING_READY',
    qtyA:best.qtyA,qtyB:best.qtyB,
    totalMeasure:round(best.totalMeasure,6),
    overshootMeasure:round(best.overshoot,6),
    estimatedGoodsCapitalRon:round(best.capitalRon,2),
    policy:'Optimizes minimum billable measure using public logistics floors. It does not prove commercial demand or authorize quantity/order.'
  });
}
