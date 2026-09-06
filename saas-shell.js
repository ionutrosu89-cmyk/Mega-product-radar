import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession} from './supabase-client.js';

const recoveryHash=new URLSearchParams(location.hash.replace(/^#/,''));
const recoveryFallback=recoveryHash.get('type')==='recovery';
if(recoveryFallback){
  const target=new URL('account.html?reset=1',location.href);
  target.hash=location.hash;
  location.replace(target.href);
}else{
  const badge=document.querySelector('#saasBadge'),account=document.querySelector('#accountLink');
  document.querySelectorAll('a[href="discovery-inbox.html"]').forEach(a=>a.href='discover.html');
  async function load(){const configured=isSaasConfigured(SAAS_CONFIG);if(badge){badge.textContent=configured?'SaaS conectat':'SaaS foundation';badge.dataset.connected=String(configured);}if(!account)return;if(!configured){account.textContent='Cont / Login 7.0';account.href='login.html';return;}const session=await getCurrentSession();account.textContent=session?.user?'Contul meu':'Login';account.href=session?.user?'account.html':'login.html';}
  load();
}
