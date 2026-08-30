import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {hasFeature} from '../../billing-plans.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit} from './_security-ops.mjs';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const s=v=>String(v??'');
const ALLOWED_VALIDATION_BLOCKERS=new Set(['FIVE_TIER_EVIDENCE_REQUIRED','DRAWER_EVIDENCE_REQUIRED','PEN_HOLDER_EVIDENCE_REQUIRED','TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','ORGANIZER_IDENTITY_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']);

function cleanDecisionInputs(p={}){
  const derivedGap=n(p?.megaAnalysis?.components?.romaniaGap||p.gap);
  return {name:s(p.name),cat:s(p.cat||p.category),imageUrl:s(p.imageUrl),score:n(p.score||p.megaScore||p?.megaAnalysis?.score)||null,derivedRomaniaGap:derivedGap>0?{score:derivedGap,evidence:'DERIVED_PROXY'}:null,sourceStatus:s(p.sourceStatus||p.status),sellTarget:n(p.sellTarget||p.sell||p?.economics?.sell||p?.economics?.salePrice)||null,launchScore:p.launchScore||null,opportunityRanking:p.opportunityRanking||p.opportunityRankingV2||null,romaniaGap2:p.romaniaGap2||p?.discoveryAnalysis?.romaniaGap2||null,romaniaDemand:p.romaniaDemand||null,keywordDemand:p.keywordDemand||null,salesEstimation:p.salesEstimation||null,evidenceCoverage:p.evidenceCoverage||null,competitors:p.competitors||null,dataConfidence:p.dataConfidence||null,trendIntelligence:p.trendIntelligence||null,commercialHardening:p.commercialHardening||null,profitEngineV2:p.profitEngineV2||null,economics:p.economics||null,reviewOpportunity:p.reviewOpportunity||null,testBuyDecision:p.testBuyDecision||null};
}
function cleanValidationCandidate(x={}){return {externalId:s(x.externalId),platform:s(x.platform||'ALIBABA'),title:s(x.title),supplierName:s(x.supplierName),productUrl:s(x.productUrl),sourceUrl:s(x.sourceUrl),publicPrice:x.publicPrice?{currency:s(x.publicPrice.currency||'USD'),min:finite(x.publicPrice.min),max:finite(x.publicPrice.max)}:null,moq:x.moq?{value:finite(x.moq.value)}:null,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',funnelState:'VALIDATE',validationStatus:'EVIDENCE_INCOMPLETE_NOT_MATCHED',blockers:(Array.isArray(x.blockers)?x.blockers:[]).filter(v=>ALLOWED_VALIDATION_BLOCKERS.has(v)),canPromoteToMatch:false,canAuthorizeEconomics:false,purchaseAuthorized:false};}
function scoreOf(p){return n(p?.launchScore?.score||p?.launchScore?.total||p?.opportunityRanking?.score||p?.opportunityRankingV2?.score||p?.discoveryAnalysis?.score||p?.score);}
const privateHeaders=()=>({'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'});
async function readBundledJson(filename){const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];let lastError=null;for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){lastError=error;}}throw lastError||new Error(`Bundled source unavailable: ${filename}`);}

export function createCommercialRadarHandler({fetch:fetchImpl=fetch,env=process.env,readValidation=readBundledJson}={}){
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
      let validationSource=null,validationSourceStatus='UNAVAILABLE';
      try{validationSource=await readValidation('supplier-validation-live.json');validationSourceStatus='BUNDLED_FILE';}catch{}
      const supplierValidationQueue=(Array.isArray(validationSource?.candidates)?validationSource.candidates:[]).map(cleanValidationCandidate).filter(x=>x.externalId&&x.title&&x.blockers.length).slice(0,20);
      return Response.json({ok:true,plan:access.plan.code,workspaceId:access.workspaceId,workspaceName:access.workspace.name,updatedAt:source.updatedAt||null,limits:{products:30,supplierValidationQueue:20},integrity:{verdict:'PRIVATE_DECISION_ENGINE',moneyGate:'CONFIRMED_LANDED_COST_REQUIRED',sales:'ACTUAL_OR_HIGH_CONFIDENCE_ESTIMATE_EXPLICITLY_LABELED',legacyScore:'DERIVED_DISPLAY_ONLY',legacyRomaniaGap:'DERIVED_PROXY_DISPLAY_ONLY',workspace:'EXPLICIT_MEMBERSHIP_BOUND',supplierValidation:'PUBLIC_INDEX_EVIDENCE_ONLY_NOT_MATCHED',supplierValidationCanAuthorizeEconomics:false,purchaseAuthorized:false},sourceDiagnostics:{supplierValidationSource:validationSourceStatus,supplierValidationUpdatedAt:validationSource?.updatedAt||null},supplierValidationQueue,products},{headers:privateHeaders()});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}
export default createCommercialRadarHandler();
export const config={path:'/api/commercial/radar',method:'GET'};
