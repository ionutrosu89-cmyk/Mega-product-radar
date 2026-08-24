const text=v=>String(v??'').trim();
const dateOk=v=>{const d=new Date(v);return Boolean(v)&&Number.isFinite(d.getTime());};
const allowed=new Set(['NOT_SENT','SENT','REPLIED','CLOSED']);

export function normalizeRfqRecord(v={}){
  const status=allowed.has(String(v.status||''))?String(v.status):'NOT_SENT';
  return{
    productKey:text(v.productKey||v.productCanonicalKey),
    productName:text(v.productName),
    supplierName:text(v.supplierName),
    platform:text(v.platform),
    sourceUrl:text(v.sourceUrl),
    priority:Number.isFinite(Number(v.priority))?Number(v.priority):999,
    status,
    sentAt:dateOk(v.sentAt)?String(v.sentAt):null,
    sentBy:text(v.sentBy)||null,
    channel:text(v.channel)||null,
    responseReceivedAt:dateOk(v.responseReceivedAt)?String(v.responseReceivedAt):null,
    responseReference:text(v.responseReference)||null,
    updatedAt:dateOk(v.updatedAt)?String(v.updatedAt):null
  };
}

export function validateRfqRecord(v={}){
  const r=normalizeRfqRecord(v),blockers=[];
  if(!r.productKey)blockers.push('product key');
  if(!r.productName)blockers.push('product name');
  if(!r.supplierName)blockers.push('supplier name');
  if(!r.platform)blockers.push('platform');
  if(r.status==='NOT_SENT'){
    if(r.sentAt||r.sentBy||r.responseReceivedAt||r.responseReference)blockers.push('NOT_SENT cannot contain dispatch or reply evidence');
  }
  if(['SENT','REPLIED','CLOSED'].includes(r.status)){
    if(!r.sentAt)blockers.push('real sent timestamp');
    if(!r.sentBy)blockers.push('sender identity');
    if(!r.channel)blockers.push('dispatch channel');
  }
  if(['REPLIED','CLOSED'].includes(r.status)){
    if(!r.responseReceivedAt)blockers.push('response timestamp');
    if(!r.responseReference)blockers.push('response reference');
  }
  return{valid:blockers.length===0,record:r,blockers};
}

export function markRfqSent(v={},input={}){
  const current=normalizeRfqRecord(v);
  if(current.status!=='NOT_SENT')return{ok:false,record:current,blockers:['RFQ must be NOT_SENT before SENT']};
  if(input.confirmedRealDispatch!==true)return{ok:false,record:current,blockers:['explicit human confirmation that RFQ was actually sent']};
  const sentBy=text(input.sentBy),channel=text(input.channel),sentAt=input.sentAt||new Date().toISOString();
  if(!sentBy||!channel||!dateOk(sentAt))return{ok:false,record:current,blockers:['sender, channel and valid sent timestamp']};
  const next={...current,status:'SENT',sentAt:String(sentAt),sentBy,channel,responseReceivedAt:null,responseReference:null,updatedAt:new Date().toISOString()};
  const check=validateRfqRecord(next);
  return{ok:check.valid,record:check.record,blockers:check.blockers};
}

export function markRfqReplied(v={},input={}){
  const current=normalizeRfqRecord(v);
  if(current.status!=='SENT')return{ok:false,record:current,blockers:['RFQ must be SENT before REPLIED']};
  if(input.confirmedRealResponse!==true)return{ok:false,record:current,blockers:['explicit human confirmation that a supplier response was received']};
  const responseReference=text(input.responseReference),responseReceivedAt=input.responseReceivedAt||new Date().toISOString();
  if(!responseReference||!dateOk(responseReceivedAt))return{ok:false,record:current,blockers:['response reference and valid response timestamp']};
  const next={...current,status:'REPLIED',responseReceivedAt:String(responseReceivedAt),responseReference,updatedAt:new Date().toISOString()};
  const check=validateRfqRecord(next);
  return{ok:check.valid,record:check.record,blockers:check.blockers};
}

export function seedRfqRecords(queue={},candidates={}){
  const bySupplier=new Map((candidates?.candidates||[]).map(x=>[text(x.supplierName),x]));
  return(queue?.entries||[]).map(entry=>normalizeRfqRecord({
    productKey:queue.productCanonicalKey,
    productName:queue.productTitle,
    supplierName:entry.supplierName,
    platform:entry.platform,
    priority:entry.priority,
    sourceUrl:bySupplier.get(text(entry.supplierName))?.sourceUrl||'',
    status:'NOT_SENT'
  }));
}
