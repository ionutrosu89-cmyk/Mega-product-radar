import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
let clientPromise=null;
export async function getSupabaseClient(config=SAAS_CONFIG){
  if(!isSaasConfigured(config)) return null;
  if(!clientPromise) clientPromise=import('https://esm.sh/@supabase/supabase-js@2.57.4').then(({createClient})=>createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  return clientPromise;
}
export async function getCurrentSession(){const client=await getSupabaseClient();if(!client)return null;const {data}=await client.auth.getSession();return data.session||null;}
export async function signInWithPassword(email,password){const client=await getSupabaseClient();if(!client)throw new Error('Supabase nu este configurat inca.');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data;}
export async function signUp(email,password,acceptance={}){const client=await getSupabaseClient();if(!client)throw new Error('Supabase nu este configurat inca.');const redirectTo=new URL(SAAS_CONFIG.authRedirectPath,location.href).href;const dataMetadata={beta_purpose:String(acceptance.betaPurpose||''),terms_version:String(acceptance.termsVersion||''),privacy_version:String(acceptance.privacyVersion||''),free_beta_only:acceptance.freeBetaOnly===true,accepted_at:new Date().toISOString()};const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:dataMetadata}});if(error)throw error;return data;}
export async function resetPassword(email){const client=await getSupabaseClient();if(!client)throw new Error('Supabase nu este configurat inca.');const redirectTo=new URL('account.html?reset=1',location.href).href;const {data,error}=await client.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;return data;}
export async function updatePassword(password){const client=await getSupabaseClient();if(!client)throw new Error('Supabase nu este configurat inca.');const {data,error}=await client.auth.updateUser({password});if(error)throw error;return data;}
export async function signOut(){const client=await getSupabaseClient();if(!client)return;const {error}=await client.auth.signOut();if(error)throw error;}
