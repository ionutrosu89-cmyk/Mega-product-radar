const text=v=>String(v??'').trim();
const iso=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();};

function rowsFromCompact(compact={}){
  if(Array.isArray(compact.snapshots)){
    const fields=compact.fields||[];const ix=Object.fromEntries(fields.map((x,i)=>[x,i]));
    return compact.snapshots.map(r=>({externalId:text(r[ix.asin]??r[ix.externalId]).toUpperCase(),observedAt:iso(r[ix.observedAt]),sourceSchema:compact.schemaVersion}));
  }
  if(Array.isArray(compact.products)){
    const fields=compact.fields||[];const ix=Object.fromEntries(fields.map((x,i)=>[x,i]));
    return compact.products.map(r=>({externalId:text(r[ix.asin]??r[ix.externalId]).toUpperCase(),observedAt:iso(r[ix.observedAt]),sourceSchema:compact.schemaVersion}));
  }
  return[];
}

export function buildLiveCoverageManifest({bootstrap,liveCompacts=[],minObservationHours=24}={}){
  const fields=bootstrap?.fields||[];const ix=Object.fromEntries(fields.map((x,i)=>[x,i]));
  const universe=(bootstrap?.products||[]).map(r=>text(r[ix.asin]).toUpperCase()).filter(Boolean);
  const universeSet=new Set(universe);
  const evidence=[];
  for(const c of liveCompacts||[])evidence.push(...rowsFromCompact(c));
  const byId=new Map();const rejected=[];
  for(const row of evidence){
    if(!universeSet.has(row.externalId)){rejected.push({...row,error:'ASIN_NOT_IN_BOOTSTRAP'});continue;}
    if(!row.observedAt){rejected.push({...row,error:'OBSERVED_AT_INVALID'});continue;}
    if(!byId.has(row.externalId))byId.set(row.externalId,[]);
    byId.get(row.externalId).push(row);
  }
  for(const rows of byId.values())rows.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  const captured=[...byId.keys()].sort();
  const missing=universe.filter(x=>!byId.has(x));
  const minMs=Math.max(1,Number(minObservationHours)||24)*3600000;
  const products=captured.map(externalId=>{
    const rows=byId.get(externalId);const first=rows[0];const last=rows.at(-1);
    const nextEligibleAt=new Date(new Date(first.observedAt).getTime()+minMs).toISOString();
    return{externalId,liveSnapshotCount:rows.length,firstObservedAt:first.observedAt,lastObservedAt:last.observedAt,nextEligibleAt,eligibleForSecondObservationNow:false};
  });
  return{
    universeCount:universe.length,capturedCount:captured.length,missingCount:missing.length,coveragePct:universe.length?Math.round(captured.length/universe.length*10000)/100:0,
    captured,missing,products,rejected,
    minObservationHours:Number(minObservationHours)||24,
    secondObservationExecutionAuthorized:false,
    trendReadyCount:0,
    paidCallsTriggered:0,approvedSpendEur:0,purchaseAuthorized:false,
    policy:'FIRST_LIVE_COVERAGE_ONLY_SECOND_OBSERVATION_REQUIRES_TIME_GATE_AND_EXPLICIT_EXECUTION'
  };
}

export function evaluateSecondObservationEligibility(manifest={},now=new Date()){
  const nowIso=iso(now);if(!nowIso)return{eligible:[],blocked:manifest.products||[],now:null};
  const t=new Date(nowIso).getTime();const eligible=[],blocked=[];
  for(const p of manifest.products||[]){
    const ok=new Date(p.nextEligibleAt).getTime()<=t;
    (ok?eligible:blocked).push({...p,eligibleForSecondObservationNow:ok});
  }
  return{now:nowIso,eligible,blocked,eligibleCount:eligible.length,blockedCount:blocked.length,executionAuthorized:false,paidCallsTriggered:0,purchaseAuthorized:false};
}
