import {timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {SAAS_CONFIG} from '../../saas-config.js';

const clean=value=>String(value??'').trim();
const enabled=value=>clean(value).toLowerCase()==='true';
const equal=(left,right)=>{
  const a=Buffer.from(clean(left)),b=Buffer.from(clean(right));
  return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);
};
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const allowedKey=key=>/^(?:candidates|receipts|budget)\/\d{4}-\d{2}-\d{2}(?:\/[A-Z0-9_]+)?$/.test(key);

function snapshotUrl(env){
  const base=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
  if(!base||!clean(env.SUPABASE_SERVICE_ROLE_KEY))return null;
  const url=new URL(`${base}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('source_key','eq.KEEPA_BEST_SELLERS');
  url.searchParams.set('select','id');
  return url;
}

async function snapshotCount({env,fetchImpl}){
  const url=snapshotUrl(env);
  if(!url)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  const response=await fetchImpl(url,{method:'HEAD',headers:{apikey:service,authorization:`Bearer ${service}`,prefer:'count=exact'}});
  if(!response.ok)return {ok:false,code:'SNAPSHOT_COUNT_FAILED'};
  const range=response.headers.get('content-range');
  const match=/\/(\d+)$/.exec(range||'');
  if(!match)return {ok:false,code:'SNAPSHOT_COUNT_UNKNOWN'};
  return {ok:true,count:Number(match[1])};
}

async function inspect({env,fetchImpl,store}){
  const [snapshotResult,listing]=await Promise.all([snapshotCount({env,fetchImpl}),store.list()]);
  if(!snapshotResult.ok)return snapshotResult;
  if(!Array.isArray(listing?.blobs))return {ok:false,code:'BLOB_LIST_FAILED'};
  const allKeys=listing.blobs.map(row=>row?.key);
  if(allKeys.some(key=>typeof key!=='string'))return {ok:false,code:'BLOB_LIST_FAILED'};
  const keys=allKeys.filter(key=>key!=='control/purge-lock');
  return {ok:true,snapshotCount:snapshotResult.count,blobCount:keys.length,unexpectedKeys:keys.filter(key=>!allowedKey(key)).length,keys};
}

export function createKeepaPurgeHandler({env=process.env,fetchImpl=fetch,storeFactory=()=>getStore({name:'mpr-keepa-private',consistency:'strong'})}={}){
  return async request=>{
    if(request.method!=='POST')return reply({ok:false,status:'METHOD_NOT_ALLOWED'},405);
    if(!equal(request.headers.get('x-mpr-internal-secret'),env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET))return reply({ok:false,status:'UNAUTHORIZED'},401);
    let body;try{body=await request.json();}catch{return reply({ok:false,status:'INVALID_JSON'},400);}
    const mode=clean(body?.mode).toUpperCase();
    if(!['DRY_RUN','EXECUTE'].includes(mode))return reply({ok:false,status:'INVALID_MODE'},400);
    if(mode==='EXECUTE'&&(!enabled(env.MPR_KEEPA_PURGE_ENABLED)||clean(env.CONTEXT)!=='production'||enabled(env.MPR_KEEPA_SUBSCRIPTION_ACTIVE)||enabled(env.MPR_KEEPA_COLLECTION_ENABLED)||enabled(env.MPR_PAID_PROVIDER_CALLS_ENABLED)))return reply({ok:false,status:'PURGE_DISABLED'},409);
    if(mode==='EXECUTE'&&body?.confirmation!=='DELETE_KEEPA_DATA')return reply({ok:false,status:'CONFIRMATION_REQUIRED'},409);
    try{
      const store=storeFactory();
      const before=await inspect({env,fetchImpl,store});
      if(!before.ok)return reply({ok:false,status:before.code},503);
      const summary={blobCount:before.blobCount,snapshotCount:before.snapshotCount,unexpectedKeys:before.unexpectedKeys};
      if(mode==='DRY_RUN')return reply({ok:true,status:'DRY_RUN',...summary});
      if(before.unexpectedKeys)return reply({ok:false,status:'UNEXPECTED_STORE_KEYS',...summary},409);
      if(body.expectedBlobCount!==before.blobCount||body.expectedSnapshotCount!==before.snapshotCount)return reply({ok:false,status:'INVENTORY_CHANGED',...summary},409);
      const lock=await store.setJSON('control/purge-lock',{state:'LOCKED'},{onlyIfNew:true});
      if(lock.modified!==true){
        const existing=await store.get('control/purge-lock',{type:'json',consistency:'strong'});
        if(existing?.state!=='LOCKED')return reply({ok:false,status:'INVALID_PURGE_LOCK'},409);
      }
      const lockedInventory=await inspect({env,fetchImpl,store});
      if(!lockedInventory.ok||lockedInventory.blobCount!==before.blobCount||lockedInventory.snapshotCount!==before.snapshotCount||lockedInventory.unexpectedKeys)return reply({ok:false,status:'INVENTORY_CHANGED_AFTER_LOCK'},409);
      const url=snapshotUrl(env),service=env.SUPABASE_SERVICE_ROLE_KEY;
      const deleted=await fetchImpl(url,{method:'DELETE',headers:{apikey:service,authorization:`Bearer ${service}`,prefer:'return=minimal'}});
      if(!deleted.ok)return reply({ok:false,status:'SNAPSHOT_DELETE_FAILED',...summary},503);
      for(const key of before.keys)await store.delete(key);
      const after=await inspect({env,fetchImpl,store});
      if(!after.ok||after.snapshotCount!==0||after.blobCount!==0)return reply({ok:false,status:'PURGE_NOT_VERIFIED',remainingBlobCount:after.blobCount??null,remainingSnapshotCount:after.snapshotCount??null},503);
      return reply({ok:true,status:'PURGE_VERIFIED',deletedBlobCount:before.blobCount,deletedSnapshotCount:before.snapshotCount,remainingBlobCount:0,remainingSnapshotCount:0});
    }catch{return reply({ok:false,status:'PURGE_OR_VERIFICATION_FAILED'},503);}
  };
}

export default createKeepaPurgeHandler();
export const config={path:'/api/internal/keepa-purge',method:'POST'};

