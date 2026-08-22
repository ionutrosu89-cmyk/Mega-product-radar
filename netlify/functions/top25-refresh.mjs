import {SAAS_CONFIG} from '../../saas-config.js';
import {FREE_TOP25_NICHES} from '../../free-top25-data.js';
import {buildRefreshedTop25Snapshot,snapshotsEvidenceChanged,uniqueTop25Sources} from '../../top25-refresh-core.js';

function headers(serviceRole){
  return {apikey:serviceRole,authorization:`Bearer ${serviceRole}`,'content-type':'application/json',accept:'application/json'};
}

function todayUtc(){return new Date().toISOString().slice(0,10);}

async function fetchSource(source,fetchImpl){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetchImpl(source.url,{
      signal:controller.signal,
      redirect:'follow',
      headers:{accept:'text/html,application/xhtml+xml','user-agent':'MegaProductRadar/1.0 (+public-source-refresh)'}
    });
    if(!response.ok)return {...source,ok:false,status:response.status,html:''};
    const type=String(response.headers.get('content-type')||'');
    if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))return {...source,ok:false,status:415,html:''};
    const html=await response.text();
    return {...source,ok:true,status:response.status,html:html.slice(0,2_500_000)};
  }catch(error){
    return {...source,ok:false,status:0,error:String(error?.name||error?.message||error),html:''};
  }finally{clearTimeout(timeout);}
}

async function latestSnapshot(supabaseUrl,serviceRole,nicheId,fetchImpl){
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('select','niche_id,reviewed_at,products');
  url.searchParams.set('niche_id',`eq.${nicheId}`);
  url.searchParams.set('order','reviewed_at.desc');
  url.searchParams.set('limit','1');
  const response=await fetchImpl(url,{headers:headers(serviceRole)});
  if(!response.ok)throw new Error(`Snapshot read failed ${response.status}`);
  return (await response.json())?.[0]||null;
}

async function insertSnapshot(supabaseUrl,serviceRole,snapshot,fetchImpl){
  const response=await fetchImpl(`${supabaseUrl}/rest/v1/top25_snapshots?on_conflict=niche_id,reviewed_at`,{
    method:'POST',
    headers:{...headers(serviceRole),Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({niche_id:snapshot.nicheId,reviewed_at:snapshot.reviewedAt,products:snapshot.products})
  });
  if(!response.ok)throw new Error(`Snapshot write failed ${response.status}`);
}

async function insertRun(supabaseUrl,serviceRole,row,fetchImpl){
  const response=await fetchImpl(`${supabaseUrl}/rest/v1/top25_refresh_runs`,{
    method:'POST',headers:{...headers(serviceRole),Prefer:'return=minimal'},body:JSON.stringify(row)
  });
  if(!response.ok)throw new Error(`Refresh audit write failed ${response.status}`);
}

export function createTop25RefreshHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async ()=>{
    const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
    const serviceRole=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl||!serviceRole)throw new Error('Supabase service role is not configured');

    const sources=uniqueTop25Sources(FREE_TOP25_NICHES);
    const fetched=await Promise.all(sources.map(source=>fetchSource(source,fetchImpl)));
    const sourceDocuments=new Map(fetched.map(row=>[row.key,row]));
    const sourcesOk=fetched.filter(row=>row.ok).length;
    let nichesChanged=0;
    const changed=[];
    const reviewedAt=todayUtc();

    for(const niche of FREE_TOP25_NICHES){
      const snapshot=buildRefreshedTop25Snapshot(niche,reviewedAt,sourceDocuments);
      const previous=await latestSnapshot(supabaseUrl,serviceRole,niche.id,fetchImpl);
      const normalizedPrevious=previous?{nicheId:previous.niche_id,reviewedAt:previous.reviewed_at,products:previous.products}:null;
      if(snapshotsEvidenceChanged(snapshot,normalizedPrevious)){
        await insertSnapshot(supabaseUrl,serviceRole,snapshot,fetchImpl);
        nichesChanged++;
        changed.push(niche.id);
      }
    }

    const status=sourcesOk===sources.length?'SUCCESS':sourcesOk>0?'PARTIAL':'FAILED';
    await insertRun(supabaseUrl,serviceRole,{
      status,
      sources_checked:sources.length,
      sources_ok:sourcesOk,
      niches_changed:nichesChanged,
      details:{changed_niches:changed,source_status:fetched.map(({key,url,ok,status})=>({key,url,ok,status}))}
    },fetchImpl);

    console.log(`Top25 refresh ${status}: ${sourcesOk}/${sources.length} sources, ${nichesChanged} niches changed`);
    return new Response(null,{status:204});
  };
}

export default createTop25RefreshHandler();
export const config={schedule:'15 5 * * *'};
