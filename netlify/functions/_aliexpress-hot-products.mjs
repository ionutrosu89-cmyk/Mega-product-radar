import {createHmac} from 'node:crypto';
import {approvedTop25CategoryTarget} from '../../top25-category-approval-v1.js';

const API_URL='https://eco.taobao.com/router/rest';
const METHOD='aliexpress.affiliate.hotproduct.query';
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const approved=(env,key)=>clean(env[key]).toLowerCase()==='true';
const numberOrNull=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;

export function aliexpressPublicDisplayAccessState(env=process.env){
  if(!clean(env.ALIEXPRESS_APP_KEY)||!clean(env.ALIEXPRESS_APP_SECRET)||!clean(env.ALIEXPRESS_TRACKING_ID))return 'ACCESS_REQUIRED';
  if(!approved(env,'MPR_ALIEXPRESS_TERMS_APPROVED'))return 'TERMS_REVIEW_REQUIRED';
  if(!approved(env,'MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED'))return 'PUBLIC_DISPLAY_RIGHTS_REQUIRED';
  // The published Hot Products reference is under AliExpress's deprecated API section.
  // Require explicit confirmation that this endpoint is still available to this app.
  if(!approved(env,'MPR_ALIEXPRESS_API_CURRENT_CONFIRMED'))return 'API_AVAILABILITY_REVIEW_REQUIRED';
  return 'READY_TO_COLLECT';
}

export function parseAliExpressTargets(env=process.env,now=new Date()){
  let raw;
  try{raw=JSON.parse(clean(env.MPR_ALIEXPRESS_TOP25_TARGETS_JSON)||'[]');}catch{return [];}
  if(!Array.isArray(raw)||raw.length>25)return [];
  const seen=new Set();
  const targets=[];
  for(const row of raw){
    const target=approvedTop25CategoryTarget(row,{provider:'ALIEXPRESS',now});
    if(!target||seen.has(target.nicheId))return [];
    seen.add(target.nicheId);
    targets.push({...target,keywords:clean(row?.keywords).slice(0,120)});
  }
  return targets;
}

function chinaTimestamp(date){
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const part=type=>parts.find(row=>row.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}

export function signAliExpressParams(params,secret){
  const canonical=Object.keys(params).sort().map(key=>`${key}${params[key]}`).join('');
  return createHmac('md5',clean(secret)).update(canonical,'utf8').digest('hex').toUpperCase();
}

export function buildAliExpressRequest({target,env=process.env,now=new Date()}={}){
  const params={
    method:METHOD,
    app_key:clean(env.ALIEXPRESS_APP_KEY),
    sign_method:'hmac',
    timestamp:chinaTimestamp(now),
    v:'2.0',
    format:'json',
    simplify:'true',
    tracking_id:clean(env.ALIEXPRESS_TRACKING_ID),
    ship_to_country:'RO',
    target_currency:'EUR',
    target_language:'EN',
    page_no:'1',
    page_size:'50',
    sort:'LAST_VOLUME_DESC',
    fields:'product_id,product_title,product_detail_url,target_sale_price,target_sale_price_currency,evaluate_rate,lastest_volume,first_level_category_id,second_level_category_id'
  };
  if(target?.categoryIds?.length)params.category_ids=target.categoryIds.join(',');
  if(clean(target?.keywords))params.keywords=clean(target.keywords);
  params.sign=signAliExpressParams(params,env.ALIEXPRESS_APP_SECRET);
  return {url:API_URL,body:new URLSearchParams(params)};
}

function productRows(payload){
  const response=payload?.aliexpress_affiliate_hotproduct_query_response||payload;
  const result=response?.resp_result?.result||response?.result||{};
  const products=result?.products?.product||result?.products||[];
  return Array.isArray(products)?products:[];
}

export function normalizeAliExpressHotProducts(payload,{target,observedAt=new Date().toISOString()}={}){
  const seen=new Set(),products=[];
  for(const row of productRows(payload).slice(0,25)){
    const externalId=clean(row?.product_id);
    const name=clean(row?.product_title).replace(/\s+/g,' ').slice(0,220);
    const sourceUrl=clean(row?.product_detail_url).slice(0,500);
    let parsed;try{parsed=new URL(sourceUrl);}catch{return [];}
    if(!externalId||!name||parsed.protocol!=='https:'||!/(^|\.)aliexpress\.com$/i.test(parsed.hostname)||seen.has(externalId))return [];
    seen.add(externalId);
    const latestVolume=numberOrNull(row?.lastest_volume);
    products.push({
      name,externalId,rank:products.length+1,platform:'ALIEXPRESS',sourceUrl,observedAt,
      conceptKey:null,sourceKey:'ALIEXPRESS_HOT_PRODUCTS_API',sourceLabel:'AliExpress Open Platform',rankingBasis:'HOT_PRODUCTS_LAST_VOLUME_DESC',market:'ALIEXPRESS_GLOBAL',
      price:numberOrNull(row?.target_sale_price),
      currency:upper(row?.target_sale_price_currency||'EUR'),rating:null,reviewCount:null,
      sourceMetric:latestVolume!==null&&latestVolume>=0?{label:'Volum recent raportat de platformă',value:latestVolume,unit:'provider_latest_volume'}:null,
      evidenceClass:'DIRECT',salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES',commercialGate:'BRAND_REVIEW_REQUIRED'
    });
    if(products.length===25)break;
  }
  return products.length===25?products:[];
}

export async function collectAliExpressHotProductsTarget({target,env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  if(aliexpressPublicDisplayAccessState(env)!=='READY_TO_COLLECT')return {ok:false,code:'ALIEXPRESS_ACCESS_NOT_READY',target,products:[]};
  const observed=now();
  const request=buildAliExpressRequest({target,env,now:observed});
  const response=await fetchImpl(request.url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',accept:'application/json'},body:request.body,signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {ok:false,code:`ALIEXPRESS_HTTP_${response.status}`,target,products:[]};
  const payload=await response.json();
  const errorCode=clean(payload?.error_response?.code||(payload?.aliexpress_affiliate_hotproduct_query_response||payload)?.resp_result?.resp_code);
  if(payload?.error_response||errorCode&&errorCode!=='200')return {ok:false,code:'ALIEXPRESS_PROVIDER_ERROR',target,products:[]};
  const products=normalizeAliExpressHotProducts(payload,{target,observedAt:observed.toISOString()});
  if(products.length!==25)return {ok:false,code:'ALIEXPRESS_TOP25_INCOMPLETE',target,products:[]};
  return {ok:true,code:'READY',target,products};
}

export const ALIEXPRESS_HOT_PRODUCTS={apiUrl:API_URL,method:METHOD,sort:'LAST_VOLUME_DESC',requiredCount:25,shipToCountry:'RO'};
