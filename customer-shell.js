const pages={
  'home.html':'home','top25.html':'discover','discover.html':'discover','commercial-radar.html':'radar','commercial-product.html':'radar','commercial-watchlist.html':'watchlist','commercial-launch.html':'account','account.html':'account','onboarding.html':'account'
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
function install(){
  if(document.querySelector('.customer-bottom-nav'))return;
  document.querySelectorAll('.nav').forEach(x=>x.classList.add('customer-desktop-nav'));
  const nav=document.createElement('nav');
  nav.className='customer-bottom-nav';
  nav.setAttribute('aria-label','Navigație principală');
  nav.innerHTML=items.map(([key,icon,label,href])=>`<a href="${href}" ${key===active?'class="active" aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  document.body.append(nav);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
