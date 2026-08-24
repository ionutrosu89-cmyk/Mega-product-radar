const cleanText=v=>String(v??'').replace(/\s+/g,' ').trim();
const cleanUrl=v=>{const s=cleanText(v);return /^https:\/\//i.test(s)?s:null;};
const finiteOrNull=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};

export const PUBLIC_RANKING_SOURCES=Object.freeze({
  AMAZON_BEST_SELLERS:{platform:'AMAZON',surface:'BEST_SELLERS',access:'PUBLIC_PAGE',cost:'ZERO_PROVIDER_COST',status:'READY_FOR_REVIEWED_COLLECTOR',rankMeaning:'PUBLIC_BEST_SELLER_RANKING',salesMeaning:'NOT_VERIFIED_SALES',autoExecute:false},
  AMAZON_NEW_RELEASES:{platform:'AMAZON',surface:'NEW_RELEASES',access:'PUBLIC_PAGE',cost:'ZERO_PROVIDER_COST',status:'READY_FOR_REVIEWED_COLLECTOR',rankMeaning:'PUBLIC_NEW_RELEASE_RANKING',salesMeaning:'NOT_VERIFIED_SALES',autoExecute:false},
  AMAZON_MOVERS_SHAKERS:{platform:'AMAZON',surface:'MOVERS_AND_SHAKERS',access:'PUBLIC_PAGE',cost:'ZERO_PROVIDER_COST',status:'READY_FOR_REVIEWED_COLLECTOR',rankMeaning:'PUBLIC_RANK_ACCELERATION',salesMeaning:'NOT_VERIFIED_SALES',autoExecute:false},
  EBAY_BEST_SELLING:{platform:'EBAY',surface:'BEST_SELLING',access:'FREE_API_REQUIRES_CREDENTIALS',cost:'NO_PROVIDER_FEE_ASSUMED_ONLY_AFTER_REVALIDATION',status:'OFFICIAL_API_AVAILABLE',rankMeaning:'BEST_SELLING_METRIC',salesMeaning:'NOT_EXACT_SALES_COUNT',autoExecute:false},
  ALIBABA_TOP_RANKING:{platform:'ALIBABA',surface:'TOP_RANKING',access:'PUBLIC_PAGE',cost:'ZERO_PROVIDER_COST',status:'READY_FOR_REVIEWED_COLLECTOR',rankMeaning:'BUYER_REVIEWS_ORDERS_VIEWS_RANKING',salesMeaning:'RANK_SIGNAL_NOT_EXACT_SALES',autoExecute:false},
  ALIEXPRESS_RANKINGS:{platform:'ALIEXPRESS',surface:'RANKINGS',access:'RESEARCH_REQUIRED',cost:'UNKNOWN',status:'NO_STABLE_OFFICIAL_ROUTE_CONFIRMED',rankMeaning:'UNKNOWN',salesMeaning:'UNKNOWN',autoExecute:false},
  ETSY_RANKINGS:{platform:'ETSY',surface:'RANKINGS',access:'RESEARCH_REQUIRED',cost:'UNKNOWN',status:'NO_STABLE_OFFICIAL_ROUTE_CONFIRMED',rankMeaning:'UNKNOWN',salesMeaning:'UNKNOWN',autoExecute:false},
  WALMART_RANKINGS:{platform:'WALMART',surface:'RANKINGS',access:'RESEARCH_REQUIRED',cost:'UNKNOWN',status:'NO_STABLE_OFFICIAL_ROUTE_CONFIRMED',rankMeaning:'UNKNOWN',salesMeaning:'UNKNOWN',autoExecute:false},
  TEMU_RANKINGS:{platform:'TEMU',surface:'RANKINGS',access:'RESEARCH_REQUIRED',cost:'UNKNOWN',status:'NO_STABLE_OFFICIAL_ROUTE_CONFIRMED',rankMeaning:'UNKNOWN',salesMeaning:'UNKNOWN',autoExecute:false}
});

export function publicSourceReadiness(){
  const rows=Object.entries(PUBLIC_RANKING_SOURCES).map(([key,value])=>({key,...value}));
  return {
    readyPublic:rows.filter(x=>x.access==='PUBLIC_PAGE'&&x.status==='READY_FOR_REVIEWED_COLLECTOR'),
    freeApi:rows.filter(x=>x.access==='FREE_API_REQUIRES_CREDENTIALS'),
    research:rows.filter(x=>x.access==='RESEARCH_REQUIRED'),
    paidCallsTriggered:0
  };
}

export function normalizeRankingObservation(input={}){
  const sourceKey=cleanText(input.sourceKey).toUpperCase();
  const policy=PUBLIC_RANKING_SOURCES[sourceKey];
  if(!policy)return{ok:false,error:'UNKNOWN_SOURCE'};
  const externalId=cleanText(input.externalId)||null;
  const url=cleanUrl(input.url);
  const title=cleanText(input.title);
  const observedAt=cleanText(input.observedAt)||null;
  const sourceRank=finiteOrNull(input.sourceRank);
  if(!title)return{ok:false,error:'TITLE_REQUIRED'};
  if(!url&&!externalId)return{ok:false,error:'SOURCE_ID_OR_HTTPS_URL_REQUIRED'};
  if(sourceRank!==null&&(sourceRank<1||!Number.isInteger(sourceRank)))return{ok:false,error:'SOURCE_RANK_INVALID'};
  return {ok:true,record:{
    sourceKey,platform:policy.platform,surface:policy.surface,externalId,url,title,
    brand:cleanText(input.brand)||null,seller:cleanText(input.seller)||null,
    categoryLabel:cleanText(input.categoryLabel)||null,sourceCategoryId:cleanText(input.sourceCategoryId)||null,
    sourceRank,price:finiteOrNull(input.price),currency:cleanText(input.currency).toUpperCase()||null,
    rating:finiteOrNull(input.rating),reviewCount:finiteOrNull(input.reviewCount),
    imageUrl:cleanUrl(input.imageUrl),observedAt,
    evidenceClass:'PUBLIC_RANKING_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',
    rankMeaning:policy.rankMeaning,provenance:{access:policy.access,status:policy.status},
    purchaseAuthorized:false
  }};
}

export function sourceIdentity(record={}){
  const platform=cleanText(record.platform).toUpperCase();
  const id=cleanText(record.externalId);
  if(platform&&id)return`${platform}:ID:${id}`;
  const url=cleanUrl(record.url);if(platform&&url)return`${platform}:URL:${url}`;
  return null;
}

const tokens=v=>new Set(cleanText(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(x=>x.length>2));
const jaccard=(a,b)=>{if(!a.size||!b.size)return 0;let i=0;for(const x of a)if(b.has(x))i++;return i/(a.size+b.size-i);};

export function crossPlatformMatchHint(a={},b={}){
  if(cleanText(a.platform).toUpperCase()===cleanText(b.platform).toUpperCase())return{candidate:false,score:0,reason:'SAME_PLATFORM_USE_SOURCE_ID'};
  const titleScore=jaccard(tokens(a.title),tokens(b.title));
  const brandA=cleanText(a.brand).toLowerCase(),brandB=cleanText(b.brand).toLowerCase();
  const brandMatch=Boolean(brandA&&brandB&&brandA===brandB);
  const score=Math.round((titleScore*80+(brandMatch?20:0))*10)/10;
  return {candidate:score>=82,score,reason:score>=82?'MANUAL_CANONICAL_REVIEW_REQUIRED':'INSUFFICIENT_MATCH',autoMerge:false};
}

export function buildPublicAcquisitionPlan({categoryKeys=[],perSurfaceTarget=100}={}){
  const categories=[...new Set((categoryKeys||[]).map(cleanText).filter(Boolean))];
  const target=Math.max(1,Math.min(1000,Number(perSurfaceTarget)||100));
  const ready=publicSourceReadiness();
  const tasks=[];
  for(const categoryKey of categories){
    for(const source of [...ready.readyPublic,...ready.freeApi])tasks.push({categoryKey,sourceKey:source.key,target,access:source.access,requiresHumanOrCredentialReview:true,executeAutomatically:false});
  }
  return {categoryCount:categories.length,taskCount:tasks.length,tasks,researchQueue:ready.research.map(x=>x.key),policy:'FREE_BREADTH_FIRST_WITH_PROVENANCE',paidCallsTriggered:0,purchaseAuthorized:false};
}
