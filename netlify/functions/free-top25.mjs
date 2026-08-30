import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildFreeTop25LiveUniverse} from '../../free-top25-live-v1.js';
import {enforceRateLimit} from './_security-ops.mjs';

async function fetchJson(fetchImpl,url){
  const response=await fetchImpl(url,{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function readBundledJson(filename){
  const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];
  let lastError=null;
  for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){lastError=error;}}
  throw lastError||new Error(`Bundled source unavailable: ${filename}`);
}
async function loadSource(fetchImpl,requestUrl,filename){
  const url=new URL(`/${filename}`,requestUrl);
  try{return {data:await fetchJson(fetchImpl,url),via:'HTTP'};}catch(httpError){
    try{return {data:await readBundledJson(filename),via:'BUNDLED_FILE'};}catch(fileError){return {data:null,via:'UNAVAILABLE',error:`HTTP:${String(httpError?.message||httpError)}; FILE:${String(fileError?.message||fileError)}`};}
  }
}

export function createFreeTop25Handler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const discovery=await loadSource(fetchImpl,request.url,'discovery-live.json');
      const organic=await loadSource(fetchImpl,request.url,'organic-rising-live.json');
      if(!discovery.data&&!organic.data)return Response.json({ok:false,error:'Free Top25 live sources unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const universe=buildFreeTop25LiveUniverse({
        discoveryProducts:Array.isArray(discovery.data?.products)?discovery.data.products:[],
        organicProducts:Array.isArray(organic.data?.products)?organic.data.products:[]
      });
      return Response.json({
        ok:true,
        ...universe,
        sourceDiagnostics:{discovery:discovery.via,organic:organic.via},
        updatedAt:[discovery.data?.updatedAt,organic.data?.updatedAt].filter(Boolean).sort().at(-1)||null
      },{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createFreeTop25Handler();
export const config={path:'/api/free/top25',method:'GET'};
