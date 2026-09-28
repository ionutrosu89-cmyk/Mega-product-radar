import {FREE_TOP25_LIVE_TAXONOMY} from './free-top25-live-taxonomy-v1.js';

const DAY_MS=86_400_000;
const clean=value=>String(value??'').trim();
const normalizeTerm=value=>clean(value).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('ro-RO');
const byNiche=new Map(FREE_TOP25_LIVE_TAXONOMY.map(niche=>[niche.id,niche]));

export const FREE_RESEARCH_SOURCES=Object.freeze({
  GOOGLE_TRENDS:Object.freeze({label:'Google Trends',claim:'SEARCH_INTEREST',maxAgeDays:35,host:'trends.google.com',url:'https://trends.google.com/trends/',note:'Interes relativ de căutare; nu arată numărul de vânzări.'}),
  TIKTOK_CREATIVE_CENTER:Object.freeze({label:'TikTok Creative Center',claim:'AD_ACTIVITY',maxAgeDays:7,host:'ads.tiktok.com',url:'https://ads.tiktok.com/creative/creativeCenter',note:'Produse și reclame promovate; popularitatea reclamei nu dovedește vânzări.'}),
  META_AD_LIBRARY:Object.freeze({label:'Meta Ad Library',claim:'AD_ACTIVITY',maxAgeDays:7,host:'facebook.com',url:'https://www.facebook.com/ads/library/',note:'Reclame active Facebook și Instagram; prezența unei reclame nu dovedește cerere sau vânzări.'})
});

export function freeResearchLinks(nicheId){
  const niche=byNiche.get(clean(nicheId).toUpperCase());
  if(!niche)return null;
  const query=niche.queries.ro[0];
  return {
    nicheId:niche.id,query,
    sources:[
      {...FREE_RESEARCH_SOURCES.GOOGLE_TRENDS,url:`https://trends.google.com/trends/explore?geo=RO&q=${encodeURIComponent(query)}`},
      FREE_RESEARCH_SOURCES.TIKTOK_CREATIVE_CENTER,
      FREE_RESEARCH_SOURCES.META_AD_LIBRARY
    ]
  };
}

function validSourceUrl(raw,source){
  try{
    const url=new URL(clean(raw));
    return url.protocol==='https:'&&(url.hostname===source.host||url.hostname===`www.${source.host}`)?url.href:null;
  }catch{return null;}
}

export function normalizeFreeSignalObservation(raw,{now=new Date()}={}){
  if(!raw||typeof raw!=='object')return null;
  const nicheId=clean(raw.nicheId).toUpperCase();
  const sourceKey=clean(raw.sourceKey).toUpperCase();
  const source=FREE_RESEARCH_SOURCES[sourceKey];
  const sourceUrl=source&&validSourceUrl(raw.sourceUrl,source);
  const observedAt=clean(raw.observedAt);
  const observedMs=Date.parse(observedAt);
  const ageMs=now.getTime()-observedMs;
  const summary=clean(raw.summary);
  const concept=clean(raw.concept);
  if(!byNiche.has(nicheId)||!sourceUrl||!Number.isFinite(observedMs)||ageMs<0||ageMs>source.maxAgeDays*DAY_MS)return null;
  if(raw.claim!==source.claim||raw.publicStatus!=='APPROVED_ORIGINAL_SUMMARY'||!clean(raw.reviewer)||!summary||summary.length>240||concept.length>100)return null;
  if(/\b(?:sales|units sold|bestseller|cele mai v[aâ]ndute|v[aâ]nz[aă]ri confirmate)\b/i.test(summary))return null;
  let periodStart=null,periodEnd=null;
  if(sourceKey==='GOOGLE_TRENDS'){
    const url=new URL(sourceUrl);
    periodStart=clean(raw.periodStart);periodEnd=clean(raw.periodEnd);
    const dateMs=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(`${value}T00:00:00Z`):NaN;
    const startMs=dateMs(periodStart),endMs=dateMs(periodEnd);
    if(url.pathname!=='/trends/explore'||url.searchParams.get('geo')!=='RO'||!concept||normalizeTerm(url.searchParams.get('q'))!==normalizeTerm(concept)||!Number.isFinite(startMs)||!Number.isFinite(endMs)||new Date(startMs).toISOString().slice(0,10)!==periodStart||new Date(endMs).toISOString().slice(0,10)!==periodEnd||startMs>endMs||endMs>observedMs||observedMs-endMs>source.maxAgeDays*DAY_MS)return null;
  }
  return {nicheId,sourceKey,sourceLabel:source.label,claim:source.claim,sourceUrl,observedAt:new Date(observedMs).toISOString(),periodStart,periodEnd,summary,concept:concept||null,reviewer:clean(raw.reviewer)};
}

export function buildFreeSignalResearchFeed(raw,{now=new Date()}={}){
  const observations=(Array.isArray(raw?.observations)?raw.observations:[])
    .map(row=>normalizeFreeSignalObservation(row,{now})).filter(Boolean);
  const latestBySource=new Map();
  for(const row of observations){
    const key=[row.nicheId,row.sourceKey,row.sourceUrl,row.concept||''].join('|');
    const previous=latestBySource.get(key);
    if(!previous||row.observedAt>previous.observedAt)latestBySource.set(key,row);
  }
  const unique=[...latestBySource.values()].sort((a,b)=>a.nicheId.localeCompare(b.nicheId)||a.sourceKey.localeCompare(b.sourceKey)||b.observedAt.localeCompare(a.observedAt));
  return {
    schema:'MPR_FREE_SIGNAL_RESEARCH_V1',
    policy:{supportingSignalsOnly:true,verifiedSalesClaimed:false,sourceRanksClaimed:false,paidCallsTriggered:0},
    niches:FREE_TOP25_LIVE_TAXONOMY.map(niche=>({id:niche.id,label:niche.label,observationCount:unique.filter(row=>row.nicheId===niche.id).length})),
    observations:unique
  };
}

export function freshPublishedFreeSignalResearchFeed(feed,{now=new Date()}={}){
  const empty=()=>buildFreeSignalResearchFeed({observations:[]},{now});
  if(feed?.schema!=='MPR_FREE_SIGNAL_RESEARCH_V1'||feed?.policy?.supportingSignalsOnly!==true||feed?.policy?.verifiedSalesClaimed!==false||!Array.isArray(feed?.observations))return empty();
  return buildFreeSignalResearchFeed({observations:feed.observations.map(row=>({...row,publicStatus:'APPROVED_ORIGINAL_SUMMARY'}))},{now});
}
