export const SAAS_CONFIG=Object.freeze({
  version:'7.0',
  provider:'supabase',
  supabaseUrl:'https://xqzsbebbuovcyeyxdqxo.supabase.co',
  supabaseAnonKey:'sb_publishable_G9AwfdhQB_5Y5tRguZ3Feg_TRR70Qcf',
  authRedirectPath:'account.html',
  mode:'LIVE'
});

export function isSaasConfigured(config=SAAS_CONFIG){
  return /^https:\/\/.+\.supabase\.co$/i.test(String(config.supabaseUrl||'')) &&
    String(config.supabaseAnonKey||'').length>20;
}
