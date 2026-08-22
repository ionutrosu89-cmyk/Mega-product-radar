import {FREE_TOP25_NICHES} from './free-top25-data.js';
import {hardenTop25Evidence,TOP25_EVIDENCE_REVIEWED_AT} from './top25-evidence.js';
import {prepareTop25MovementCentral,top25ProductKey,movementDisplay,sourceMovementDisplay} from './top25-movement.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return ['http:','https:'].includes(x.protocol)?x.href:'#';}catch{return'#';}};
const representativeImageUrl=name=>`https://tse1.mm.bing.net/th?q=${encodeURIComponent(`${String(name||'').trim()} product`)}&pid=Api`;
const fmtMetric=m=>{if(!m)return '—';if(m.unit==='searches')return `${Number(m.value||0).toLocaleString('ro-RO')} căutări`;return String(m.value??'—');};
const evidenceTypeLabel=type=>({EXACT_RANK:'RANK EXACT OBSERVAT',EXACT_PRODUCT:'PRODUS LISTAT',SEARCH_VOLUME:'VOLUM CĂUTĂRI',TREND_SIGNAL:'SEMNAL TREND',EDITORIAL_SIGNAL:'SEMNAL EDITORIAL',CATEGORY_EVIDENCE:'DOVADĂ CATEGORIE'}[type]||'DOVADĂ PUBLICĂ');
const fmtDate=value=>{if(!value)return '—';const raw=String(value);const d=new Date(raw.length===10?`${raw}T00:00:00`:raw);return Number.isNaN(d.getTime())?raw:new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric'}).format(d);};
let current=FREE_TOP25_NICHES[0];
let renderToken=0;

function tabs(){const root=$('#tabs');root.innerHTML=FREE_TOP25_NICHES.map((n,i)=>`<button data-niche="${esc(n.id)}" class="${i===0?'active':''}">${n.emoji} ${esc(n.label)}</button>`).join('');root.addEventListener('click',event=>{const btn=event.target.closest('[data-niche]');if(!btn)return;const next=FREE_TOP25_NICHES.find(n=>n.id===btn.dataset.niche);if(!next)return;current=next;root.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));render();});}

function card(raw,movement,previousReviewedAt,currentEvidence,currentReviewedAt){
  const p=hardenTop25Evidence(raw);
  const sourceUrl=safeUrl(p.sourceUrl),image=safeUrl(representativeImageUrl(p.name));
  const sourceMove=sourceMovementDisplay(movement);
  const liveSourceRank=Number.isInteger(currentEvidence?.sourceRank)?currentEvidence.sourceRank:(p.sourceRankObserved?p.sourceRank:null);
  const rankSource=Number.isInteger(liveSourceRank)?`#${liveSourceRank}${sourceMove?` · ${sourceMove}`:''}`:'—';
  const liveExactRank=Boolean(currentEvidence?.rankAutoObserved)||p.sourceRankObserved;
  const liveEvidenceType=liveExactRank?'EXACT_RANK':p.evidenceType;
  const mv=movementDisplay(movement);
  const movementContext=previousReviewedAt?`Față de ${fmtDate(previousReviewedAt)}`:'Istoric pornit la această revizie';
  const reviewedAt=currentReviewedAt||p.evidenceReviewedAt;
  return `<article class="card"><div class="rank">#${p.rank}</div><div class="movement ${esc(mv.tone)}"><b>${esc(mv.label)}</b><span>${esc(mv.detail)}</span><small>${esc(movementContext)}</small></div><div class="product"><div class="media"><img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"><span>Imagine reprezentativă</span></div><div class="copy"><h3>${esc(p.name)}</h3><small>${esc(current.label)} · rank intern DERIVED</small></div></div><div class="stats"><div class="stat"><small>Rank sursă observat</small><b>${esc(rankSource)}</b></div><div class="stat"><small>Încredere în dovadă</small><b>${esc(p.evidenceConfidence)}</b></div><div class="stat"><small>Tip dovadă</small><b>${esc(evidenceTypeLabel(liveEvidenceType))}</b></div><div class="stat"><small>Statistică publică</small><b>${esc(fmtMetric(p.metric))}</b></div></div><div class="evidence"><div class="src"><small>Sursă · Tier ${esc(p.sourceTier)} · ${esc(p.sourcePeriod)}</small><b>${esc(p.sourceLabel)}</b><small>Revizie dovadă · ${esc(fmtDate(reviewedAt))}</small></div><span class="chip ${String(p.sourceTier).toLowerCase()}">${esc(p.evidenceClass)}</span>${sourceUrl!=='#'?`<a class="source-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Vezi sursa</a>`:''}</div><div class="actions"><a class="discover" href="discover.html">Urmărește în Discover</a><a class="source" href="pricing.html?upgrade=RADAR">Analizează pentru România</a></div></article>`;
}

async function render(){
  const token=++renderToken,niche=current,products=Array.isArray(niche.products)?niche.products.slice(0,25):[];
  $('#nicheTitle').textContent=`${niche.emoji} Top 25 · ${niche.label}`;
  $('#nicheText').textContent=`${products.length} produse cu sursă publică atașată. Rank-ul intern este DERIVED; mișcarea se calculează numai între două revizii distincte.`;
  $('#coverage').textContent=`${products.length}/25`;
  const trackingEl=$('#trackingStatus');if(trackingEl)trackingEl.textContent='Se încarcă istoricul central…';

  const tracking=await prepareTop25MovementCentral(niche,TOP25_EVIDENCE_REVIEWED_AT);
  if(token!==renderToken||current!==niche)return;
  if(trackingEl){
    const mode=tracking.historyMode==='CENTRAL'?'istoric central':'fallback local';
    const compare=tracking.previousReviewedAt?`Comparat cu revizia ${fmtDate(tracking.previousReviewedAt)}`:'BAZĂ · prima revizie centrală';
    const checked=tracking.lastCheckedAt?` · verificat automat ${fmtDate(tracking.lastCheckedAt)}`:'';
    const sourceHealth=tracking.refreshSources?` · surse ${tracking.refreshSources.ok}/${tracking.refreshSources.total}`:'';
    trackingEl.textContent=`${compare} · ${mode}${checked}${sourceHealth}`;
  }
  $('#grid').innerHTML=products.map(raw=>{
    const key=top25ProductKey(raw);
    return card(raw,tracking.movements.get(key),tracking.previousReviewedAt,tracking.currentProducts?.get(key),tracking.currentReviewedAt);
  }).join('')||'<div class="card">Nu există încă produse documentate pentru această nișă.</div>';
}

tabs();render();
