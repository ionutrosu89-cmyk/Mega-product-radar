import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

export function productKey(name=''){
  return String(name).trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
}

async function context(){
  const session=await getCurrentSession();
  if(!session)throw new Error('Autentificare necesară.');
  const client=await getSupabaseClient();
  const workspace=await ensurePersonalWorkspace('My Radar');
  return {session,client,workspace};
}

function snapshot(product={}){
  const decision=product.testBuyDecision||{};
  const score=Number(product?.launchScore?.score||product?.launchScore?.total||product?.opportunityRanking?.score||product?.opportunityRankingV2?.score||product?.score||0);
  return {
    baseline_action:String(decision.commercialAction||'HOLD'),
    baseline_readiness:Number(decision.commercialReadiness||0),
    baseline_score:Number.isFinite(score)?score:0,
    baseline_landed_confirmed:Boolean(decision.landedCostConfirmed),
    baseline_passed_gates:Number(decision.passedGates||0)
  };
}

export async function listCommercialWatchlist(){
  const {client,workspace}=await context();
  const {data,error}=await client.from('commercial_watchlist').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false});
  if(error)throw error;
  return Array.isArray(data)?data:[];
}

export async function saveToCommercialWatchlist(product={},state='WATCHING'){
  const {session,client,workspace}=await context();
  const name=String(product.name||'').trim();
  const key=productKey(name);
  if(!key)throw new Error('Produs invalid.');
  const row={
    workspace_id:workspace.id,
    user_id:session.user.id,
    product_key:key,
    product_name:name,
    category:String(product.cat||product.category||''),
    state:['WATCHING','VALIDATING','TESTING','PAUSED'].includes(String(state).toUpperCase())?String(state).toUpperCase():'WATCHING',
    ...snapshot(product),
    last_acknowledged_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  const {data,error}=await client.from('commercial_watchlist').upsert(row,{onConflict:'workspace_id,product_key'}).select('*').single();
  if(error)throw error;
  return data;
}

export async function acknowledgeCommercialWatchlist(item={},product={}){
  const {session,client,workspace}=await context();
  const key=String(item.product_key||productKey(product.name||item.product_name||''));
  const patch={user_id:session.user.id,...snapshot(product),last_acknowledged_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {data,error}=await client.from('commercial_watchlist').update(patch).eq('workspace_id',workspace.id).eq('product_key',key).select('*').single();
  if(error)throw error;
  return data;
}

export async function updateCommercialWatchlistState(item={},state='WATCHING'){
  const next=String(state).toUpperCase();
  if(!['WATCHING','VALIDATING','TESTING','PAUSED'].includes(next))throw new Error('Stare invalidă.');
  const {session,client,workspace}=await context();
  const {data,error}=await client.from('commercial_watchlist').update({user_id:session.user.id,state:next,updated_at:new Date().toISOString()}).eq('workspace_id',workspace.id).eq('product_key',item.product_key).select('*').single();
  if(error)throw error;
  return data;
}

export async function removeFromCommercialWatchlist(item={}){
  const {client,workspace}=await context();
  const {error}=await client.from('commercial_watchlist').delete().eq('workspace_id',workspace.id).eq('product_key',item.product_key);
  if(error)throw error;
  return true;
}

export function watchlistChanges(item={},product={}){
  const decision=product.testBuyDecision||{};
  const current={
    action:String(decision.commercialAction||'HOLD'),
    readiness:Number(decision.commercialReadiness||0),
    score:Number(product?.launchScore?.score||product?.launchScore?.total||product?.opportunityRanking?.score||product?.opportunityRankingV2?.score||product?.score||0),
    landed:Boolean(decision.landedCostConfirmed),
    gates:Number(decision.passedGates||0)
  };
  const changes=[];
  const oldAction=String(item.baseline_action||'HOLD');
  if(current.action!==oldAction)changes.push({code:'ACTION_CHANGED',label:`Verdict: ${oldAction} → ${current.action}`,priority:current.action==='BUY'||current.action==='TEST'?'HIGH':'MEDIUM'});
  const readinessDelta=current.readiness-Number(item.baseline_readiness||0);
  if(Math.abs(readinessDelta)>=10)changes.push({code:'READINESS_CHANGED',label:`Readiness ${readinessDelta>0?'+':''}${Math.round(readinessDelta)} pp`,priority:readinessDelta>0?'MEDIUM':'LOW'});
  const scoreDelta=current.score-Number(item.baseline_score||0);
  if(Math.abs(scoreDelta)>=8)changes.push({code:'SCORE_CHANGED',label:`Opportunity ${scoreDelta>0?'+':''}${Math.round(scoreDelta)}`,priority:'LOW'});
  if(current.landed&&!item.baseline_landed_confirmed)changes.push({code:'LANDED_CONFIRMED',label:'Landed cost a fost confirmat',priority:'HIGH'});
  if(current.gates>Number(item.baseline_passed_gates||0))changes.push({code:'GATES_PROGRESS',label:`Gate-uri ${Number(item.baseline_passed_gates||0)} → ${current.gates}/9`,priority:'MEDIUM'});
  return changes;
}
