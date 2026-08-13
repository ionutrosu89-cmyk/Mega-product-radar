export const SAAS_CONFIG=Object.freeze({
  version:'7.0',
  provider:'supabase',
  supabaseUrl:'',
  supabaseAnonKey:'',
  authRedirectPath:'account.html',
  mode:'FOUNDATION'
});
export function isSaasConfigured(config=SAAS_CONFIG){return /^https:\/\/.+\.supabase\.co$/i.test(String(config.supabaseUrl||''))&&String(config.supabaseAnonKey||'').length>20;}
