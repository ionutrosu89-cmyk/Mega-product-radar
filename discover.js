import {hasFeature,planByCode} from './billing-plans.js';
import {roCategory,roProductName} from './product-ro.js';

const PLAN_KEY='megaRadarCommercialPlanV1';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return['http:','https:'].includes(x.protocol)?x.href:'#';}catch{return'#';}};
const num=v=>Number(v||0);
const planCode=String(localStorage.getItem(PLAN_KEY)||'FREE').toUpperCase();
const plan=planByCode(planCode);
const discoverFull=hasFeature(plan.code,'TOP_PRODUCTS');
const radarAccess=hasFeature(plan.code,'RADAR');
let products=[],view='ALL';

function signal(p,key){return p?.signals?.[key]||{};}
function signalCount(p,keys){return keys.reduce((sum,key)=>sum+num(signal(p,key).resultCount),0);}
function present(p,keys){return keys.some(key=>Boolean(signal(p,key).present));}
function amazonCount(p){return signalCount(p,['amazonUS','amazonDE','amazonIT','amazonFR']);}
function amazonPresent(p){return present(p,['amazonUS','amazonDE','amazonIT','amazonFR']);}
function tiktokCount(p){return signalCount(p,['tiktok']);}
function tiktokPresent(p){return present(p,['tiktok']);}
function delta7(p){return num(p?.trendWindows?.d7?.scoreDelta);}
function delta30(p){return num(p?.trendWindows?.d30?.scoreDelta);}
function isRising(p){return delta7(p)>0;}
function isNew(p){const t=Date.parse(p.firstDiscoveredAt||'');return Number.isFinite(t)&&Date.now()-t<=14*86400000;}
function score(p){return num(p?.discoveryAnalysis?.score||p?.score);}
function sourceStatus(p){return String(p.sourceStatus||p?.discoveryAnalysis?.quality?.level||'PARTIAL').toUpperCase();}
function reviewEvidence(p){const r=p.reviewIntel||{};return {sources:num(r.sourceCount),snippets:num(r.snippetCount),confidence:String(r.confidence||'LOW').toUpperCase()};}
function image(p,name){const src=safeUrl(p.imageUrl);return src==='#'?'<div class="media">Imagine în validare</div>':`<div class="media"><img src="${esc(src)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='Imagine indisponibilă'"></div>`;}
function platformBadges(p){const out=[];if(amazonPresent(p)||amazonCount(p)>0)out.push('<span class="badge">Amazon</span>');if(tiktokPresent(p)||tiktokCount(p)>0)out.push('<span class="badge">TikTok</span>');if(isRising(p))out.push('<span class="badge verified">RISING</span>');if(isNew(p))out.push('<span class="badge">NEW</span>');return out.join('');}
function evidenceLink(p){const keys=['amazonDE','amazonUS','tiktok','amazonIT','amazonFR'];for(const key of keys){const s=signal(p,key);const l=(s.links||[])[0];if(l?.url)return safeUrl(l.url);if(s.searchUrl)return safeUrl(s.searchUrl);}if(p.openDiscovery?.url)return safeUrl(p.openDiscovery.url);return '#';}
function lockedCard(){return `<div class="lock-layer"><div class="lock-box"><b>🔒 Mai multe produse în Discover</b><p>Planul Free afișează primele 3 produse. Discover deblochează topurile, filtrele și istoricul complet.</p><a class="upgrade" href="pricing.html">Vezi Discover · €17,90</a></div></div>`;}
function card(p,index){const name=roProductName(p.name),cat=roCategory(p.cat||''),reviews=reviewEvidence(p),aCount=amazonCount(p),tCount=tiktokCount(p),locked=!discoverFull&&index>=3,src=evidenceLink(p),status=sourceStatus(p);return `<article class="card">${locked?lockedCard():''}<div class="top"><div class="product">${image(p,name)}<div class="copy"><h3>${esc(name)}</h3><small>${esc(cat||p.cat||'Categorie')} · ${esc(status)} data</small></div></div><div class="score">${score(p)}<small>DISCOVERY SCORE</small></div></div><div class="badges">${platformBadges(p)}<span class="badge derived">DERIVED</span></div><div class="metrics"><div class="metric"><small>Amazon web signal</small><b>${aCount||'—'}</b></div><div class="metric"><small>TikTok web signal</small><b>${tCount||'—'}</b></div><div class="metric"><small>Review evidence</small><b>${reviews.sources} surse</b></div><div class="metric"><small>Fragmente review</small><b>${reviews.snippets}</b></div></div><div class="trend"><b>Trend derivat:</b> 7 zile ${delta7(p)>0?'+':''}${delta7(p)} · 30 zile ${delta30(p)>0?'+':''}${delta30(p)} · confidence review ${esc(reviews.confidence)}</div><div class="actions">${src!=='#'?`<a href="${esc(src)}" target="_blank" rel="noopener">Vezi dovada</a>`:''}<a class="primary" href="${radarAccess?'radar.html':'pricing.html'}">${radarAccess?'Analizează în Radar':'🔒 Analizează pentru România'}</a></div></article>`;}
function filtered(){const q=(document.querySelector('#search')?.value||'').trim().toLowerCase();let list=products.filter(p=>!q||`${p.name} ${roProductName(p.name)} ${p.cat||''} ${roCategory(p.cat||'')}`.toLowerCase().includes(q));if(view==='AMAZON')list=list.filter(p=>amazonPresent(p)||amazonCount(p)>0);if(view==='TIKTOK')list=list.filter(p=>tiktokPresent(p)||tiktokCount(p)>0);if(view==='RISING')list=list.filter(isRising);if(view==='NEW')list=list.filter(isNew);const sort=document.querySelector('#sort')?.value||'SCORE';list.sort((a,b)=>sort==='RISING'?delta7(b)-delta7(a):sort==='NEW'?Date.parse(b.firstDiscoveredAt||0)-Date.parse(a.firstDiscoveredAt||0):score(b)-score(a));return list.slice(0,20);}
function render(){const list=filtered();document.querySelector('#grid').innerHTML=list.length?list.map(card).join(''):'<div class="empty">Nu există produse pentru filtrul selectat.</div>';document.querySelector('#kVisible').textContent=discoverFull?list.length:Math.min(3,list.length);document.querySelector('#kAmazon').textContent=products.filter(p=>amazonPresent(p)||amazonCount(p)>0).length;document.querySelector('#kTikTok').textContent=products.filter(p=>tiktokPresent(p)||tiktokCount(p)>0).length;document.querySelector('#kRising').textContent=products.filter(isRising).length;document.querySelector('#kLive').textContent=products.filter(p=>['LIVE','PARTIAL'].includes(sourceStatus(p))).length;}
async function load(){document.querySelector('#planName').textContent=plan.name.toUpperCase();const cta=document.querySelector('#upgradeCta');if(cta){cta.textContent=discoverFull?'Discover activ':'Deblochează Discover · €17,90';if(discoverFull)cta.href='account.html';}try{const r=await fetch(`discovery-live.json?t=${Date.now()}`,{cache:'no-store'});const data=r.ok?await r.json():{};products=Array.isArray(data.products)?data.products:[];}catch{products=[];}render();}

document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');view=btn.dataset.view;render();}));
document.querySelector('#search')?.addEventListener('input',render);
document.querySelector('#sort')?.addEventListener('change',render);
load();
