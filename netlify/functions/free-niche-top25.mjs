import {readFile} from 'node:fs/promises';
import path from 'node:path';
import taxonomy from '../../category-universe-v2.json' with {type:'json'};
import {buildFreeNicheTop25Plan} from '../../free-niche-top25-engine-v1.js';
import {enforceRateLimit} from './_security-ops.mjs';

async function readJson(filename){
  const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];
  for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch{}}
  return null;
}
const approved=env=>String(env.MPR_FREE_LIVE_NICHES_APPROVED||'').toLowerCase()==='true';

export function createFreeNicheTop25Handler({env=process.env,fetch:fetchImpl=fetch}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-niche-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});

      // PUBLIC FREE BETA is historical licensed evidence only. Dynamic live niche evidence is
      // disabled by default because a public URL or collector output is not itself a right to
      // redistribute that marketplace data. This route opens only after an explicit server-side
      // rights approval; the approved historical 25x25 experience remains /api/free/top25.
      if(!approved(env))return Response.json({
        ok:false,
        code:'FREE_LIVE_NICHES_RIGHTS_HOLD',
        error:'Live niche intelligence is not approved for public Free redistribution.',
        publicAlternative:'/api/free/top25'
      },{status:503,headers:{'Cache-Control':'no-store'}});

      const url=new URL(request.url);
      const [discovery,organic,amazonLive]=await Promise.all([
        readJson('discovery-live.json'),
        readJson('organic-rising-live.json'),
        readJson('amazon-live-catalog-bridge-v1.json')
      ]);
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
