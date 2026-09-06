const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function finalistTestGateV1(input={}){
  const gates={
    finalistStage:String(input.stage||'')==='FINALIST',
    romaniaDemandReady:input.romaniaDemandReady===true,
    salesModelReady:['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(String(input.salesStatus||''))&&Number(input.salesConfidence||0)>=75,
    supplierPageReady:input.supplierPageReady===true,
    customsClassificationReady:Boolean(input.cnCode)&&Boolean(input.taricStatus==='VERIFIED'||input.customsDutyRateVerified===true),
    freightFullyLoaded:input.freightFullyLoaded===true&&finite(input.freightTotalRon),
    importCostsReady:input.importCostsReady===true,
    landedCostConfirmed:input.landedCostConfirmed===true&&finite(input.landedCostPerUnitRon),
    economicsHealthy:finite(input.marginPct)&&Number(input.marginPct)>=20&&finite(input.roiPct)&&Number(input.roiPct)>=45&&finite(input.profitPerUnitRon)&&Number(input.profitPerUnitRon)>0,
    complianceReady:input.complianceReady!==false
  };
  const labels={
    finalistStage:'FINALIST_STAGE_REQUIRED',
    romaniaDemandReady:'ROMANIA_DEMAND_REQUIRED',
    salesModelReady:'HIGH_CONFIDENCE_SALES_REQUIRED',
    supplierPageReady:'PAGE_BACKED_SUPPLIER_REQUIRED',
    customsClassificationReady:'EXACT_CN_TARIC_CLASSIFICATION_REQUIRED',
    freightFullyLoaded:'FULLY_LOADED_FREIGHT_REQUIRED',
    importCostsReady:'BROKERAGE_DESTINATION_HANDLING_LOCAL_DELIVERY_REQUIRED',
    landedCostConfirmed:'CONFIRMED_LANDED_COST_REQUIRED',
    economicsHealthy:'MARGIN_ROI_PROFIT_TARGETS_REQUIRED',
    complianceReady:'COMPLIANCE_REVIEW_REQUIRED'
  };
  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>labels[k]);
  const ready=blockers.length===0;
  return Object.freeze({
    schemaVersion:'MPR_FINALIST_TEST_GATE_V1',
    status:ready?'TEST_READY':'TEST_BLOCKED',
    gates:Object.freeze(gates),
    blockers:Object.freeze(blockers),
    testReady:ready,
    sampleOrOrderApprovalRequired:ready,
    purchaseAuthorized:false,
    supplierContactRequired:false,
    policy:'FINALIST is not TEST_READY until customs, fully loaded freight, import costs and landed economics are independently confirmed. Page-backed supplier sourcing is sufficient for sourcing readiness; it never authorizes purchase.'
  });
}
