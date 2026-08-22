import {FREE_TOP25_NICHES} from './free-top25-data.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return ['http:','https:'].includes(x.protocol)?x.href:'#';}catch{return'#';}};
const representativeImageUrl=name=>`https://tse1.mm.bing.net/th?q=${encodeURIComponent(`${String(name||'').trim()} product`)}&pid=Api`;
const confidence=tier=>tier==='A'?'HIGH':tier==='B'?'MEDIUM':'MEDIUM';
const fmtMetric=m=>{if(!m)return '—';if(m.unit==='searches')return `${Number(m.value||0).toLocaleString('ro-RO')} căutări`;return String(m.value??'—');};
let current=FREE_TOP25_NICHES[0];

function tabs(){const root=$('#tabs');root.innerHTML=FREE_TOP25_NICHES.map((n,i)=>`<button data-niche="${esc(n.id)}" class="${i===0?'active':''}">${n.emoji} ${esc(n.label)}</button>`).join('');root.addEventListener('click',event=>{const btn=event.target.closest('[data-niche]');if(!btn)return;const next=FREE_TOP25_NICHES.find(n=>n.id===btn.dataset.niche);if(!next)return;current=next;root.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));render();});}

function card(p){const sourceUrl=safeUrl(p.sourceUrl),image=safeUrl(representativeImageUrl(p.name)),rankSource=p.sourceRank?`#${p.sourceRank}`:'—';return `<article class="card"><div class="rank">#${p.rank}</div><div class="product"><div class="media"><img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"><span>Imagine reprezentativă</span></div><div class="copy"><h3>${esc(p.name)}</h3><small>${esc(current.label)} · rank intern DERIVED</small></div></div><div class="stats"><div class="stat"><small>Rank sursă</small><b>${esc(rankSource)}</b></div><div class="stat"><small>Source confidence</small><b>${esc(confidence(p.sourceTier))}</b></div><div class="stat"><small>Statistică publică</small><b>${esc(fmtMetric(p.metric))}</b></div></div><div class="evidence"><div class="src"><small>Sursă · Tier ${esc(p.sourceTier)} · ${esc(p.sourcePeriod)}</small><b>${esc(p.sourceLabel)}</b></div><span class="chip ${String(p.sourceTier).toLowerCase()}">${esc(p.evidenceClass)}</span>${sourceUrl!=='#'?`<a class="source-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Vezi sursa</a>`:''}</div><div class="actions"><a class="discover" href="discover.html">Urmărește în Discover</a><a class="source" href="pricing.html?upgrade=RADAR">Analizează pentru România</a></div></article>`;}

function render(){const products=Array.isArray(current.products)?current.products.slice(0,25):[];$('#nicheTitle').textContent=`${current.emoji} Top 25 · ${current.label}`;$('#nicheText').textContent=`${products.length} produse cu sursă publică atașată. Rank-ul intern sintetizează sursa și nu este prezentat ca vânzare confirmată.`;$('#coverage').textContent=`${products.length}/25`;$('#grid').innerHTML=products.map(card).join('')||'<div class="card">Nu există încă produse documentate pentru această nișă.</div>';}

tabs();render();
