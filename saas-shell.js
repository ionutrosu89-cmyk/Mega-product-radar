import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession} from './supabase-client.js';
const badge=document.querySelector('#saasBadge'),account=document.querySelector('#accountLink');
async function load(){const configured=isSaasConfigured(SAAS_CONFIG);if(badge){badge.textContent=configured?'SaaS conectat':'SaaS foundation';badge.dataset.connected=String(configured);}if(!account)return;if(!configured){account.textContent='Cont / Login 7.0';account.href='login.html';return;}const session=await getCurrentSession();account.textContent=session?.user?'Contul meu':'Login';account.href=session?.user?'account.html':'login.html';}
load();
