import {hasFeature} from '../../billing-plans.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit} from './_security-ops.mjs';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const s=v=>String(v??'');

function cleanDecisionInputs(p={}){
  const derivedGap=n(p?.megaAnalysis?.components?.romaniaGap||p.gap);
  return {name:s(p.name),cat:s(p.cat||p.category),imageUrl:s(p.imageUrl),score:n(p.score||p.megaScore||p?.megaAnalysis?.score)||null,derivedRomaniaGap:derivedGap>0?{score:derivedGap,evidence:'DERIVED_PROXY'}:null,sourceStatus:s(p.sourceStatus||p.status),sellTarget:n(p.sellTarget||p.sell||p?.economics?.sell||p?.economics?.salePrice)||null,launchScore:p.launchScore||null,opportunityRanking:p.opportunityRanking||p.opportunityRankingV2||null,romaniaGap2:p.romaniaGap2||p?.discoveryAnalysis?.romaniaGap2||null,romaniaDemand:p.romaniaDemand||null,keywordDemand:p.keywordDemand||null,salesEstimation:p.salesEstimation||null,evidenceCoverage:p.evidenceCoverage||null,competitors:p.competitors||null,dataConfidence:p.dataConfidence||null,trendIntelligence:p.trendIntelligence||null,commercialHardening:p.commercialHardening||null,profitEngineV2:p.profitEngineV2||null,economics:p.economics||null,reviewOpportunity:p.reviewOpportunity||null,testBuyDecision:p.testBuyDecision||null};
}
function scoreOf(p){return n(p?.launchScore?.score||p?.launchScore?.total||p?.opportunityRanking?.score||p?.opportunityRankingV2?.score||p?.discoveryAnalysis?.score||p?.score);}
const privateHeaders=()=>({'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'});

export function createCommercialRadarHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const access=await resolveWorkspaceAccess(request,{fetchImpl,env});
      if(access.error)return Response.json({ok:false,error:access.error,code:access.code,plan:'FREE'},{status:access.status,headers:privateHeaders()});
      if(!hasFeature(access.plan.code,'RADAR'))return Response.json({ok:false,error:'Radar plan required',plan:access.plan.code},{status:403,headers:privateHeaders()});
      const rate=await enforceRateLimit(request,{route:'commercial-radar',workspaceId:access.workspaceId,userId:access.user.id,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{...privateHeaders(),'Retry-After':String(rate.retryAfterSeconds)}});
      const sourceUrl=new URL('/radar-live.json',request.url),sourceResponse=await fetchImpl(sourceUrl,{headers:{accept:'application/json'}});
      if(!sourceResponse.ok)return Response.json({ok:false,error:'Radar intelligence unavailable'},{status:503,headers:privateHeaders()});
      const source=await sourceResponse.json();
      const products=(Array.isArray(source.products)?source.products:[]).map(cleanDecisionInputs).sort((a,b)=>scoreOf(b)-scoreOf(a)).slice(0,30);
      return Response.json({ok:true,plan:access.plan.code,workspaceId:access.workspaceId,workspaceName:access.workspace.name,updatedAt:source.updatedAt||null,limits:{products:30},integrity:{verdict:'PRIVATE_DECISION_ENGINE',moneyGate:'CONFIRMED_LANDED_COST_REQUIRED',sales:'ACTUAL_OR_HIGH_CONFIDENCE_ESTIMATE_EXPLICITLY_LABELED',legacyScore:'DERIVED_DISPLAY_ONLY',legacyRomaniaGap:'DERIVED_PROXY_DISPLAY_ONLY',workspace:'EXPLICIT_MEMBERSHIP_BOUND'},products},{headers:privateHeaders()});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}
export default createCommercialRadarHandler();
export const config={path:'/api/commercial/radar',method:'GET'};
