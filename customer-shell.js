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
function install(){
  normalizeLabels();
  if(document.querySelector('.customer-bottom-nav'))return;
  document.querySelectorAll('.nav').forEach(x=>x.classList.add('customer-desktop-nav'));
  const nav=document.createElement('nav');
  nav.className='customer-bottom-nav';
  nav.setAttribute('aria-label','Navigație principală');
  nav.innerHTML=items.map(([key,icon,label,href])=>`<a href="${href}" ${key===active?'class="active" aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  document.body.append(nav);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
