import {hardenTop25Evidence} from './top25-evidence.js';
import {top25ProductKey} from './top25-movement.js';

const RANKABLE_SOURCE_KINDS=new Set(['PUBLISHED_RANKING','EDITORIAL_RANKING']);

function decodeHtml(value=''){
  return String(value)
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>');
}

export function normalizeSourceText(html=''){
  return decodeHtml(String(html))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function escapeRegex(value=''){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

export function extractExplicitSourceRank(text,productName){
  const hay=String(text||'');
  const name=String(productName||'').trim();
  if(!hay||!name)return null;
  const escaped=escapeRegex(name).replace(/\s+/g,'\\s+');
  const patterns=[
    new RegExp(`(?:^|\\s)(?:#|no\\.?\\s*)?(\\d{1,2})\\s*[.):-]\\s*${escaped}`,'i'),
    new RegExp(`(?:rank|ranking)\\s*#?\\s*(\\d{1,2})[^a-z0-9]{0,12}${escaped}`,'i')
  ];
  for(const pattern of patterns){
    const match=hay.match(pattern);
    const rank=Number(match?.[1]);
    if(Number.isInteger(rank)&&rank>=1&&rank<=100)return rank;
  }
  return null;
}

export function sourceEvidenceSignature(products=[]){
  return JSON.stringify((Array.isArray(products)?products:[]).map(p=>({
    key:String(p?.key||''),
    internalRank:Number(p?.internalRank||0),
    sourceRank:Number.isInteger(p?.sourceRank)?p.sourceRank:null
  })));
}

export function buildRefreshedTop25Snapshot(niche,reviewedAt,sourceDocuments=new Map()){
  const products=(Array.isArray(niche?.products)?niche.products:[]).slice(0,25).map((raw,index)=>{
    const hardened=hardenTop25Evidence(raw);
    const doc=sourceDocuments.get(raw.sourceKey)||null;
    const text=doc?.ok?normalizeSourceText(doc.html):'';
    const canParseRank=doc?.ok&&RANKABLE_SOURCE_KINDS.has(String(raw.sourceKind||''));
    const parsedRank=canParseRank?extractExplicitSourceRank(text,raw.name):null;
    const sourceRank=Number.isInteger(parsedRank)?parsedRank:(hardened.sourceRankObserved?hardened.sourceRank:null);
    return {
      key:top25ProductKey(raw),
      name:String(raw?.name||''),
      internalRank:Number.isInteger(raw?.rank)?raw.rank:index+1,
      sourceRank:Number.isInteger(sourceRank)?sourceRank:null,
      sourceKey:String(raw?.sourceKey||''),
      sourceChecked:Boolean(doc),
      sourceReachable:Boolean(doc?.ok),
      rankAutoObserved:Number.isInteger(parsedRank)
    };
  });
  return {nicheId:String(niche?.id||''),reviewedAt:String(reviewedAt||''),products};
}

export function snapshotsEvidenceChanged(current,previous){
  if(!previous||!Array.isArray(previous.products))return true;
  return sourceEvidenceSignature(current?.products)!==sourceEvidenceSignature(previous.products);
}

export function uniqueTop25Sources(niches=[]){
  const map=new Map();
  for(const niche of Array.isArray(niches)?niches:[]){
    for(const product of Array.isArray(niche?.products)?niche.products:[]){
      const key=String(product?.sourceKey||'');
      const url=String(product?.sourceUrl||'');
      if(key&&url&&!map.has(key))map.set(key,{key,url,label:String(product?.sourceLabel||key),kind:String(product?.sourceKind||'')});
    }
  }
  return [...map.values()];
}
