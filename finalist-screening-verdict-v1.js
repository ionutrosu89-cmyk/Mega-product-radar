const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function finalistScreeningVerdictV1(input={}){
  const blockers=[];
  const stage=String(input.stage||'');
  const price=finite(input.screeningPriceRon)?Number(input.screeningPriceRon):null;
  const qty=finite(input.quantity)?Number(input.quantity):null;
  const residual=finite(input.residualLocalCostCeilingPerUnitRon)?Number(input.residualLocalCostCeilingPerUnitRon):null;
  const envelopeWorstPass=input.conservativeWorstCasePass===true;
  const marketSupported=input.priceInsideObservedMarketRange===true;
  const salesReady=input.salesReady===true;
  const supplierReady=input.supplierPageReady===true;
  if(stage!=='FINALIST')blockers.push('FINALIST_REQUIRED');
  if(price===null)blockers.push('SCREENING_PRICE_REQUIRED');
  if(qty===null||qty<=0)blockers.push('QUANTITY_REQUIRED');
  if(!salesReady)blockers.push('SALES_MODEL_REQUIRED');
  if(!supplierReady)blockers.push('SUPPLIER_PAGE_REQUIRED');

  const economicallyPromising=blockers.length===0&&envelopeWorstPass&&residual!==null&&residual>0;
  const robust=residual!==null&&residual>=1;
  const verdict=!economicallyPromising?'ECONOMICS_NOT_YET_PROMISING'
    :!marketSupported?'PROMISING_PRICE_NOT_MARKET_SUPPORTED'
    :robust?'PROMISING_ROBUST_SCREENING'
    :'PROMISING_BUT_LOCAL_COST_BUFFER_TIGHT';

  return Object.freeze({
    schemaVersion:'MPR_FINALIST_SCREENING_VERDICT_V1',
    status:blockers.length?'BLOCKED_INPUTS':'CALCULATED_SCREENING',
    verdict,
    quantity:qty,
    screeningPriceRon:price,
    priceInsideObservedMarketRange:marketSupported,
    conservativeWorstCasePass:envelopeWorstPass,
    residualLocalCostCeilingPerUnitRon:residual===null?null:round(residual),
    economicallyPromising,
    robustScreeningBuffer:robust,
    testReady:false,
    purchaseAuthorized:false,
    blockers:Object.freeze(blockers),
    policy:'A positive FINALIST screening verdict means the conservative public-evidence economics remain plausible. It is never TEST_READY and cannot replace exact customs classification, fully-loaded freight, local import charges or confirmed landed cost.'
  });
}
