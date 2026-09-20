import {FREE_TOP25_LIVE_TAXONOMY_BY_ID} from './free-top25-live-taxonomy-v1.js';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const https=value=>{try{return new URL(clean(value)).protocol==='https:';}catch{return false;}};
const PLATFORM_POLICY=Object.freeze({
  EBAY:{markets:new Set(['EBAY_US','EBAY_DE']),sourceKeys:new Set(['EBAY_BUY_MARKETING_BEST_SELLING']),rankingBasis:'BEST_SELLING',freshnessHours:72,host:/^(?:www\.)?ebay\.(?:com|de)$/i},
  AMAZON_US:{markets:new Set(['AMAZON_US']),sourceKeys:new Set(['AMAZON_CREATORS_API','KEEPA_BEST_SELLERS']),rankingBasis:'OFFICIAL_RANK_OR_BSR',freshnessHours:72,host:/^(?:www\.)?amazon\.com$/i},
  AMAZON_DE:{markets:new Set(['AMAZON_DE']),sourceKeys:new Set(['AMAZON_CREATORS_API','KEEPA_BEST_SELLERS']),rankingBasis:'OFFICIAL_RANK_OR_BSR',freshnessHours:72,host:/^(?:www\.)?amazon\.de$/i},
  ALIEXPRESS:{markets:new Set(['ALIEXPRESS_GLOBAL']),sourceKeys:new Set(['ALIEXPRESS_HOT_PRODUCTS_API']),rankingBasis:'HOT_PRODUCTS',freshnessHours:72,host:/^(?:[a-z]{2}\.)?(?:www\.)?aliexpress\.com$/i}
});

function normalizeProduct(raw,index,{platform,market,sourceKey,rankingBasis,nowMs,freshnessHours}){
  const name=clean(raw?.name||raw?.title).slice(0,220);
  const externalId=clean(raw?.externalId||raw?.asin||raw?.productId).slice(0,120);
  const sourceUrl=clean(raw?.sourceUrl).slice(0,500);
  const observedAt=iso(raw?.observedAt);
  const rank=Number(raw?.rank);
  if(!name||!externalId||rank!==index+1||!https(sourceUrl)||!observedAt)return null;
  const parsedUrl=new URL(sourceUrl);
  const policy=PLATFORM_POLICY[platform];
  if(policy.host&&!policy.host.test(parsedUrl.hostname))return null;
  const ageMs=nowMs-Date.parse(observedAt);
  if(ageMs<0||ageMs>freshnessHours*3_600_000)return null;
  const price=Number(raw?.price),rating=Number(raw?.rating),reviewCount=Number(raw?.reviewCount);
  return {
    name,externalId,rank,platform,market,sourceUrl,observedAt,sourceKey,
    sourceLabel:clean(raw?.sourceLabel).slice(0,160)||sourceKey,
    rankingBasis,
    conceptKey:upper(raw?.conceptKey||raw?.canonicalProductId).slice(0,160)||null,
    price:Number.isFinite(price)&&price>=0?price:null,
    currency:upper(raw?.currency).slice(0,8)||null,
    rating:Number.isFinite(rating)&&rating>=0&&rating<=5?rating:null,
    reviewCount:Number.isInteger(reviewCount)&&reviewCount>=0?reviewCount:null,
    sourceMetric:raw?.sourceMetric&&typeof raw.sourceMetric==='object'?raw.sourceMetric:null,
    evidenceClass:['DIRECT','LICENSED'].includes(upper(raw?.evidenceClass))?upper(raw.evidenceClass):'DIRECT',
    salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES',
    commercialGate:clean(raw?.commercialGate).slice(0,80)||'BRAND_REVIEW_REQUIRED'
  };
}

export function publicDisplayApprovalKey(platform){
  const key=upper(platform);
  if(key.startsWith('AMAZON_'))return 'MPR_AMAZON_PUBLIC_DISPLAY_APPROVED';
  return `MPR_${key}_PUBLIC_DISPLAY_APPROVED`;
}

export function normalizeCurrentTop25Snapshot(raw={},options={}){
  const now=options.now instanceof Date?options.now:new Date(options.now||Date.now());
  const nowMs=now.getTime();
  const nicheId=upper(raw.nicheId||raw.niche_id),platform=upper(raw.platform),market=upper(raw.market),sourceKey=upper(raw.sourceKey||raw.source_key);
  const policy=PLATFORM_POLICY[platform];
  if(!FREE_TOP25_LIVE_TAXONOMY_BY_ID.has(nicheId))return {ok:false,code:'NICHE_NOT_ALLOWED'};
  if(!policy)return {ok:false,code:'PLATFORM_NOT_ALLOWED'};
  if(!policy.markets.has(market))return {ok:false,code:'MARKET_NOT_ALLOWED'};
  if(!policy.sourceKeys.has(sourceKey))return {ok:false,code:'SOURCE_NOT_ALLOWED'};
  if(options.rightsApproved!==true)return {ok:false,code:'PUBLIC_DISPLAY_RIGHTS_REQUIRED'};
  const source=Array.isArray(raw.products)?raw.products:[];
  if(source.length!==25)return {ok:false,code:'EXACTLY_25_PRODUCTS_REQUIRED'};
  const products=source.map((row,index)=>normalizeProduct(row,index,{platform,market,sourceKey,rankingBasis:policy.rankingBasis,nowMs,freshnessHours:policy.freshnessHours}));
  if(products.some(row=>!row))return {ok:false,code:'INVALID_OR_STALE_PRODUCT'};
  if(new Set(products.map(row=>row.externalId)).size!==25)return {ok:false,code:'DUPLICATE_EXTERNAL_ID'};
  const windowEnd=products.map(row=>row.observedAt).sort().at(-1);
  return {ok:true,code:'READY',snapshot:{
    niche_id:nicheId,platform,market,window_days:7,window_end:windowEnd,products,product_count:25,
    evidence_class:products.every(row=>row.evidenceClass==='DIRECT')?'DIRECT':'DERIVED',
    source_key:sourceKey,source_label:clean(raw.sourceLabel||raw.source_label).slice(0,160)||products[0].sourceLabel,
    source_rights_status:'APPROVED',freshness_status:'CURRENT'
  }};
}

export function currentTop25Coverage(rows=[]){
  const complete=(Array.isArray(rows)?rows:[]).filter(row=>row?.product_count===25&&row?.source_rights_status==='APPROVED'&&row?.freshness_status==='CURRENT');
  const niches=new Set(complete.map(row=>upper(row.niche_id)));
  const byPlatform=Object.fromEntries([...new Set(complete.map(row=>upper(row.platform)))].sort().map(platform=>[platform,complete.filter(row=>upper(row.platform)===platform).length]));
  return {completeSnapshotCount:complete.length,coveredNicheCount:niches.size,targetNicheCount:25,coveredPositions:complete.length*25,allNichesCovered:niches.size===25,byPlatform};
}

export const CURRENT_TOP25_PLATFORM_POLICY=PLATFORM_POLICY;
