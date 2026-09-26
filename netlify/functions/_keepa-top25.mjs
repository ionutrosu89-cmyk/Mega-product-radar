import {normalizeKeepaBestSellerList,normalizeKeepaIdentity} from '../../keepa-acquisition-adapter.js';
import {FREE_TOP25_LIVE_TAXONOMY_BY_ID} from '../../free-top25-live-taxonomy-v1.js';
import {classifyPublicBrandGate} from '../../brand-policy-v1.js';

const clean=value=>String(value??'').trim();
const enabled=value=>clean(value).toLowerCase()==='true';
export const KEEPA_CANDIDATE_LIMIT=100;
export const KEEPA_RUN_TOKEN_RESERVATION=150;

export function keepaCollectionAccessState(env={}){
  if(!clean(env.KEEPA_API_KEY))return 'ACCESS_REQUIRED';
  if(!enabled(env.MPR_KEEPA_TERMS_APPROVED)||!enabled(env.MPR_KEEPA_PUBLIC_DISPLAY_APPROVED))return 'SOURCE_RIGHTS_REQUIRED';
  if(!enabled(env.MPR_PAID_PROVIDER_CALLS_ENABLED)||!enabled(env.MPR_KEEPA_COLLECTION_ENABLED))return 'PAID_COLLECTION_DISABLED';
  const cap=Number(env.MPR_KEEPA_DAILY_TOKEN_CAP);
  if(!Number.isSafeInteger(cap)||cap<KEEPA_RUN_TOKEN_RESERVATION||cap>3750)return 'DAILY_TOKEN_CAP_REQUIRED';
  return 'READY_TO_COLLECT';
}

export function parseKeepaTargets(env={},now=new Date()){
  let rows;try{rows=JSON.parse(env.MPR_KEEPA_TOP25_TARGETS_JSON||'[]');}catch{return [];}
  if(!Array.isArray(rows)||!rows.length||rows.length>25||!Number.isFinite(now.getTime()))return [];
  const seen=new Set(),targets=[];
  for(const row of rows){
    const nicheId=clean(row?.nicheId).toUpperCase(),categoryId=clean(row?.categoryId),domain=Number(row?.domain);
    const reviewedAt=Date.parse(row?.reviewedAt||'');
    let evidence;try{evidence=new URL(row?.categoryEvidenceUrl);}catch{return [];}
    const expectedHost=domain===1?'amazon.com':domain===3?'amazon.de':null;
    if(!FREE_TOP25_LIVE_TAXONOMY_BY_ID.has(nicheId)||seen.has(nicheId)||!expectedHost||!/^\d+$/.test(categoryId)||!Number.isSafeInteger(Number(categoryId))||Number(categoryId)<=0||row.mappingStatus!=='APPROVED'||!clean(row.reviewer)||!Number.isFinite(reviewedAt)||reviewedAt>now.getTime()||now.getTime()-reviewedAt>90*86_400_000||evidence.protocol!=='https:'||![expectedHost,`www.${expectedHost}`].includes(evidence.hostname))return [];
    seen.add(nicheId);
    targets.push({nicheId,categoryId,domain,reviewer:clean(row.reviewer),reviewedAt:new Date(reviewedAt).toISOString(),categoryEvidenceUrl:evidence.href});
  }
  return targets;
}

// Reserve the worst case before sending anything to the paid provider. Never
// refund uncertain failures: a timed-out request may already have consumed tokens.
// One conditional document covers all niches, including concurrent invocations.
export async function reserveKeepaBudget(store,{day,nicheId,cap}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!FREE_TOP25_LIVE_TAXONOMY_BY_ID.has(nicheId)||!Number.isSafeInteger(cap)||cap<150||cap>3750)return {ok:false,code:'INVALID_BUDGET_REQUEST'};
  const key=`budget/${day}`;
  for(let attempt=0;attempt<4;attempt++){
    const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
    if(entry&&(!entry.etag||!Number.isSafeInteger(entry.data?.reservedTokens)||entry.data.reservedTokens<0||!Array.isArray(entry.data?.niches)))return {ok:false,code:'INVALID_BUDGET_STATE'};
    const prior=entry?.data||{reservedTokens:0,niches:[]};
    if(prior.niches.includes(nicheId))return {ok:false,code:'ALREADY_RESERVED_TODAY'};
    if(prior.reservedTokens+KEEPA_RUN_TOKEN_RESERVATION>cap)return {ok:false,code:'DAILY_TOKEN_CAP_REACHED'};
    const next={day,reservedTokens:prior.reservedTokens+KEEPA_RUN_TOKEN_RESERVATION,niches:[...prior.niches,nicheId]};
    const result=await store.setJSON(key,next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
    if(result.modified===true)return {ok:true,code:'RESERVED',reservedTokens:KEEPA_RUN_TOKEN_RESERVATION,dailyReservedTokens:next.reservedTokens};
  }
  return {ok:false,code:'BUDGET_CONTENTION'};
}

async function keepaJson(path,params,{env,fetchImpl}){
  const url=new URL(path,'https://api.keepa.com');
  for(const [key,value] of Object.entries({...params,key:env.KEEPA_API_KEY}))url.searchParams.set(key,String(value));
  try{
    // No automatic retry and no redirects: the URL contains a server-only key.
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(10_000),redirect:'error'});
    if(!response.ok)return {ok:false,code:`KEEPA_HTTP_${response.status}`};
    const payload=await response.json();
    if(payload?.error)return {ok:false,code:'KEEPA_PROVIDER_ERROR'};
    return {ok:true,payload};
  }catch{return {ok:false,code:'KEEPA_REQUEST_FAILED'};}
}

export async function collectKeepaCandidates({target,env,fetchImpl=fetch,now=new Date()}){
  const listResponse=await keepaJson('/bestsellers',{domain:target.domain,category:target.categoryId,sublist:1,variations:0},{env,fetchImpl});
  if(!listResponse.ok)return {...listResponse,providerCalls:1};
  const list=normalizeKeepaBestSellerList(listResponse.payload,{domain:target.domain,categoryId:target.categoryId,now,limit:KEEPA_CANDIDATE_LIMIT});
  if(!list.ok)return {ok:false,code:list.code,providerCalls:1};
  const identities=await keepaJson('/product',{domain:target.domain,asin:list.candidates.map(row=>row.externalId).join(','),history:0,update:-1},{env,fetchImpl});
  if(!identities.ok)return {...identities,providerCalls:2};
  if(!Array.isArray(identities.payload?.products))return {ok:false,code:'INVALID_PRODUCT_RESPONSE',providerCalls:2};
  const byAsin=new Map();
  for(const product of identities.payload.products){
    if(Number(product?.domainId)!==target.domain)continue;
    const identity=normalizeKeepaIdentity(product,{observedAt:now.toISOString()});
    const age=now.getTime()-Date.parse(identity?.sourceUpdatedAt||'');
    if(!identity?.title||!Number.isFinite(age)||age<0||age>72*3_600_000||byAsin.has(identity.externalId))continue;
    byAsin.set(identity.externalId,identity);
  }
  const host=target.domain===1?'www.amazon.com':'www.amazon.de',candidates=[],excluded=[];
  for(const ranked of list.candidates){
    const identity=byAsin.get(ranked.externalId);
    if(!identity){excluded.push({externalId:ranked.externalId,reason:'MISSING_OR_STALE_IDENTITY'});continue;}
    const candidate={...ranked,nicheId:target.nicheId,title:identity.title.slice(0,220),brand:identity.brand?.slice(0,160)||null,sourceUrl:`https://${host}/dp/${ranked.externalId}`,identityUpdatedAt:identity.sourceUpdatedAt,
      // Fetch time cannot freshen older evidence. Both rank and identity must be recent.
      observedAt:[ranked.sourceUpdatedAt,identity.sourceUpdatedAt].sort()[0],fetchedAt:now.toISOString(),rankingBasis:'KEEPA_SUBCATEGORY_LIST_POSITION',salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES'};
    const gate=classifyPublicBrandGate(candidate);
    if(gate.brandPolicyClass==='ESTABLISHED_EXCLUDE'){excluded.push({externalId:ranked.externalId,reason:'ESTABLISHED_BRAND'});continue;}
    candidates.push(candidate);
  }
  return {ok:true,code:'HUMAN_REVIEW_REQUIRED',providerCalls:2,batch:{nicheId:target.nicheId,sourcePlatform:target.domain===1?'AMAZON_US':'AMAZON_DE',market:target.domain===1?'AMAZON_US':'AMAZON_DE',sourceKey:'KEEPA_BEST_SELLERS',sourceLabel:'Keepa sub-category rank list',categoryId:target.categoryId,mappingReview:target,sourceUpdatedAt:list.sourceUpdatedAt,fetchedAt:now.toISOString(),candidates,excluded,reviews:{},published:0,status:'HUMAN_REVIEW_REQUIRED'}};
}
