import {isCanonicalProductId} from './domain-contracts-v1.js';

const text=v=>String(v??'').trim();
const canonicalId=v=>isCanonicalProductId(v)?text(v).toLowerCase():null;
const dateOk=v=>{const t=Date.parse(v||'');return Number.isFinite(t);};

export function normalizeFeedbackRecord(row={}){
  const id=canonicalId(row.canonicalProductId);
  return{...row,canonicalProductId:id,name:text(row.name),at:dateOk(row.at)?String(row.at):null,identityStatus:id?'CANONICAL':'LEGACY_COMPATIBILITY',decisionEligible:Boolean(id)};
}

export function normalizeFeedbackRows(rows=[]){
  const out=[],seen=new Set();
  for(const raw of Array.isArray(rows)?rows:[]){
    const row=normalizeFeedbackRecord(raw);
    if(!row.name)continue;
    const key=row.decisionEligible?`canonical:${row.canonicalProductId}:${row.at||''}`:`legacy:${row.name.toLowerCase()}:${row.at||''}`;
    if(seen.has(key))continue;seen.add(key);out.push(row);
  }
  return out;
}

export function appendFeedback(rows=[],item={}){
  const clean=normalizeFeedbackRows(rows),next=normalizeFeedbackRecord(item);
  if(!next.decisionEligible||!next.name||!next.at)return clean;
  return normalizeFeedbackRows([...clean,next]);
}

export function feedbackDecisionRows(rows=[]){return normalizeFeedbackRows(rows).filter(x=>x.decisionEligible);}
