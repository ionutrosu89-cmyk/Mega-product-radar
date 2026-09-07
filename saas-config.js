export const SAAS_CONFIG=Object.freeze({
  version:'7.0',
  provider:'supabase',
  supabaseUrl:'https://xqzsbebbuovcyeyxdqxo.supabase.co',
  supabaseAnonKey:'sb_publishable_G9AwfdhQB_5Y5tRguZ3Feg_TRR70Qcf',
  authRedirectPath:'account.html',
  // Public CAPTCHA configuration only. The CAPTCHA secret belongs in Supabase Auth
  // and must never be added to this client-side file. Supported: turnstile, hcaptcha.
  captchaProvider:'',
  captchaSiteKey:'',
  mode:'LIVE'
});

export function isSaasConfigured(config=SAAS_CONFIG){
  return /^https:\/\/.+\.supabase\.co$/i.test(String(config.supabaseUrl||'')) &&
    String(config.supabaseAnonKey||'').length>20;
}

export function isCaptchaConfigured(config=SAAS_CONFIG){
  return ['turnstile','hcaptcha'].includes(String(config.captchaProvider||'').trim().toLowerCase()) &&
    String(config.captchaSiteKey||'').trim().length>=8;
}
