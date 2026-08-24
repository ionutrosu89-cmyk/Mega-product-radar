const text=v=>String(v??'').trim();
const dateOk=v=>{const d=new Date(v);return Boolean(v)&&Number.isFinite(d.getTime());};
const allowed=new Set(['NOT_SENT','SENT','REPLIED','CLOSED']);
const validFollowUp=x=>x&&dateOk(x.sentAt)&&text(x.sentBy)&&text(x.channel);

export function normalizeRfqRecord(v={}){
  const status=allowed.has(String(v.status||''))?String(v.status):'NOT_SENT';
  const followUps=Array.isArray(v.followUps)?v.followUps.filter(validFollowUp).slice(0,2).map(x=>({sentAt:String(x.sentAt),sentBy:text(x.sentBy),channel:text(x.channel),note:text(x.note)||null})):[];
  return{productKey:text(v.productKey||v.productCanonicalKey),productName:text(v.productName),supplierName:text(v.supplierName),platform:text(v.platform),sourceUrl:text(v.sourceUrl),priority:Number.isFinite(Number(v.priority))?Number(v.priority):999,status,sentAt:dateOk(v.sentAt)?String(v.sentAt):null,sentBy:text(v.sentBy)||null,channel:text(v.channel)||null,responseReceivedAt:dateOk(v.responseReceivedAt)?String(v.responseReceivedAt):null,responseReference:text(v.responseReference)||null,followUps,updatedAt:dateOk(v.updatedAt)?String(v.updatedAt):null};
}

export function validateRfqRecord(v={}){
  const r=normalizeRfqRecord(v),blockers=[];
  if(!r.productKey)blockers.push('product key');if(!r.productName)blockers.push('product name');if(!r.supplierName)blockers.push('supplier name');if(!r.platform)blockers.push('platform');
  if(r.status==='NOT_SENT'&&(r.sentAt||r.sentBy||r.responseReceivedAt||r.responseReference||r.followUps.length))blockers.push('NOT_SENT cannot contain dispatch, follow-up or reply evidence');
  if(['SENT','REPLIED','CLOSED'].includes(r.status)){if(!r.sentAt)blockers.push('real sent timestamp');if(!r.sentBy)blockers.push('sender identity');if(!r.channel)blockers.push('dispatch channel');}
  if(r.status==='REPLIED'){if(!r.responseReceivedAt)blockers.push('response timestamp');if(!r.responseReference)blockers.push('response reference');}
  if(r.followUps.some(x=>new Date(x.sentAt).getTime()<new Date(r.sentAt||0).getTime()))blockers.push('follow-up cannot predate initial RFQ');
  return{valid:blockers.length===0,record:r,blockers};
}

export function followUpStatus(v={},now=new Date().toISOString()){
  const r=normalizeRfqRecord(v),nowMs=new Date(now).getTime();
  if(!Number.isFinite(nowMs))return{status:'UNKNOWN',due:false,hoursSinceSent:null,nextAction:'Invalid current timestamp.'};
  if(r.status==='NOT_SENT')return{status:'NOT_SENT',due:false,hoursSinceSent:null,nextAction:'Trimite RFQ-ul real înainte de follow-up.'};
  if(r.status==='REPLIED'){
    const responseHours=r.sentAt&&r.responseReceivedAt?(new Date(r.responseReceivedAt).getTime()-new Date(r.sentAt).getTime())/3600000:null;
    return{status:'REPLIED',due:false,hoursSinceSent:r.sentAt?(nowMs-new Date(r.sentAt).getTime())/3600000:null,responseHours,nextAction:'Deschide Quote Intake și verifică răspunsul.'};
  }
  if(r.status==='CLOSED')return{status:'CLOSED',due:false,hoursSinceSent:r.sentAt?(nowMs-new Date(r.sentAt).getTime())/3600000:null,nextAction:'Candidat închis manual.'};
  const hours=Math.max(0,(nowMs-new Date(r.sentAt).getTime())/3600000),count=r.followUps.length;
  if(count===0&&hours>=24)return{status:'FOLLOW_UP_1_DUE',due:true,hoursSinceSent:hours,nextAction:'Trimite primul follow-up; nu modifica oferta sau statusul fără răspuns real.'};
  if(count===1&&hours>=48)return{status:'FOLLOW_UP_2_DUE',due:true,hoursSinceSent:hours,nextAction:'Trimite al doilea și ultimul follow-up.'};
  if(count>=2&&hours>=72)return{status:'STALE_REVIEW',due:true,hoursSinceSent:hours,nextAction:'Revizuiește candidatul; poți continua să aștepți sau să îl închizi manual.'};
  const target=count===0?24:count===1?48:72;
  return{status:'WAITING',due:false,hoursSinceSent:hours,hoursUntilNext:Math.max(0,target-hours),nextAction:`Așteaptă până la pragul de ${target}h.`};
}

export function markRfqSent(v={},input={}){
  const current=normalizeRfqRecord(v);if(current.status!=='NOT_SENT')return{ok:false,record:current,blockers:['RFQ must be NOT_SENT before SENT']};if(input.confirmedRealDispatch!==true)return{ok:false,record:current,blockers:['explicit human confirmation that RFQ was actually sent']};
  const sentBy=text(input.sentBy),channel=text(input.channel),sentAt=input.sentAt||new Date().toISOString();if(!sentBy||!channel||!dateOk(sentAt))return{ok:false,record:current,blockers:['sender, channel and valid sent timestamp']};
  const next={...current,status:'SENT',sentAt:String(sentAt),sentBy,channel,responseReceivedAt:null,responseReference:null,followUps:[],updatedAt:new Date().toISOString()};const check=validateRfqRecord(next);return{ok:check.valid,record:check.record,blockers:check.blockers};
}

export function markRfqFollowUp(v={},input={}){
  const current=normalizeRfqRecord(v);if(current.status!=='SENT')return{ok:false,record:current,blockers:['RFQ must still be SENT to record a follow-up']};
  if(input.confirmedRealFollowUp!==true)return{ok:false,record:current,blockers:['explicit human confirmation that follow-up was actually sent']};
  if(current.followUps.length>=2)return{ok:false,record:current,blockers:['maximum two follow-ups are tracked before manual stale review']};
  const sentBy=text(input.sentBy),channel=text(input.channel),sentAt=input.sentAt||new Date().toISOString(),note=text(input.note);
  if(!sentBy||!channel||!dateOk(sentAt))return{ok:false,record:current,blockers:['sender, channel and valid follow-up timestamp']};
  const due=followUpStatus(current,sentAt);if(!['FOLLOW_UP_1_DUE','FOLLOW_UP_2_DUE','STALE_REVIEW'].includes(due.status))return{ok:false,record:current,blockers:['follow-up is not due yet']};
  const next={...current,followUps:[...current.followUps,{sentAt:String(sentAt),sentBy,channel,note:note||null}],updatedAt:new Date().toISOString()};const check=validateRfqRecord(next);return{ok:check.valid,record:check.record,blockers:check.blockers};
}

export function markRfqReplied(v={},input={}){
  const current=normalizeRfqRecord(v);if(current.status!=='SENT')return{ok:false,record:current,blockers:['RFQ must be SENT before REPLIED']};if(input.confirmedRealResponse!==true)return{ok:false,record:current,blockers:['explicit human confirmation that a supplier response was received']};
  const responseReference=text(input.responseReference),responseReceivedAt=input.responseReceivedAt||new Date().toISOString();if(!responseReference||!dateOk(responseReceivedAt))return{ok:false,record:current,blockers:['response reference and valid response timestamp']};
  const next={...current,status:'REPLIED',responseReceivedAt:String(responseReceivedAt),responseReference,updatedAt:new Date().toISOString()};const check=validateRfqRecord(next);return{ok:check.valid,record:check.record,blockers:check.blockers};
}

export function seedRfqRecords(queue={},candidates={}){const bySupplier=new Map((candidates?.candidates||[]).map(x=>[text(x.supplierName),x]));return(queue?.entries||[]).map(entry=>normalizeRfqRecord({productKey:queue.productCanonicalKey,productName:queue.productTitle,supplierName:entry.supplierName,platform:entry.platform,priority:entry.priority,sourceUrl:bySupplier.get(text(entry.supplierName))?.sourceUrl||'',status:'NOT_SENT'}));}
