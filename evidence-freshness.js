export const SOURCE_WINDOWS_HOURS=Object.freeze({marketplace:72,romania:168,supplier:720,freight:168,trend:72});
export function evidenceFreshness(observedAt,{kind='marketplace',now=Date.now()}={}){
  const time=typeof observedAt==='string'&&observedAt.trim()?Date.parse(observedAt):NaN;
  const maxAgeHours=SOURCE_WINDOWS_HOURS[kind]??72;
  if(!Number.isFinite(time))return {status:'UNKNOWN',observedAt:null,ageHours:null,maxAgeHours};
  const ageHours=(now-time)/3600000;
  return {status:ageHours<0?'INVALID_FUTURE':ageHours>maxAgeHours?'STALE':'CURRENT',observedAt,ageHours:Math.max(0,Math.round(ageHours*10)/10),maxAgeHours};
}
export function productEvidenceFreshness(p={},now=Date.now()){
  // Pipeline generation time is deliberately excluded.
  const observedAt=p.marketScout?.checkedAt||p.lastChecked||p.checkedAt||p.observedAt||p.evidence?.observedAt||null;
  return {...evidenceFreshness(observedAt,{now}),source:p.sourceUrl||p.marketScout?.source||p.source||null,
    evidenceClass:p.salesEstimation?.status==='ACTUAL_OBSERVED'?'OBSERVED':'ESTIMATED_OR_UNCONFIRMED'};
}
