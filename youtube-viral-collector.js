import {normalizeViralObservation} from './viral-collector-contract.js';

const API='https://www.googleapis.com/youtube/v3';
export function buildYouTubeQueryPlan(concepts,{markets=['US','GB'],maxQueries=20,publishedAfter}={}){
  const cap=Math.max(1,Math.min(20,Number(maxQueries)||20));
  const after=publishedAfter||new Date(Date.now()-14*86400000).toISOString();
  return concepts.flatMap(c=>markets.map(m=>({conceptName:c.conceptName,category:c.category||null,brandPolicyClass:c.brandPolicyClass||'UNKNOWN_REVIEW',query:(c.searchTerms?.[0]||c.conceptName),market:m,publishedAfter:after}))).slice(0,cap);
}

export async function collectYouTubeSignals(plan,{apiKey,fetchImpl=fetch,termsApproved=false,sourceEnabled=false,observedAt=new Date().toISOString()}={}){
  if(!termsApproved)return held('YOUTUBE_TERMS_APPROVAL_REQUIRED',plan);
  if(!sourceEnabled)return held('YOUTUBE_SOURCE_DISABLED',plan);
  if(!apiKey)return held('YOUTUBE_API_KEY_REQUIRED',plan);
  const observations=[];let apiCalls=0;
  for(const item of plan){
    const search=new URL(`${API}/search`);search.search=new URLSearchParams({key:apiKey,part:'snippet',type:'video',maxResults:'10',order:'date',q:item.query,regionCode:item.market,publishedAfter:item.publishedAfter}).toString();
    const searchPayload=await requestJson(search,fetchImpl);apiCalls++;
    const ids=(searchPayload.items||[]).map(x=>x.id?.videoId).filter(Boolean);
    if(!ids.length)continue;
    const videos=new URL(`${API}/videos`);videos.search=new URLSearchParams({key:apiKey,part:'snippet,statistics',id:ids.join(',')}).toString();
    const payload=await requestJson(videos,fetchImpl);apiCalls++;
    for(const video of payload.items||[]){
      observations.push(normalizeViralObservation({platform:'YOUTUBE',countryCode:item.market,externalId:video.id,sourceUrl:`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,observedAt,conceptName:item.conceptName,category:item.category,brandPolicyClass:item.brandPolicyClass,evidenceClass:'DIRECT',title:video.snippet?.title,metrics:{viewCount:video.statistics?.viewCount,engagementCount:(Number(video.statistics?.likeCount)||0)+(Number(video.statistics?.commentCount)||0)}},{termsApproved,enabled:sourceEnabled}));
    }
  }
  return {schema:'MPR_YOUTUBE_VIRAL_COLLECTION_V1',status:'COMPLETED',plannedQueries:plan.length,apiCalls,observations,policy:{maxQueries:20,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};
}

async function requestJson(url,fetchImpl){
  const response=await fetchImpl(url,{headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`YOUTUBE_API_${response.status}`);
  return response.json();
}
function held(reason,plan){return {schema:'MPR_YOUTUBE_VIRAL_COLLECTION_V1',status:'HELD',reason,plannedQueries:plan.length,apiCalls:0,observations:[],policy:{maxQueries:20,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};}
