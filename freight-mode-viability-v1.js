const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function freightModeViabilityV1({freightCeilingRon,modes=[]}={}){
  const ceiling=finite(freightCeilingRon)?Number(freightCeilingRon):null;
  if(ceiling===null)return Object.freeze({schemaVersion:'MPR_FREIGHT_MODE_VIABILITY_ENGINE_V1',status:'UNKNOWN',blockers:Object.freeze(['FREIGHT_CEILING_REQUIRED']),modes:Object.freeze([])});
  const rows=(Array.isArray(modes)?modes:[]).map(x=>{
    const floor=finite(x.knownMinimumFreightRon)?Number(x.knownMinimumFreightRon):null;
    if(floor===null)return Object.freeze({...x,status:'UNKNOWN_FREIGHT_FLOOR',headroomRon:null,decisionUsable:false});
    const headroom=ceiling-floor;
    const pct=ceiling>0?headroom/ceiling*100:null;
    let status='POTENTIALLY_FEASIBLE';
    if(floor>ceiling)status='REJECT_MINIMUM_CHARGE';
    else if(headroom<50||pct<15)status='VERY_TIGHT_HEADROOM';
    return Object.freeze({
      ...x,
      status,
      freightCeilingRon:round(ceiling),
      knownMinimumFreightRon:round(floor),
      headroomRon:round(headroom),
      headroomPct:pct===null?null:round(pct),
      decisionUsable:status==='REJECT_MINIMUM_CHARGE',
      purchaseAuthorized:false
    });
  });
  return Object.freeze({
    schemaVersion:'MPR_FREIGHT_MODE_VIABILITY_ENGINE_V1',
    status:'CALCULATED_SCREENING',
    freightCeilingRon:round(ceiling),
    modes:Object.freeze(rows),
    rejectedModes:Object.freeze(rows.filter(x=>x.status==='REJECT_MINIMUM_CHARGE').map(x=>x.id||x.mode)),
    potentiallyFeasibleModes:Object.freeze(rows.filter(x=>['POTENTIALLY_FEASIBLE','VERY_TIGHT_HEADROOM'].includes(x.status)).map(x=>x.id||x.mode)),
    policy:'A mode is safely rejectable when its published minimum freight charge already exceeds the product freight ceiling. Any non-rejected mode remains screening-only until full carrier/forwarder, customs, brokerage and local-delivery costs are known.'
  });
}
