import {SAAS_CONFIG,isCaptchaConfigured,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,resetPassword,signInWithPassword,signUp} from './supabase-client.js';
const $=s=>document.querySelector(s);function status(text,kind=''){const el=$('#status');el.textContent=text;el.dataset.kind=kind;}
function loginCredentials(){const email=$('#email').value.trim(),password=$('#password').value;if(!email.includes('@'))throw new Error('Introdu un email valid.');if(!password)throw new Error('Introdu parola.');return{email,password};}
function signupCredentials(){const {email,password}=loginCredentials();if(password.length<12)throw new Error('Parola trebuie să aibă minimum 12 caractere.');if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))throw new Error('Parola trebuie să conțină literă mică, literă mare, cifră și simbol.');if(!$('#acceptBeta')?.checked)throw new Error('Pentru crearea contului trebuie să confirmi testarea profesională și să accepți documentele beta.');return{email,password};}
function destination(){const next=new URLSearchParams(location.search).get('next')||'';return /^[a-z0-9][a-z0-9._-]*\.html(?:\?.*)?$/i.test(next)?next:'home.html';}

let captchaToken='',captchaWidgetId=null;
const authButtons=()=>['#login','#signup','#reset'].map($).filter(Boolean);
function setAuthEnabled(enabled){for(const button of authButtons())button.disabled=!enabled;}
function requireCaptchaToken(){if(!isCaptchaConfigured(SAAS_CONFIG))throw new Error('Protecția anti-bot nu este configurată complet. Crearea și accesul la cont rămân blocate până la configurare.');if(!captchaToken)throw new Error('Finalizează verificarea anti-bot înainte de a continua.');return captchaToken;}
function loadScript(src,globalName){return new Promise((resolve,reject)=>{if(globalThis[globalName])return resolve(globalThis[globalName]);const existing=[...document.scripts].find(script=>script.src===src);if(existing){existing.addEventListener('load',()=>resolve(globalThis[globalName]),{once:true});existing.addEventListener('error',()=>reject(new Error('CAPTCHA_SCRIPT_FAILED')),{once:true});return;}const script=document.createElement('script');script.src=src;script.async=true;script.defer=true;script.addEventListener('load',()=>resolve(globalThis[globalName]),{once:true});script.addEventListener('error',()=>reject(new Error('CAPTCHA_SCRIPT_FAILED')),{once:true});document.head.append(script);});}
async function initCaptcha(){
  const root=$('#captcha');
  if(!root)return;
  setAuthEnabled(false);
  if(!isCaptchaConfigured(SAAS_CONFIG)){root.textContent='Protecția anti-bot este în curs de conectare. Autentificarea rămâne blocată în siguranță.';root.dataset.state='missing';status('CAPTCHA trebuie legată de providerul configurat înainte de lansare.','error');return;}
  const provider=String(SAAS_CONFIG.captchaProvider).toLowerCase(),sitekey=String(SAAS_CONFIG.captchaSiteKey);
  try{
    if(provider==='turnstile'){
      const api=await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit','turnstile');
      captchaWidgetId=api.render(root,{sitekey,callback:token=>{captchaToken=String(token||'');},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';}});
    }else{
      const api=await loadScript('https://js.hcaptcha.com/1/api.js?render=explicit','hcaptcha');
      captchaWidgetId=api.render(root,{sitekey,callback:token=>{captchaToken=String(token||'');},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';}});
    }
    root.dataset.state='ready';setAuthEnabled(true);
  }catch{root.textContent='Verificarea anti-bot nu este disponibilă momentan.';root.dataset.state='error';status('Protecția anti-bot nu a putut fi încărcată. Încearcă din nou mai târziu.','error');}
}
function resetCaptchaChallenge(){captchaToken='';try{const provider=String(SAAS_CONFIG.captchaProvider).toLowerCase();if(provider==='turnstile'&&globalThis.turnstile&&captchaWidgetId!==null)globalThis.turnstile.reset(captchaWidgetId);if(provider==='hcaptcha'&&globalThis.hcaptcha&&captchaWidgetId!==null)globalThis.hcaptcha.reset(captchaWidgetId);}catch{}}

if(isSaasConfigured(SAAS_CONFIG))$('#foundation').hidden=true;
getCurrentSession().then(s=>{if(s)location.href=destination();});
initCaptcha();
$('#login').addEventListener('click',async()=>{try{status('Autentificare...');const {email,password}=loginCredentials();const token=requireCaptchaToken();await signInWithPassword(email,password,token);location.href=destination();}catch(e){status(e.message,'error');resetCaptchaChallenge();}});
$('#signup').addEventListener('click',async()=>{try{status('Creare cont...');const {email,password}=signupCredentials();const token=requireCaptchaToken();const data=await signUp(email,password,{betaPurpose:'professional',termsVersion:'2026-09-02',privacyVersion:'2026-09-02',freeBetaOnly:true},token);status(data.session?'Cont creat. Redirecționare...':'Cont creat. Verifică emailul pentru confirmare.','ok');if(data.session)location.href=destination();else resetCaptchaChallenge();}catch(e){status(e.message,'error');resetCaptchaChallenge();}});
$('#reset').addEventListener('click',async()=>{try{const email=$('#email').value.trim();if(!email.includes('@'))throw new Error('Introdu emailul contului.');const token=requireCaptchaToken();await resetPassword(email,token);status('Dacă există un cont pentru această adresă, vei primi instrucțiunile de resetare.','ok');resetCaptchaChallenge();}catch(e){status('Cererea de resetare nu a putut fi procesată momentan.','error');resetCaptchaChallenge();}});
