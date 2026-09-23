import {FREE_TOP25_LIVE_TAXONOMY,validateFreeTop25LiveTaxonomy} from '../../free-top25-live-taxonomy-v1.js';
import {enforceRateLimit} from './_security-ops.mjs';

const publicNiche=niche=>({
  id:niche.id,
  label:niche.label,
  emoji:niche.emoji,
  mode:'LIVE_ONLY',
  publishedProductCount:0,
  products:[]
});

export function buildLiveOnlyTop25Catalogue(){
  const validation=validateFreeTop25LiveTaxonomy();
  if(!validation.ok)throw new Error('Top25 taxonomy is invalid');
  return {
    schema:'MPR_FREE_TOP25_LIVE_ONLY_V1',
    mode:'LIVE_ONLY',
    niches:FREE_TOP25_LIVE_TAXONOMY.map(publicNiche),
    stats:{configuredNicheCount:validation.nicheCount,targetPositions:validation.targetPositions,publishedNicheCount:0,publishedProductCount:0},
    updatedAt:null,
    policy:{historicalFallback:false,exactly25Required:true,freshnessRequired:true,publicDisplayRightsRequired:true}
  };
}

export function createFreeTop25Handler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      return Response.json({ok:true,...buildLiveOnlyTop25Catalogue()},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch{
      return Response.json({ok:false,error:'Top25 catalogue unavailable'},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createFreeTop25Handler();
export const config={path:'/api/free/top25',method:'GET'};
