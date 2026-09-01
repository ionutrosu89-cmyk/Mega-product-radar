import {normalizeViralObservation} from './viral-collector-contract.js';
const ENDPOINT='https://open.tiktokapis.com/v2/research/adlib/ad/query/';

export function buildTikTokCommercialPlan(concepts,{markets=['DE','FR','IT','ES','PL'],maxQueries=10,minDate,maxDate}={}){
  const end=maxDate||dateKey(new Date()),start=minDate||dateKey(new Date(Date.now()-14*86400000));
  return concepts.flatMap(c=>markets.map(m=>({conceptName:c.conceptName,category:c.category||null,brandPolicyClass:c.brandPolicyClass||'UNKNOWN_REVIEW',searchTerm:String(c.searchTerms?.[0]||c.conceptName).slice(0,50),market:m,minDate:start,maxDate:end}))).slice(0,Math.max(1,Math.min(10,Number(maxQueries)||10)));
}

export async function collectTikTokCommercialSignals(plan,{accessToken,termsApproved=false,sourceEnabled=false,fetchImpl=fetch,observedAt=new Date().toISOString()}={}){
  if(!termsApproved)return held('TIKTOK_COMMERCIAL_TERMS_APPROVAL_REQUIRED',plan);
  if(!sourceEnabled)return held('TIKTOK_COMMERCIAL_SOURCE_DISABLED',plan);
  if(!accessToken)return held('TIKTOK_COMMERCIAL_ACCESS_TOKEN_REQUIRED',plan);
  const observations=[];let apiCalls=0;
  for(const item of plan){
    const url=`${ENDPOINT}?fields=ad.id,ad.first_shown_date,ad.last_shown_date,ad.status,ad.reach,advertiser.business_name`;
    const body={filters:{ad_published_date_range:{min:item.minDate,max:item.maxDate},country_code:item.market},search_term:item.searchTerm,search_type:'fuzzy_phrase',max_count:20};
    const res=await fetchImpl(url,{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(body)});apiCalls++;
    if(!res.ok)throw new Error(`TIKTOK_COMMERCIAL_API_${res.status}`);
    const payload=await res.json();if(payload.error?.code&&payload.error.code!=='ok')throw new Error(`TIKTOK_COMMERCIAL_${payload.error.code}`);
    for(const row of payload.data?.ads||[]){const ad=row.ad||{},advertiser=row.advertiser||{};if(!ad.id)continue;
      observations.push(normalizeViralObservation({platform:'TIKTOK',countryCode:item.market,externalId:String(ad.id),sourceUrl:url,observedAt,conceptName:item.conceptName,category:item.category,detectedBrand:advertiser.business_name||null,brandPolicyClass:item.brandPolicyClass,evidenceClass:'DIRECT',title:`TikTok commercial content: ${item.searchTerm}`,metrics:{viewCount:parseReachLowerBound(ad.reach?.unique_users_seen),activeAdCount:ad.status==='active'?1:0}},{termsApproved,enabled:sourceEnabled}));
    }
  }
  return {schema:'MPR_TIKTOK_COMMERCIAL_COLLECTION_V1',status:'COMPLETED',plannedQueries:plan.length,apiCalls,observations,paginationFollowed:false,policy:{maxQueries:10,maxResultsPerQuery:20,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};
}
export function parseReachLowerBound(value){const s=String(value||'').trim().toUpperCase();const first=s.split('-')[0].trim();const m=first.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);if(!m)return undefined;const mult={K:1e3,M:1e6,B:1e9}[m[2]]||1;return Math.floor(Number(m[1])*mult);}
function dateKey(d){return d.toISOString().slice(0,10).replaceAll('-','');}
function held(reason,plan){return {schema:'MPR_TIKTOK_COMMERCIAL_COLLECTION_V1',status:'HELD',reason,plannedQueries:plan.length,apiCalls:0,observations:[],policy:{maxQueries:10,maxResultsPerQuery:20,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};}
