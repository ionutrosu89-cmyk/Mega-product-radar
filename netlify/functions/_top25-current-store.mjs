import {SAAS_CONFIG} from '../../saas-config.js';

const clean=value=>String(value??'').trim();
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'});

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
