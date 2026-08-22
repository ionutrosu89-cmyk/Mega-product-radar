import {SAAS_CONFIG} from '../../saas-config.js';
import {FREE_TOP25_NICHES} from '../../free-top25-data.js';
import {TOP25_EVIDENCE_REVIEWED_AT} from '../../top25-evidence.js';
import {buildTop25Snapshot} from '../../top25-movement.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});

function supabaseHeaders(serviceRole){
  return {
    apikey:serviceRole,
    authorization:`Bearer ${serviceRole}`,
    'content-type':'application/json',
    accept:'application/json'
  };
}

function normalizeRows(rows=[]){
  return (Array.isArray(rows)?rows:[]).map(row=>({
    nicheId:String(row.niche_id||''),
    reviewedAt:String(row.reviewed_at||''),
    products:Array.isArray(row.products)?row.products:[]
  }));
}

export function createTop25HistoryHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(request.method!=='GET') return json({ok:false,error:'Method not allowed'},405);
      const url=new URL(request.url);
      const nicheId=String(url.searchParams.get('niche')||'').trim();
      const niche=FREE_TOP25_NICHES.find(item=>item.id===nicheId);
      if(!niche) return json({ok:false,error:'Unknown niche'},400);

      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const serviceRole=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!supabaseUrl||!serviceRole) return json({ok:false,error:'Central history unavailable',fallback:'LOCAL'},503);

      const headers=supabaseHeaders(serviceRole);
      const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
      const historyUrl=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
      historyUrl.searchParams.set('select','niche_id,reviewed_at,products');
      historyUrl.searchParams.set('niche_id',`eq.${current.nicheId}`);
      historyUrl.searchParams.set('order','reviewed_at.desc');
      historyUrl.searchParams.set('limit','2');

      const historyResponse=await fetchImpl(historyUrl,{headers});
      if(!historyResponse.ok) return json({ok:false,error:'Snapshot read failed',fallback:'LOCAL'},502);
      let snapshots=normalizeRows(await historyResponse.json());
      const currentSnapshot=snapshots.find(row=>row.reviewedAt===current.reviewedAt)||null;

      if(!currentSnapshot){
        const insertUrl=`${supabaseUrl}/rest/v1/top25_snapshots?on_conflict=niche_id,reviewed_at`;
        const upsert=await fetchImpl(insertUrl,{
          method:'POST',
          headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({niche_id:current.nicheId,reviewed_at:current.reviewedAt,products:current.products})
        });
        if(!upsert.ok) return json({ok:false,error:'Snapshot write failed',fallback:'LOCAL'},502);
        snapshots=[current,...snapshots.filter(row=>row.reviewedAt!==current.reviewedAt)].slice(0,2);
      }

      const resolvedCurrent=snapshots.find(row=>row.reviewedAt===current.reviewedAt)||current;
      const previous=snapshots.find(row=>row.reviewedAt!==current.reviewedAt)||null;

      return json({
        ok:true,
        mode:'CENTRAL',
        current:resolvedCurrent,
        previous,
        previousReviewedAt:previous?.reviewedAt||null
      });
    }catch(error){
      return json({ok:false,error:String(error?.message||error),fallback:'LOCAL'},500);
    }
  };
}

export default createTop25HistoryHandler();
export const config={path:'/api/top25/history',method:'GET'};
