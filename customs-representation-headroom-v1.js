const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function customsRepresentationHeadroomV1({
  residualLocalCostCeilingTotalRon,
  publicBenchmarks=[]
}={}){
  const ceiling=finite(residualLocalCostCeilingTotalRon)?Number(residualLocalCostCeilingTotalRon):null;
  if(ceiling===null)return Object.freeze({schemaVersion:'MPR_CUSTOMS_REPRESENTATION_HEADROOM_V1',status:'UNKNOWN',blockers:Object.freeze(['RESIDUAL_LOCAL_COST_CEILING_REQUIRED'])});
  const rows=(Array.isArray(publicBenchmarks)?publicBenchmarks:[]).map(x=>{
    const value=finite(x.amountRon)?Number(x.amountRon):null;
    if(value===null)return null;
    const residual=ceiling-value;
    return Object.freeze({
      provider:x.provider||null,
      serviceScope:x.serviceScope||null,
      publicBenchmarkRon:round(value),
      applicableDirectlyToSeaLcl:x.applicableDirectlyToSeaLcl===true,
      residualAfterBenchmarkRon:round(residual),
      fitsWithinCeiling:residual>=0,
      truth:x.applicableDirectlyToSeaLcl===true?'SCOPE_COMPATIBLE_PUBLIC_BENCHMARK':'CROSS_SERVICE_REFERENCE_ONLY'
    });
  }).filter(Boolean);
  const compatible=rows.filter(x=>x.applicableDirectlyToSeaLcl);
  return Object.freeze({
    schemaVersion:'MPR_CUSTOMS_REPRESENTATION_HEADROOM_V1',
    status:'CALCULATED_REFERENCE',
    residualLocalCostCeilingTotalRon:round(ceiling),
    rows:Object.freeze(rows),
    directSeaLclBenchmarkAvailable:compatible.length>0,
    directSeaLclConclusion:compatible.length?compatible.some(x=>x.fitsWithinCeiling)?'AT_LEAST_ONE_PUBLIC_LCL_BENCHMARK_FITS':'PUBLIC_LCL_BENCHMARK_EXCEEDS_CEILING':'UNKNOWN_NO_DIRECT_LCL_BENCHMARK',
    purchaseAuthorized:false,
    policy:'Cross-service customs representation tariffs are context only. They may reveal a tight residual budget, but cannot confirm or reject sea-LCL economics unless the service scope is explicitly compatible.'
  });
}
