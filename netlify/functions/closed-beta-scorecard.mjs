import {SAAS_CONFIG} from '../../saas-config.js';
import {buildFreeBetaScorecardV1} from '../../free-beta-scorecard-v1.js';
import {isAnalyticsAdmin} from './beta-analytics.mjs';

async function jsonFetch(url,headers,fetchImpl){const response=await fetchImpl(url,{headers});if(!response.ok)throw new Error(`Closed beta source failed: ${response.status}`);return response.json();}

export function createClosedBetaScorecardHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const auth=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!service)return Response.json({ok:false,error:'Supabase service role is not configured'},{status:503});
      const user=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{apikey:anon,authorization:auth},fetchImpl);
      if(!await isAnalyticsAdmin(user,{supabaseUrl,service,fetchImpl,env}))return Response.json({ok:false,error:'Admin access required'},{status:403});
      const now=new Date();const since=new Date(now.getTime()-90*86400000).toISOString();
      const headers={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
      const [participants,events,feedback]=await Promise.all([
        jsonFetch(`${supabaseUrl}/rest/v1/beta_participants?select=id,email,status,user_id,workspace_id,invited_at,activated_at,completed_at&order=invited_at.asc&limit=100`,headers,fetchImpl),
        jsonFetch(`${supabaseUrl}/rest/v1/journey_events?select=workspace_id,user_id,event_name,metadata,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=10000`,headers,fetchImpl),
        jsonFetch(`${supabaseUrl}/rest/v1/beta_feedback?select=workspace_id,user_id,rating,area,would_pay,metadata,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=5000`,headers,fetchImpl)
      ]);
      const scorecard=buildFreeBetaScorecardV1({participants,events,feedback,now:now.toISOString()});
      return Response.json({ok:true,...scorecard},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createClosedBetaScorecardHandler();
export const config={path:'/api/internal/closed-beta-scorecard',method:'GET'};
