import {SAAS_CONFIG} from '../../saas-config.js';
import {FREE_TOP25_REFRESH_DAYS} from '../../free-cross-market-registry.js';

const clean=value=>String(value??'').trim();
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'});
const DAY_MS=86_400_000;

export async function dueCurrentTop25Targets({env=process.env,fetchImpl=fetch,platform,targets=[],now=new Date()}={}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl),service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED',dueTargets:[]};
  const checkedAt=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(checkedAt.getTime())||!['EBAY','ALIEXPRESS'].includes(platform)||!Array.isArray(targets))return {ok:false,code:'INVALID_REFRESH_TARGETS',dueTargets:[]};
  const cutoff=checkedAt.getTime()-FREE_TOP25_REFRESH_DAYS*DAY_MS;
  const url=new URL(`${supabaseUrl}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('select','niche_id,market,window_end,products');
  url.searchParams.set('platform',`eq.${platform}`);
  url.searchParams.set('product_count','eq.25');
  url.searchParams.set('source_rights_status','eq.APPROVED');
  url.searchParams.set('freshness_status','eq.CURRENT');
  url.searchParams.set('window_end',`gte.${new Date(cutoff).toISOString()}`);
  url.searchParams.set('limit','1000');
  const response=await fetchImpl(url,{headers:serviceHeaders(service)});
  if(!response.ok)return {ok:false,code:`SUPABASE_HTTP_${response.status}`,dueTargets:[]};
  let rows;
  try{rows=await response.json();}catch{return {ok:false,code:'INVALID_REFRESH_READ',dueTargets:[]};}
  if(!Array.isArray(rows)||rows.length>=1000)return {ok:false,code:'INCOMPLETE_REFRESH_READ',dueTargets:[]};
  const fresh=new Set();
  for(const row of rows){
    const products=Array.isArray(row?.products)?row.products:[];
    if(products.length!==25)continue;
    const ids=new Set(products.map(product=>clean(product?.externalId)));
    if(ids.size!==25||ids.has('')||products.some((product,index)=>Number(product?.rank)!==index+1||!clean(product?.name)))continue;
    const times=products.map(product=>Date.parse(product?.observedAt||''));
    if(times.some(time=>!Number.isFinite(time)||time>checkedAt.getTime()||time<=cutoff))continue;
    fresh.add(`${row.niche_id}:${row.market}`);
  }
  const dueTargets=targets.filter(target=>!fresh.has(`${target.nicheId}:${target.marketplaceId||'ALIEXPRESS_GLOBAL'}`));
  return {ok:true,code:dueTargets.length?'REFRESH_DUE':'NOT_DUE',dueTargets,refreshTargetDays:FREE_TOP25_REFRESH_DAYS};
}

export async function persistCurrentTop25Snapshot({env=process.env,fetchImpl=fetch,snapshot}={}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl),service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const url=new URL(`${supabaseUrl}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('on_conflict','niche_id,platform,market,window_days,window_end');
  const response=await fetchImpl(url,{method:'POST',headers:serviceHeaders(service),body:JSON.stringify([snapshot])});
  return response.ok?{ok:true,code:'PERSISTED'}:{ok:false,code:`SUPABASE_HTTP_${response.status}`};
}

export async function markExpiredCurrentTop25Snapshots({env=process.env,fetchImpl=fetch,cutoff}={}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl),service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const parsed=cutoff instanceof Date?cutoff:new Date(cutoff);
  if(!Number.isFinite(parsed.getTime()))return {ok:false,code:'INVALID_CUTOFF'};
  const url=new URL(`${supabaseUrl}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('freshness_status','eq.CURRENT');
  url.searchParams.set('window_end',`lt.${parsed.toISOString()}`);
  const response=await fetchImpl(url,{method:'PATCH',headers:serviceHeaders(service),body:JSON.stringify({freshness_status:'STALE'})});
  return response.ok?{ok:true,code:'EXPIRED_ROWS_MARKED_STALE'}:{ok:false,code:`SUPABASE_HTTP_${response.status}`};
}
