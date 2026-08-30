import {resolveCommercialAccess} from './commercial-access.js';
import {customerNavigationAccess,customerNavigationHref} from './customer-navigation-access.js';

const pages={
  'home.html':'home','top25.html':'discover','discover.html':'discover','commercial-radar.html':'radar','commercial-product.html':'radar','commercial-watchlist.html':'watchlist','commercial-launch.html':'','account.html':'account','onboarding.html':''
};
const file=(location.pathname.split('/').pop()||'home.html').toLowerCase();
const active=pages[file]||'';
const items=[
  ['home','⌂','Home','home.html'],
  ['discover','⌕','Discover','discover.html'],
  ['radar','◎','Radar','commercial-radar.html'],
  ['watchlist','☆','Watchlist','commercial-watchlist.html'],
  ['account','○','Cont','account.html']
];
const translations=new Map([
  ['WHAT IS SELLING?','CE SE MIȘCĂ ÎN PIAȚĂ?'],
  ['FREE PRODUCT INTELLIGENCE','INTELLIGENCE GRATUIT'],
  ['CUSTOMER RETENTION','MONITORIZARE PRODUSE'],
  ['COMMERCIAL PRODUCT CASE','DOSARUL PRODUSULUI'],
  ['HOW DO I LAUNCH IT?','PLANUL DE LANSARE'],
  ['WHAT SHOULD I SELL?','CE MERITĂ SĂ VINZI?'],
  ['YOUR NEXT BEST ACTION','URMĂTORUL PAS RECOMANDAT'],
  ['PERSONALIZE YOUR RADAR','PERSONALIZEAZĂ RADARUL']
]);
function normalizeLabels(){
  document.querySelectorAll('header .eyebrow,header [style*="letter-spacing"]').forEach(node=>{const key=(node.textContent||'').trim();if(translations.has(key))node.textContent=translations.get(key);});
  document.querySelectorAll('header a,.nav a').forEach(node=>{if((node.textContent||'').trim()==='Account')node.textContent='Cont';});
}
function applyLinkAccess(anchor,access){
  const original=anchor.getAttribute('href')||'';
  const gate=customerNavigationAccess(access.plan.code,original);
  if(gate.allowed){anchor.classList.remove('customer-nav-locked');anchor.removeAttribute('data-required-plan');return;}
  anchor.href=customerNavigationHref(access.plan.code,original);
  anchor.classList.add('customer-nav-locked');
  anchor.dataset.requiredPlan=gate.upgradePlan;
  anchor.setAttribute('aria-label',`${(anchor.textContent||'').trim()} — necesită planul ${gate.upgradePlan}`);
  anchor.title=`Necesită planul ${gate.upgradePlan}`;
}
function applyDesktopAccess(access){
  document.querySelectorAll('.customer-desktop-nav a').forEach(anchor=>applyLinkAccess(anchor,access));
}
async function install(){
  normalizeLabels();
  if(document.querySelector('.customer-bottom-nav'))return;
  document.querySelectorAll('.nav').forEach(x=>x.classList.add('customer-desktop-nav'));
  const access=await resolveCommercialAccess();
  document.documentElement.dataset.mprPlan=access.plan.code;
  applyDesktopAccess(access);
  const nav=document.createElement('nav');
  nav.className='customer-bottom-nav';
  nav.setAttribute('aria-label','Navigație principală');
  nav.innerHTML=items.map(([key,icon,label,href])=>{
    const gate=customerNavigationAccess(access.plan.code,href),target=customerNavigationHref(access.plan.code,href),locked=!gate.allowed;
    const classes=[key===active?'active':'',locked?'customer-nav-locked':''].filter(Boolean).join(' ');
    const lock=locked?'<i class="customer-nav-lock" aria-hidden="true">🔒</i>':'';
    return `<a href="${target}" ${classes?`class="${classes}"`:''} ${key===active?'aria-current="page"':''} ${locked?`data-required-plan="${gate.upgradePlan}" aria-label="${label} — necesită planul ${gate.upgradePlan}" title="Necesită planul ${gate.upgradePlan}"`:''}><span aria-hidden="true">${icon}</span>${label}${lock}</a>`;
  }).join('');
  document.body.append(nav);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install().catch(()=>{});});else install().catch(()=>{});
