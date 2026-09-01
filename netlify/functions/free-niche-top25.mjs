import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildFreeNicheTop25Plan} from '../../free-niche-top25-engine-v1.js';
import {enforceRateLimit} from './_security-ops.mjs';

async function readJson(filename){
  const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];
  for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch{}}
  return null;
}

export function createFreeNicheTop25Handler({env=process.env,fetch:fetchImpl=fetch}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-niche-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const url=new URL(request.url);
      const [taxonomy,discovery,organic,amazonLive]=await Promise.all([
        readJson('category-universe-v2.json'),
        readJson('discovery-live.json'),
        readJson('organic-rising-live.json'),
        readJson('amazon-live-catalog-bridge-v1.json')
      ]);
      if(!taxonomy)return Response.json({ok:false,error:'Free niche taxonomy unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const plan=buildFreeNicheTop25Plan({
        taxonomy,
        discoveryProducts:Array.isArray(discovery?.products)?discovery.products:[],
        organicProducts:Array.isArray(organic?.products)?organic.products:[],
        amazonLiveProducts:Array.isArray(amazonLive?.products)?amazonLive.products:[]
      },{query:url.searchParams.get('q'),niche:url.searchParams.get('niche')});
      return Response.json({ok:true,...plan,updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createFreeNicheTop25Handler();
export const config={path:'/api/free/niches',method:'GET'};
