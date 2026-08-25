const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const up=v=>txt(v).toUpperCase();
const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const ASIN=/^[A-Z0-9]{10}$/;

function stripTags(v=''){return txt(String(v).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"));}
function pageBlocked(html=''){return /robot check|enter the characters you see below|sorry! something went wrong|automated access/i.test(String(html));}

export function parseAmazonPublicRankingHtml({html='',sourceUrl='',observedAt='',categoryKey='',categoryLabel=null}={}){
  const at=iso(observedAt),url=txt(sourceUrl),key=txt(categoryKey);
  const diagnostics=[];
  if(!url||!/^https:\/\/(?:www\.)?amazon\.com\//i.test(url))diagnostics.push('AMAZON_PUBLIC_SOURCE_URL_REQUIRED');
  if(!at)diagnostics.push('OBSERVED_AT_REQUIRED');
  if(!key)diagnostics.push('CATEGORY_KEY_REQUIRED');
  if(pageBlocked(html))diagnostics.push('AMAZON_PAGE_BLOCKED');
  if(diagnostics.length)return{ok:false,observations:[],diagnostics,rankEvidenceCount:0,purchaseAuthorized:false,paidCallsTriggered:0};

  const source=String(html);
  const badge=/<span[^>]*class=["'][^"']*zg-bdg-text[^"']*["'][^>]*>\s*#?\s*(\d{1,4})\s*<\/span>/gi;
  const matches=[...source.matchAll(badge)];
  const candidates=[];
  for(let i=0;i<matches.length;i++){
    const rank=Number(matches[i][1]);
    if(!Number.isInteger(rank)||rank<1||rank>1000)continue;
    const start=matches[i].index??0;
    const end=i+1<matches.length?(matches[i+1].index??Math.min(source.length,start+20000)):Math.min(source.length,start+20000);
    const chunk=source.slice(start,end);
    const asin=up(chunk.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?:[/?"'#]|$)/i)?.[1]);
    if(!ASIN.test(asin)){diagnostics.push(`RANK_${rank}_ASIN_NOT_FOUND`);continue;}
    const titleRaw=chunk.match(/class=["'][^"']*(?:p13n-sc-truncate-desktop-type2|_cDEzb_p13n-sc-css-line-clamp)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]
      ??chunk.match(/alt=["']([^"']+)["']/i)?.[1]
      ??null;
    candidates.push({
      sourceKey:'AMAZON_PUBLIC_RANKINGS',platform:'AMAZON',externalId:asin,sourceRank:rank,
      sourceCategoryKey:key,sourceCategoryLabel:txt(categoryLabel)||null,sourceUrl:url,observedAt:at,
      title:titleRaw?stripTags(titleRaw):null,scope:'PUBLIC_RANKING_SURFACE',marketScope:'PUBLIC_RANKING_SURFACE',
      rankEvidenceClass:'EXPLICIT_PUBLIC_RANK_BADGE',evidenceClass:'PUBLIC_RANKING_OBSERVATION',
      demandEvidenceClass:'PUBLIC_RANKING_SIGNAL',salesEvidenceClass:'NOT_VERIFIED_SALES',
      marketWideCountEvidence:false,sellerScoped:false,storeScoped:false,purchaseAuthorized:false
    });
  }

  const seenAsin=new Set(),seenRank=new Set(),observations=[],rejected=[];
  for(const row of candidates){
    if(seenAsin.has(row.externalId)){rejected.push({externalId:row.externalId,sourceRank:row.sourceRank,error:'DUPLICATE_ASIN_IN_RANKING_SURFACE'});continue;}
    if(seenRank.has(row.sourceRank)){rejected.push({externalId:row.externalId,sourceRank:row.sourceRank,error:'DUPLICATE_EXPLICIT_RANK'});continue;}
    seenAsin.add(row.externalId);seenRank.add(row.sourceRank);observations.push(row);
  }
  observations.sort((a,b)=>a.sourceRank-b.sourceRank);
  return{
    ok:observations.length>0,observations,rejected,diagnostics,
    rankEvidenceCount:observations.length,
    policy:'EXPLICIT_RANK_BADGE_ONLY; HTML_POSITION_IS_NOT_RANK; PUBLIC_RANKING_SURFACE_IS_NOT_MARKET_WIDE_COUNT; RANKING_IS_NOT_VERIFIED_SALES',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
}

export function normalizeAmazonRankingSnapshot(row={}){
  const out={
    sourceKey:'AMAZON_PUBLIC_RANKINGS',platform:'AMAZON',externalId:up(row.externalId),
    sourceRank:n(row.sourceRank),sourceCategoryKey:txt(row.sourceCategoryKey),sourceCategoryLabel:txt(row.sourceCategoryLabel)||null,
    sourceUrl:txt(row.sourceUrl),observedAt:iso(row.observedAt),title:txt(row.title)||null,
    scope:'PUBLIC_RANKING_SURFACE',marketScope:'PUBLIC_RANKING_SURFACE',rankEvidenceClass:'EXPLICIT_PUBLIC_RANK_BADGE',
    evidenceClass:'PUBLIC_RANKING_OBSERVATION',demandEvidenceClass:'PUBLIC_RANKING_SIGNAL',salesEvidenceClass:'NOT_VERIFIED_SALES',
    marketWideCountEvidence:false,sellerScoped:false,storeScoped:false,purchaseAuthorized:false,paidCallsTriggered:0
  };
  out.valid=ASIN.test(out.externalId)&&Number.isInteger(out.sourceRank)&&out.sourceRank>0&&Boolean(out.sourceCategoryKey&&out.sourceUrl&&out.observedAt);
  out.id=[out.sourceKey,out.sourceCategoryKey,out.externalId,out.observedAt,out.sourceRank].join('|');
  return out;
}

export function appendAmazonRankingSnapshots(existing=[],incoming=[]){
  const ledger=(existing||[]).map(normalizeAmazonRankingSnapshot).filter(x=>x.valid);
  const ids=new Set(ledger.map(x=>x.id));const appended=[];const rejected=[];
  for(const raw of incoming||[]){
    const row=normalizeAmazonRankingSnapshot(raw);
    if(!row.valid){rejected.push({externalId:row.externalId||null,error:'INVALID_RANKING_SNAPSHOT'});continue;}
    if(ids.has(row.id)){rejected.push({externalId:row.externalId,error:'DUPLICATE_RANKING_SNAPSHOT'});continue;}
    ids.add(row.id);ledger.push(row);appended.push(row);
  }
  ledger.sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.sourceRank-b.sourceRank);
  return{snapshots:ledger,appendedCount:appended.length,rejected,policy:'APPEND_ONLY; EXPLICIT_RANK_ONLY; NO_OVERWRITE; NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false};
}

export function buildAmazonRankingHistory(snapshots=[],{minObservationHours=24}={}){
  const minHours=Math.max(24,Number(minObservationHours)||24);
  const rows=(snapshots||[]).map(normalizeAmazonRankingSnapshot).filter(x=>x.valid);
  const groups=new Map();
  for(const row of rows){const k=`${row.sourceCategoryKey}|${row.externalId}`;const arr=groups.get(k)||[];arr.push(row);groups.set(k,arr);}
  const products=[];
  for(const [key,items] of groups){
    items.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
    const first=items[0],latest=items.at(-1);
    const elapsedHours=items.length>=2?(Date.parse(latest.observedAt)-Date.parse(first.observedAt))/36e5:null;
    const eligible=elapsedHours!==null&&elapsedHours>=minHours;
    const rankImprovement=eligible?first.sourceRank-latest.sourceRank:null;
    const days=eligible?elapsedHours/24:null;
    products.push({
      key,externalId:latest.externalId,sourceCategoryKey:latest.sourceCategoryKey,sourceCategoryLabel:latest.sourceCategoryLabel,
      observationCount:items.length,firstObservedAt:first.observedAt,latestObservedAt:latest.observedAt,
      firstRank:first.sourceRank,latestRank:latest.sourceRank,elapsedHours:elapsedHours===null?null:Number(elapsedHours.toFixed(4)),
      intervalEligible:eligible,rankImprovement,rankVelocityPerDay:eligible?Number((rankImprovement/days).toFixed(4)):null,
      trendEvidenceClass:eligible?'LONGITUDINAL_PUBLIC_RANKING':'SINGLE_OR_SHORT_INTERVAL_RANKING',
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    });
  }
  products.sort((a,b)=>(b.rankVelocityPerDay??-Infinity)-(a.rankVelocityPerDay??-Infinity));
  return{
    productCount:products.length,trendReadyCount:products.filter(x=>x.intervalEligible).length,products,
    policy:'RANK_VELOCITY_REQUIRES_TWO_REAL_EXPLICIT_RANK_OBSERVATIONS_AT_LEAST_24H_APART; POSITIVE_VELOCITY_MEANS_RANK_IMPROVED; RANKING_IS_NOT_SALES',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
}
