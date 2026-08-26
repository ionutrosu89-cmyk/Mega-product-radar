const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export const OPPORTUNITY_UX_ACTIONS=Object.freeze(['IGNORE','WATCH','VALIDATE']);
export const OPPORTUNITY_COMPONENT_ORDER=Object.freeze(['globalDemand','trend','romaniaGap','importability','supplier','economics','evidence']);
export const OPPORTUNITY_COMPONENT_LABELS=Object.freeze({globalDemand:'Global Demand',trend:'Trend',romaniaGap:'Romania Gap',importability:'Importability',supplier:'Supplier',economics:'Economics',evidence:'Evidence'});

function rawOpportunity(product={}){
  return product?.opportunityV5||product?.opportunity_v5||product?.opportunity||product?.payload?.opportunityV5||product?.payload?.opportunity_v5||null;
}
function component(raw,name){
  const c=raw?.components?.[name]||null;
  if(!c)return Object.freeze({name,label:OPPORTUNITY_COMPONENT_LABELS[name]||name,status:'UNKNOWN',score:null,confidence:null,evidenceClass:'UNKNOWN'});
  return Object.freeze({name,label:OPPORTUNITY_COMPONENT_LABELS[name]||name,status:upper(c.status)||'UNKNOWN',score:finite(c.score),confidence:finite(c.confidence),evidenceClass:upper(c.evidenceClass)||'UNKNOWN'});
}
function canonicalId(product,raw){return text(raw?.canonicalProductId||product?.canonicalProductId||product?.canonical_product_id)||null;}

export function normalizeOpportunityUxV1(product={}){
  const raw=rawOpportunity(product);
  const components=Object.freeze(Object.fromEntries(OPPORTUNITY_COMPONENT_ORDER.map(name=>[name,component(raw,name)])));
  const blockers=Array.isArray(raw?.blockers)?raw.blockers.map(upper).filter(Boolean):[];
  const missing=Array.isArray(raw?.missingComponents)?raw.missingComponents.map(text).filter(Boolean):OPPORTUNITY_COMPONENT_ORDER.filter(name=>components[name].status==='UNKNOWN'&&components[name].score===null);
  const identityMismatches=Array.isArray(raw?.identityMismatches)?raw.identityMismatches.map(text).filter(Boolean):[];
  const recommendation=raw&&['DISCOVERED','PROMISING','VALIDATE','FINALIST'].includes(upper(raw.recommendation))?upper(raw.recommendation):'VALIDATE';
  const id=canonicalId(product,raw);
  const score=finite(raw?.opportunityScore);
  const confidence=finite(raw?.confidence);
  const reasons=[];
  if(!raw)reasons.push('OPPORTUNITY_V5_MISSING');
  if(!id)reasons.push('CANONICAL_PRODUCT_ID_REQUIRED');
  reasons.push(...blockers);
  if(identityMismatches.length)reasons.push('CROSS_PRODUCT_EVIDENCE_REJECTED');
  return Object.freeze({schemaVersion:'MPR_OPPORTUNITY_UX_V1',canonicalProductId:id,opportunityScore:score,confidence,recommendation,components,blockers:Object.freeze([...new Set(reasons)]),missingComponents:Object.freeze(missing),identityMismatches:Object.freeze(identityMismatches),finalistEligible:recommendation==='FINALIST'&&raw?.finalistEligible===true,testReadyEligible:false,buyReadyEligible:false,purchaseAuthorized:false,automaticPurchaseAllowed:false,legacyRecommendationAuthoritative:false,rawPresent:Boolean(raw)});
}

export function nextValidationStepV1(view){
  if(!view?.canonicalProductId)return Object.freeze({component:'identity',label:'Canonical Identity',reason:'Leagă produsul de canonicalProductId înainte de folosirea dovezilor în decizie.'});
  if(view?.identityMismatches?.length)return Object.freeze({component:'identity',label:'Canonical Identity',reason:'Rezolvă dovezile legate de alt produs canonic.'});
  for(const name of ['importability','romaniaGap','trend','supplier','economics']){
    const status=upper(view?.components?.[name]?.status)||'UNKNOWN';
    if(status!=='PASS')return Object.freeze({component:name,label:OPPORTUNITY_COMPONENT_LABELS[name],reason:status==='BLOCKED'?`${OPPORTUNITY_COMPONENT_LABELS[name]} este BLOCKED.`:`Validează ${OPPORTUNITY_COMPONENT_LABELS[name]}: status ${status}.`});
  }
  if(view?.opportunityScore===null)return Object.freeze({component:'score',label:'Opportunity Score',reason:'Completează componentele lipsă; scorul nu se calculează din date incomplete.'});
  if((view?.confidence??0)<60)return Object.freeze({component:'confidence',label:'Confidence',reason:'Crește calitatea dovezilor până la confidence suficient pentru FINALIST.'});
  return Object.freeze({component:'decision',label:'Decision',reason:view?.recommendation==='FINALIST'?'Candidatul este FINALIST; următorul nivel necesită test real și Decision Authority.':'Continuă validarea canonică.'});
}

export function opportunityActionStorageKeyV1(product={},view=normalizeOpportunityUxV1(product)){
  if(view.canonicalProductId)return `mprOpportunityActionV1:${view.canonicalProductId}`;
  const fallback=text(product?.id||product?.name).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
  return fallback?`mprOpportunityActionV1:ux-only:${fallback}`:null;
}

export function isCanonicalFinalistV1(view){
  if(!view?.canonicalProductId||view?.recommendation!=='FINALIST'||view?.finalistEligible!==true)return false;
  return ['trend','romaniaGap','importability','supplier','economics'].every(name=>upper(view?.components?.[name]?.status)==='PASS')&&view.opportunityScore!==null&&(view.confidence??0)>=60;
}
