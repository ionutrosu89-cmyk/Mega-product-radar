import {FREE_TOP25_COMMERCIAL_PROFILES} from './free-top25-commercial-profiles-v1.js';

const normalize=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const contains=(text,phrase)=>` ${text} `.includes(` ${normalize(phrase)} `);
const NON_PRODUCT_CONTEXT=Object.freeze(['vs','scor','meci','live score','rezultat','clasament fotbal','alegeri','presedinte','ministru','actor','actrita','serial','film','concert','festival','cutremur','razboi','stiri','meteo','ora exacta','program tv']);

export function classifyCurrentSearchProductSignal(query){
  const text=normalize(query);
  if(!text||NON_PRODUCT_CONTEXT.some(term=>contains(text,term)))return {productRelevant:false,niches:[],reason:'NON_PRODUCT_OR_BLOCKED_CONTEXT'};
  const matches=[];
  for(const [nicheId,rules] of Object.entries(FREE_TOP25_COMMERCIAL_PROFILES)){
    const excluded=rules.exclude.find(term=>contains(text,term));
    if(excluded)continue;
    const include=rules.include.find(term=>contains(text,term));
    if(include)matches.push({nicheId,matchedTerm:include});
  }
  return matches.length?{productRelevant:true,niches:matches,reason:'PRODUCT_TERM_MATCH'}:{productRelevant:false,niches:[],reason:'NO_PRODUCT_TERM_MATCH'};
}

export function normalizeCurrentSearchSignal(signal={}){
  const queryText=String(signal.queryText||signal.query||signal.term||'').trim();
  const classification=classifyCurrentSearchProductSignal(queryText);
  if(!classification.productRelevant)return null;
  const observedAt=new Date(signal.observedAt||Date.now());
  if(Number.isNaN(observedAt.getTime()))return null;
  const windowDays=Number(signal.windowDays);
  if(![1,7,30].includes(windowDays))return null;
  const signalType=String(signal.signalType||'').toUpperCase();
  if(!['TRENDING_NOW','TOP_TERM','RISING_TERM'].includes(signalType))return null;
  return {
    sourceKey:String(signal.sourceKey||'GOOGLE_TRENDS').trim(),
    market:String(signal.market||'RO').trim().toUpperCase(),
    windowDays,
    observedAt:observedAt.toISOString(),
    queryText,
    normalizedQuery:normalize(queryText),
    signalType,
    rank:Number.isInteger(Number(signal.rank))?Number(signal.rank):null,
    searchVolumeLowerBound:Number.isFinite(Number(signal.searchVolumeLowerBound))?Math.max(0,Number(signal.searchVolumeLowerBound)):null,
    growthPercent:Number.isFinite(Number(signal.growthPercent))?Math.max(0,Number(signal.growthPercent)):null,
    sourceUrl:String(signal.sourceUrl||'').trim(),
    evidenceClass:'DIRECT',
    rightsStatus:String(signal.rightsStatus||'APPROVED_OFFICIAL_PUBLIC_EXPORT').trim(),
    nicheMatches:classification.niches,
    salesEvidenceClass:'SEARCH_INTEREST_NOT_SALES'
  };
}
