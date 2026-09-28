import {FREE_TOP25_EXPANDED_REGISTRY} from './free-top25-expanded-registry.js';

export const EDITORIAL_INPUT_SCHEMA='MPR_EDITORIAL_CANDIDATES_V1';
export const EDITORIAL_FEED_SCHEMA='MPR_EDITORIAL_RADAR_V1';
export const EDITORIAL_EVIDENCE_TYPES=Object.freeze({
  IDENTITY:{label:'Identitate',maxAgeDays:30},
  DEMAND:{label:'Interes',maxAgeDays:35},
  RO_COMPARABLE:{label:'Ofertă în România',maxAgeDays:7},
  SUPPLIER:{label:'Furnizor',maxAgeDays:30},
  COST:{label:'Cost',maxAgeDays:7}
});
const DAY=86_400_000;
const clean=value=>String(value??'').trim();
const nicheIds=new Set(FREE_TOP25_EXPANDED_REGISTRY.map(row=>row.id));
const validDate=(value,now,maxAgeDays)=>{
  const ms=Date.parse(clean(value));
  return Number.isFinite(ms)&&ms<=now.getTime()&&now.getTime()-ms<=maxAgeDays*DAY?new Date(ms).toISOString():null;
};
const validUrl=value=>{
  try{const url=new URL(clean(value));return url.protocol==='https:'?url.href:null;}catch{return null;}
};
const shortText=(value,max)=>{const text=clean(value);return text&&text.length<=max?text:null;};

export function normalizeEditorialEvidence(raw,{now=new Date()}={}){
  const type=clean(raw?.type).toUpperCase(),policy=EDITORIAL_EVIDENCE_TYPES[type];
  if(!policy||raw?.usage!=='LINK_WITH_ORIGINAL_SUMMARY'||raw?.verification!=='OBSERVED')return null;
  const observedAt=validDate(raw.observedAt,now,policy.maxAgeDays);
  const retrievedAt=validDate(raw.retrievedAt,now,policy.maxAgeDays);
  const sourceUrl=validUrl(raw.sourceUrl);
  const sourceName=shortText(raw.sourceName,80),summary=shortText(raw.summary,240);
  if(!observedAt||!retrievedAt||Date.parse(retrievedAt)<Date.parse(observedAt)||!sourceUrl||!sourceName||!summary)return null;
  if(/\b(?:bestseller|v[aâ]nz[aă]ri confirmate|unit[aă][țt]i v[aâ]ndute|profit garantat)\b/i.test(summary))return null;
  return {type,label:policy.label,sourceName,sourceUrl,observedAt,retrievedAt,summary,verification:'OBSERVED'};
}

export function normalizeEditorialCandidate(raw,{now=new Date()}={}){
  const id=clean(raw?.id).toUpperCase(),nicheId=clean(raw?.nicheId).toUpperCase();
  const title=shortText(raw?.title,120),need=shortText(raw?.need,240),rationale=shortText(raw?.rationale,240);
  const publication=raw?.publication||{},brandReview=raw?.brandReview||{};
  if(!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(id)||!nicheIds.has(nicheId)||!title||!need||!rationale)return null;
  if(publication.status!=='APPROVED_RESEARCH'||publication.rightsBasis!=='ORIGINAL_MPR_SUMMARY_AND_LINKS'||!shortText(publication.reviewer,80)||!validDate(publication.reviewedAt,now,30))return null;
  if(brandReview.status!=='GENERIC_CONCEPT_REVIEWED'||!shortText(brandReview.reviewer,80)||!validDate(brandReview.reviewedAt,now,30))return null;
  if(!Array.isArray(raw.evidence)||raw.evidence.length<1||raw.evidence.length>20)return null;
  const evidence=raw.evidence.map(row=>normalizeEditorialEvidence(row,{now})).filter(Boolean);
  if(!evidence.some(row=>row.type==='IDENTITY'))return null;
  const latestBySource=new Map();
  for(const row of evidence){
    const key=`${row.type}|${row.sourceUrl}`,previous=latestBySource.get(key);
    if(!previous||row.observedAt>previous.observedAt||row.observedAt===previous.observedAt&&row.retrievedAt>previous.retrievedAt)latestBySource.set(key,row);
  }
  const unique=[...latestBySource.values()];
  return {id,nicheId,title,need,rationale,sourceRank:null,stage:'DISCOVERED',statusLabel:'În cercetare',brandStatus:'Concept generic revizuit; produsul furnizorului neconfirmat',lastReviewedAt:validDate(publication.reviewedAt,now,30),brandReviewedAt:validDate(brandReview.reviewedAt,now,30),evidence:unique,expiredEvidenceCount:raw.evidence.length-evidence.length,missingEvidence:Object.keys(EDITORIAL_EVIDENCE_TYPES).filter(type=>!unique.some(row=>row.type===type))};
}

export function buildEditorialRadarFeed(raw,{now=new Date()}={}){
  if(raw?.schema!==EDITORIAL_INPUT_SCHEMA||!Array.isArray(raw.products))throw new Error('EDITORIAL_INPUT_INVALID');
  const products=[],seen=new Set(),counts=new Map();
  for(const candidate of raw.products){
    if(candidate?.publication?.status!=='APPROVED_RESEARCH')continue;
    const item=normalizeEditorialCandidate(candidate,{now});
    if(!item)throw new Error(`EDITORIAL_APPROVED_CANDIDATE_INVALID:${clean(candidate?.id)||'UNKNOWN'}`);
    if(seen.has(item.id))throw new Error(`EDITORIAL_DUPLICATE_ID:${item.id}`);
    seen.add(item.id);
    counts.set(item.nicheId,(counts.get(item.nicheId)||0)+1);
    if(counts.get(item.nicheId)>25)throw new Error(`EDITORIAL_NICHE_LIMIT:${item.nicheId}`);
    products.push(item);
  }
  products.sort((a,b)=>a.nicheId.localeCompare(b.nicheId)||a.title.localeCompare(b.title,'ro'));
  return {schema:EDITORIAL_FEED_SCHEMA,generatedAt:now.toISOString(),policy:{selection:'MPR_EDITORIAL',sourceRanksClaimed:false,verifiedSalesClaimed:false,commercialReadinessClaimed:false,paidCallsTriggered:0},niches:FREE_TOP25_EXPANDED_REGISTRY.map(niche=>({id:niche.id,label:niche.label,emoji:niche.emoji,documentedCount:counts.get(niche.id)||0})),products};
}

export function freshEditorialProducts(feed,{now=new Date()}={}){
  if(feed?.schema!==EDITORIAL_FEED_SCHEMA||!Array.isArray(feed.products))return [];
  return feed.products.flatMap(raw=>{
    if(!validDate(raw?.lastReviewedAt,now,30)||!validDate(raw?.brandReviewedAt,now,30)||raw?.stage!=='DISCOVERED'||raw?.sourceRank!==null||!Array.isArray(raw?.evidence))return [];
    const evidence=raw.evidence.filter(row=>{
      const policy=EDITORIAL_EVIDENCE_TYPES[row?.type];
      return policy&&validDate(row.observedAt,now,policy.maxAgeDays)&&validDate(row.retrievedAt,now,policy.maxAgeDays)&&validUrl(row.sourceUrl);
    });
    if(!evidence.some(row=>row.type==='IDENTITY'))return [];
    return [{...raw,evidence,expiredEvidenceCount:(raw.expiredEvidenceCount||0)+raw.evidence.length-evidence.length,missingEvidence:Object.keys(EDITORIAL_EVIDENCE_TYPES).filter(type=>!evidence.some(row=>row.type===type))}];
  });
}
