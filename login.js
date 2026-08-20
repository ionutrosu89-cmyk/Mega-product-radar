import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,resetPassword,signInWithPassword,signUp} from './supabase-client.js';
const $=s=>document.querySelector(s);function status(text,kind=''){const el=$('#status');el.textContent=text;el.dataset.kind=kind;}
function credentials(){const email=$('#email').value.trim(),password=$('#password').value;if(!email.includes('@'))throw new Error('Introdu un email valid.');if(password.length<8)throw new Error('Parola trebuie sa aiba minimum 8 caractere.');return{email,password};}
function destination(){const next=new URLSearchParams(location.search).get('next')||'';return /^[a-z0-9][a-z0-9._-]*\.html(?:\?.*)?$/i.test(next)?next:'home.html';}
if(isSaasConfigured(SAAS_CONFIG))$('#foundation').hidden=true;
getCurrentSession().then(s=>{if(s)location.href=destination();});
$('#login').addEventListener('click',async()=>{try{status('Autentificare...');const {email,password}=credentials();await signInWithPassword(email,password);location.href=destination();}catch(e){status(e.message,'error');}});
$('#signup').addEventListener('click',async()=>{try{status('Creare cont...');const {email,password}=credentials();const data=await signUp(email,password);status(data.session?'Cont creat. Redirectionare...':'Cont creat. Verifica emailul pentru confirmare.','ok');if(data.session)location.href='home.html';}catch(e){status(e.message,'error');}});
$('#reset').addEventListener('click',async()=>{try{const email=$('#email').value.trim();if(!email.includes('@'))throw new Error('Introdu emailul contului.');await resetPassword(email);status('Email de resetare trimis.','ok');}catch(e){status(e.message,'error');}});
