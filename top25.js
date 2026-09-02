import {FREE_TOP25_NICHES} from './free-top25-data.js';
import {hardenTop25Evidence,TOP25_EVIDENCE_REVIEWED_AT} from './top25-evidence.js';
import {prepareTop25MovementCentral,top25ProductKey,movementDisplay,sourceMovementDisplay} from './top25-movement.js';
import {trackJourneyEvent} from './journey-events.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return ['http:','https:'].includes(x.protocol)?x.href:'#';}catch{return'#';}};
const representativeImageUrl=name=>`https://tse1.mm.bing.net/th?q=${encodeURIComponent(`${String(name||'').trim()} product`)}&pid=Api`;
const fmtMetric=m=>{if(!m)return '—';if(m.unit==='searches')return `${Number(m.value||0).toLocaleString('ro-RO')} căutări`;if(m.unit==='results')return `${Number(m.value||0).toLocaleString('ro-RO')} rezultate`;if(m.unit==='reviews_historical')return `${Number(m.value||0).toLocaleString('ro-RO')} recenzii istorice`;return String(m.value??'—');};
const evidenceTypeLabel=type=>({EXACT_RANK:'RANK EXACT OBSERVAT',EXACT_PRODUCT:'PRODUS LISTAT',HISTORICAL_PRODUCT:'PRODUS ISTORIC LICENȚIAT',SEARCH_VOLUME:'VOLUM CĂUTĂRI',TREND_SIGNAL:'SEMNAL TREND',EDITORIAL_SIGNAL:'SEMNAL EDITORIAL',CATEGORY_EVIDENCE:'DOVADĂ CATEGORIE'}[type]||'DOVADĂ PUBLICĂ');
const fmtDate=value=>{if(!value)return '—';const raw=String(value);const d=new Date(raw.length===10?`${raw}T00:00:00`:raw);return Number.isNaN(d.getTime())?raw:new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric'}).format(d);};
const normalizeSearch=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
let niches=[...FREE_TOP25_NICHES];
let current=niches[0];
let renderToken=0;

function tabs(){
  const root=$('#tabs'),search=$('#nicheSearch'),counter=$('#nicheCount');
  const draw=()=>{
    const query=normalizeSearch(search?.value);
    const visible=query?niches.filter(niche=>normalizeSearch(`${niche.label} ${niche.id}`).includes(query)):niches;
    root.innerHTML=visible.map(n=>`<button data-niche="${esc(n.id)}" class="${n.id===current?.id?'active':''}">${n.emoji} ${esc(n.label)}${n.mode==='LIVE_EVIDENCE'?' · LIVE':n.mode==='LICENSED_HISTORICAL_EVIDENCE'?' · DATASET':''}</button>`).join('')||'<span>Nu am găsit această nișă.</span>';
    if(counter)counter.textContent=`${visible.length}/${niches.length} nișe · ${niches.length*25} produse urmărite`;
  };
  root.addEventListener('click',event=>{const btn=event.target.closest('[data-niche]');if(!btn)return;const next=niches.find(n=>n.id===btn.dataset.niche);if(!next)return;current=next;draw();render();});
  search?.addEventListener('input',draw);
  draw();
}

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
  return `<article class="card" data-product="${esc(p.name)}"><div class="rank">#${p.rank}</div><div class="movement ${esc(mv.tone)}"><b>${esc(mv.label)}</b><span>${esc(mv.detail)}</span><small>${esc(movementContext)}</small></div><div class="product"><div class="media"><img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"><span>Imagine reprezentativă</span></div><div class="copy"><h3>${esc(p.name)}</h3><small>${esc(current.label)} · rank intern DERIVED</small></div></div><div class="stats"><div class="stat"><small>Rank sursă observat</small><b>${esc(rankSource)}</b></div><div class="stat"><small>Încredere în dovadă</small><b>${esc(p.evidenceConfidence)}</b></div><div class="stat"><small>Tip dovadă</small><b>${esc(evidenceTypeLabel(liveEvidenceType))}</b></div><div class="stat"><small>Statistică publică</small><b>${esc(fmtMetric(p.metric))}</b></div></div><div class="evidence"><div class="src"><small>Sursă · Tier ${esc(p.sourceTier)} · ${esc(p.sourcePeriod)}</small><b>${esc(p.sourceLabel)}</b><small>Revizie dovadă · ${esc(fmtDate(reviewedAt))}</small></div><span class="chip ${String(p.sourceTier).toLowerCase()}">${esc(p.evidenceClass)}</span>${sourceUrl!=='#'?`<a class="source-link" data-product-opened href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Vezi sursa</a>`:''}</div><div class="beta-decision"><small>Decizia ta după această analiză</small><div><button type="button" data-product-decision="INVESTIGATE">Merită investigat</button><button type="button" data-product-decision="HOLD">Nu acum</button><button type="button" data-product-decision="UNKNOWN">Dovezi insuficiente</button></div></div><div class="actions"><a class="discover" data-product-opened href="discover.html">Urmărește în Discover</a><a class="source" data-product-opened href="pricing.html?upgrade=RADAR">Analizează pentru România</a></div></article>`;
}

async function render(){
  const token=++renderToken,niche=current,products=Array.isArray(niche.products)?niche.products.slice(0,25):[];
  const reviewedAt=niche.reviewedAt||TOP25_EVIDENCE_REVIEWED_AT;
  $('#nicheTitle').textContent=`${niche.emoji} Top 25 · ${niche.label}`;
  $('#nicheText').textContent=niche.mode==='LIVE_EVIDENCE'
    ?`${products.length} produse selectate automat din evidence live. O nișă LIVE apare numai când există 25/25 produse cu sursă publică directă.`
    :niche.mode==='LICENSED_HISTORICAL_EVIDENCE'
      ?`${products.length} produse din dataset licențiat, ordonate după dovada istorică disponibilă. Nu reprezintă vânzări curente; brand gate rămâne obligatoriu înainte de analiză comercială.`
      :`${products.length} produse cu sursă publică atașată. Rank-ul intern este DERIVED; mișcarea se calculează numai între două revizii distincte.`;
  $('#coverage').textContent=`${products.length}/25${niche.mode==='LIVE_EVIDENCE'?' LIVE':niche.mode==='LICENSED_HISTORICAL_EVIDENCE'?' DATASET':''}`;
  const trackingEl=$('#trackingStatus');if(trackingEl)trackingEl.textContent='Se încarcă istoricul central…';

  const tracking=await prepareTop25MovementCentral(niche,reviewedAt);
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
  trackJourneyEvent('TOP25_SEARCHED',{nicheId:niche.id,nicheLabel:niche.label,productCount:products.length,evidenceMode:niche.mode||'CURATED'});
}

async function loadLiveNiches(){
  for(const endpoint of ['/api/free/niches','/api/free/top25']){
    try{
      const response=await fetch(endpoint,{headers:{accept:'application/json'},cache:'no-store'});
      const payload=await response.json();
      if(!response.ok||!payload?.ok||!Array.isArray(payload.niches))continue;
      const live=payload.niches
        .filter(niche=>Array.isArray(niche?.products)&&niche.products.length===25)
        .map(niche=>({...niche,id:niche.id||niche.nicheKey,emoji:niche.emoji||'📊',mode:'LIVE_EVIDENCE',reviewedAt:payload.updatedAt||TOP25_EVIDENCE_REVIEWED_AT}));
      if(!live.length)continue;
      const liveLabels=new Set(live.map(niche=>String(niche.label||'').trim().toLowerCase()));
      niches=[...live,...FREE_TOP25_NICHES.filter(niche=>!liveLabels.has(String(niche.label||'').trim().toLowerCase()))];
      current=niches[0]||FREE_TOP25_NICHES[0];
      return;
    }catch{/* Try the compatible endpoint, then keep the curated fallback. */}
  }
}

await loadLiveNiches();
tabs();
$('#grid').addEventListener('click',event=>{
  const card=event.target.closest?.('[data-product]');if(!card)return;
  const product=card.dataset.product||'';
  const opened=event.target.closest?.('[data-product-opened]');
  if(opened)trackJourneyEvent('PRODUCT_OPENED',{product,nicheId:current.id,nicheLabel:current.label,target:opened.getAttribute('href')||''});
  const decision=event.target.closest?.('[data-product-decision]');if(!decision)return;
  card.querySelectorAll('[data-product-decision]').forEach(button=>{button.classList.toggle('selected',button===decision);button.setAttribute('aria-pressed',String(button===decision));});
  trackJourneyEvent('DECISION_REACHED',{product,nicheId:current.id,nicheLabel:current.label,decision:decision.dataset.productDecision,source:'TOP25'});
});
render();
