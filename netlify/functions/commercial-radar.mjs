import {SAAS_CONFIG} from '../../saas-config.js';
import {hasFeature,planByCode} from '../../billing-plans.js';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const s=v=>String(v??'');

async function resolveAccess(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth)) return {error:'Authentication required',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  const headers={apikey:apiKey,authorization:auth};
  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok) return {error:'Invalid or expired session',status:401};
  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan&limit=1`,{headers:{...headers,accept:'application/json'}});
  if(!workspaceResponse.ok) return {error:'Workspace lookup failed',status:502};
  const rows=await workspaceResponse.json();
  const workspace=Array.isArray(rows)?rows[0]:null;
  const plan=planByCode(workspace?.plan||'FREE');
  if(!hasFeature(plan.code,'RADAR')) return {error:'Radar plan required',status:403,plan:plan.code};
  return {plan,workspaceId:workspace?.id||null,workspaceName:workspace?.name||null};
}

function cleanDecisionInputs(p={}){
  return {
    name:s(p.name),
    cat:s(p.cat||p.category),
    imageUrl:s(p.imageUrl),
    sellTarget:n(p.sellTarget||p.sell||p?.economics?.sell||p?.economics?.salePrice)||null,
    launchScore:p.launchScore||null,
    opportunityRanking:p.opportunityRanking||p.opportunityRankingV2||null,
    romaniaGap2:p.romaniaGap2||p?.discoveryAnalysis?.romaniaGap2||null,
    romaniaDemand:p.romaniaDemand||null,
    keywordDemand:p.keywordDemand||null,
    salesEstimation:p.salesEstimation||null,
    evidenceCoverage:p.evidenceCoverage||null,
    competitors:p.competitors||null,
    dataConfidence:p.dataConfidence||null,
    trendIntelligence:p.trendIntelligence||null,
    commercialHardening:p.commercialHardening||null,
    profitEngineV2:p.profitEngineV2||null,
    economics:p.economics||null,
    reviewOpportunity:p.reviewOpportunity||null,
    testBuyDecision:p.testBuyDecision||null
  };
}

function scoreOf(p){
  return n(p?.launchScore?.score||p?.launchScore?.total||p?.opportunityRanking?.score||p?.opportunityRankingV2?.score||p?.discoveryAnalysis?.score||p?.score);
}

export function createCommercialRadarHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const access=await resolveAccess(request,{fetchImpl,env});
      if(access.error) return Response.json({ok:false,error:access.error,plan:access.plan||'FREE'},{status:access.status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
      // radar-live.json is the static, sanitized live Radar snapshot shipped in the Netlify build.
      // Premium/private supplier and landed-cost state is hydrated separately in the authenticated browser workspace.
      const sourceUrl=new URL('/radar-live.json',request.url);
      const sourceResponse=await fetchImpl(sourceUrl,{headers:{accept:'application/json'}});
      if(!sourceResponse.ok) return Response.json({ok:false,error:'Radar intelligence unavailable'},{status:503,headers:{'Cache-Control':'private, no-store'}});
      const source=await sourceResponse.json();
      const products=(Array.isArray(source.products)?source.products:[])
        .map(cleanDecisionInputs)
        .sort((a,b)=>scoreOf(b)-scoreOf(a))
        .slice(0,30);
      return Response.json({
        ok:true,
        plan:access.plan.code,
        workspaceId:access.workspaceId,
        workspaceName:access.workspaceName,
        updatedAt:source.updatedAt||null,
        limits:{products:30},
        integrity:{
          verdict:'PRIVATE_DECISION_ENGINE',
          moneyGate:'CONFIRMED_LANDED_COST_REQUIRED',
          sales:'ACTUAL_OR_HIGH_CONFIDENCE_ESTIMATE_EXPLICITLY_LABELED'
        },
        products
      },{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createCommercialRadarHandler();
export const config={path:'/api/commercial/radar',method:'GET'};
