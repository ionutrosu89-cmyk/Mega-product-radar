import {isCanonicalProductId} from './domain-contracts-v1.js';

const portfolioKey=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const canonicalId=v=>isCanonicalProductId(v)?String(v).toLowerCase():null;
const itemTime=x=>{const t=Date.parse(x?.updatedAt||x?.at||'');return Number.isFinite(t)?t:0;};
const identityKey=row=>canonicalId(row?.canonicalProductId)?`canonical:${canonicalId(row.canonicalProductId)}`:`legacy:${portfolioKey(row?.name)}`;

export function normalizePortfolioRecord(row={}){
  const id=canonicalId(row.canonicalProductId);
  return{...row,canonicalProductId:id,name:String(row.name||'').trim(),identityStatus:id?'CANONICAL':'LEGACY_COMPATIBILITY',decisionEligible:Boolean(id)};
}

export function dedupePortfolio(rows=[]){
  const map=new Map();
  for(const raw of Array.isArray(rows)?rows:[]){
    const row=normalizePortfolioRecord(raw),key=identityKey(row);if(key==='legacy:')continue;
    const old=map.get(key);
    if(!old||itemTime(row)>=itemTime(old))map.set(key,row);
  }
  const canonicalTitles=new Set([...map.values()].filter(x=>x.decisionEligible).map(x=>portfolioKey(x.name)).filter(Boolean));
  return [...map.values()].filter(x=>x.decisionEligible||!canonicalTitles.has(portfolioKey(x.name)));
}

export function upsertPortfolio(rows=[],item={}){
  const clean=dedupePortfolio(rows),next=normalizePortfolioRecord(item);
  if(!next.decisionEligible||!next.name)return clean;
  const key=identityKey(next),index=clean.findIndex(x=>identityKey(x)===key);
  if(index>=0)clean[index]={...clean[index],...next};else clean.push(next);
  return dedupePortfolio(clean);
}

export function removePortfolio(rows=[],identity=''){
  const id=canonicalId(identity),legacyKey=portfolioKey(identity);
  return dedupePortfolio(rows).filter(x=>id?canonicalId(x.canonicalProductId)!==id:!(x.identityStatus==='LEGACY_COMPATIBILITY'&&portfolioKey(x.name)===legacyKey));
}

export function portfolioDecisionRows(rows=[]){return dedupePortfolio(rows).filter(x=>x.decisionEligible);}
