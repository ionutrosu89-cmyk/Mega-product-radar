import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

export const DEFAULT_SELLER_PREFERENCES=Object.freeze({experience_level:'BEGINNER',monthly_budget_ron:3000,categories:[],marketplaces:['EMAG_RO'],sourcing_preference:'CHINA',risk_profile:'BALANCED',goal:'FIND_PRODUCTS',onboarding_completed:false});

export async function loadSellerPreferences(){
  const session=await getCurrentSession();
  if(!session)return {...DEFAULT_SELLER_PREFERENCES};
  const client=await getSupabaseClient();
  const ws=await ensurePersonalWorkspace('My Radar');
  const {data,error}=await client.from('seller_preferences').select('*').eq('workspace_id',ws.id).maybeSingle();
  if(error)throw error;
  return {...DEFAULT_SELLER_PREFERENCES,...(data||{}),workspace_id:ws.id};
}

export async function saveSellerPreferences(input={}){
  const session=await getCurrentSession();
  if(!session)throw new Error('Autentificare necesară.');
  const client=await getSupabaseClient();
  const ws=await ensurePersonalWorkspace('My Radar');
  const row={
    workspace_id:ws.id,
    experience_level:String(input.experience_level||DEFAULT_SELLER_PREFERENCES.experience_level),
    monthly_budget_ron:Math.max(0,Number(input.monthly_budget_ron||0)),
    categories:Array.isArray(input.categories)?input.categories.slice(0,20):[],
    marketplaces:Array.isArray(input.marketplaces)?input.marketplaces.slice(0,10):[],
    sourcing_preference:String(input.sourcing_preference||'CHINA'),
    risk_profile:String(input.risk_profile||'BALANCED'),
    goal:String(input.goal||'FIND_PRODUCTS'),
    onboarding_completed:true,
    updated_at:new Date().toISOString()
  };
  const {data,error}=await client.from('seller_preferences').upsert(row,{onConflict:'workspace_id'}).select('*').single();
  if(error)throw error;
  return data;
}

export function categoryPreferenceScore(product={},preferences={}){
  const wanted=(preferences.categories||[]).map(x=>String(x).toLowerCase());
  if(!wanted.length)return 0;
  const hay=`${product.cat||''} ${product.category||''} ${product.name||''}`.toLowerCase();
  return wanted.some(x=>hay.includes(x))?15:0;
}
