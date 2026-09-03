import {hardenTop25Evidence,TOP25_EVIDENCE_REVIEWED_AT} from './top25-evidence.js';
import {prepareTop25MovementCentral,top25ProductKey,movementDisplay,sourceMovementDisplay} from './top25-movement.js';
import {trackJourneyEvent} from './journey-events.js';
import {installFreeDemandTracking,trackFreeDemand} from './free-demand.js';
import {FREE_CROSS_MARKET_PLATFORMS} from './free-cross-market-registry.js';
import {freeProductKey,readFreeShortlist,toggleComparison,toggleFreeShortlist} from './free-shortlist.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl=value=>{try{const url=new URL(String(value||''),location.href);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch{return'#';}};
const normalizeSearch=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const fmtDate=value=>{if(!value)return '—';const raw=String(value),date=new Date(raw.length===10?`${raw}T00:00:00`:raw);return Number.isNaN(date.getTime())?raw:new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric'}).format(date);};
const fmtMetric=metric=>{if(!metric)return '—';const value=Number(metric.value||0).toLocaleString('ro-RO');if(metric.unit==='searches')return `${value} căutări`;if(metric.unit==='results')return `${value} rezultate`;if(metric.unit==='reviews_historical')return `${value} recenzii istorice`;return `${value}${metric.label?` · ${metric.label}`:''}`;};
const evidenceTypeLabel=type=>({EXACT_RANK:'RANK EXACT OBSERVAT',EXACT_PRODUCT:'PRODUS LISTAT',HISTORICAL_PRODUCT:'PRODUS ISTORIC LICENȚIAT',SEARCH_VOLUME:'VOLUM CĂUTĂRI',TREND_SIGNAL:'SEMNAL TREND',EDITORIAL_SIGNAL:'SEMNAL EDITORIAL',CATEGORY_EVIDENCE:'DOVADĂ CATEGORIE'}[type]||'DOVADĂ PUBLICĂ');
const statusLabel=status=>({LIVE:'LIVE',AVAILABLE_ARCHIVE:'ARHIVĂ',ACCESS_REQUIRED:'ACCES NECESAR',TERMS_REVIEW_REQUIRED:'TERMENI ÎN REVIZIE',READY_TO_COLLECT:'GATA DE COLECTARE',WAITING_FOR_TWO_LIVE_PLATFORMS:'AȘTEAPTĂ 2 SURSE'}[status]||'ÎN PREGĂTIRE');

let niches=[],current=null,crossMarket={platforms:FREE_CROSS_MARKET_PLATFORMS,rankings:[],coverage:{}},selectedPlatform='AMAZON_ARCHIVE';
let shortlist=readFreeShortlist(),comparison=new Set(),shortlistOnly=false,renderToken=0;
const trackingCache=new Map();

const currentPlatform=()=>crossMarket.platforms.find(platform=>platform.id===selectedPlatform)||FREE_CROSS_MARKET_PLATFORMS.at(-1);
const currentRanking=()=>crossMarket.rankings.find(row=>row.platform===selectedPlatform&&row.nicheId===current?.id)||null;
const platformProducts=()=>selectedPlatform==='AMAZON_ARCHIVE'?(current?.products||[]):(currentRanking()?.products||[]);

function drawNicheTabs(){
  const root=$('#tabs'),query=normalizeSearch($('#nicheSearch')?.value);
  const visible=query?niches.filter(niche=>normalizeSearch(`${niche.label} ${niche.id}`).includes(query)):niches;
  root.innerHTML=visible.map(niche=>`<button data-niche="${esc(niche.id)}" class="${niche.id===current?.id?'active':''}">${niche.emoji} ${esc(niche.label)}</button>`).join('')||'<span>Nu am găsit această nișă.</span>';
  $('#nicheCount').textContent=`${visible.length}/${niches.length} nișe · ${niches.length*25} poziții în arhivă`;
}

function installNicheTabs(){
  $('#tabs').addEventListener('click',event=>{
    const button=event.target.closest('[data-niche]');if(!button)return;
    const next=niches.find(niche=>niche.id===button.dataset.niche);if(!next)return;
    current=next;comparison=new Set();drawNicheTabs();
    trackFreeDemand('FREE_NICHE_SELECTED',{nicheId:next.id,nicheLabel:next.label,target:`PLATFORM:${selectedPlatform}`});
    render({trackSearch:true});
  });
  $('#nicheSearch')?.addEventListener('input',drawNicheTabs);drawNicheTabs();
}

function drawMarketTabs(){
  $('#marketTabs').innerHTML=crossMarket.platforms.map(platform=>`<button type="button" data-platform="${esc(platform.id)}" class="${platform.id===selectedPlatform?'active':''}"><span>${esc(platform.emoji)}</span><b>${esc(platform.shortLabel)}</b><small>${esc(statusLabel(platform.status))}</small></button>`).join('');
  drawMarketContext();
}

function drawMarketContext(){
  const platform=currentPlatform(),isArchive=platform.id==='AMAZON_ARCHIVE',isLive=platform.status==='LIVE';
  const descriptions={CONSENSUS:'Se activează numai după ce același concept este confirmat de minimum două platforme live independente.',ALIEXPRESS:'Va folosi Hot Products din accesul oficial AliExpress; nu publicăm rezultate copiate sau volume neverificate.',EBAY:'Va folosi BEST_SELLING din eBay Marketing API. Poziția platformei nu este prezentată ca număr de unități vândute.',AMAZON_US:'Clasament actual pentru SUA, numai din acces oficial sau licențiat și cu dată de observare.',AMAZON_DE:'Confirmare europeană actuală, separată de piața SUA și de arhiva istorică.',TIKTOK:'Semnal de Shop/reclame și accelerație; viralitatea nu este echivalentă cu vânzări.',GOOGLE:'Best Sellers sau accelerarea căutărilor, etichetate separat după tipul dovezii.',ROMANIA:'Numărul ofertelor comparabile și suprafețelor independente din România, nu vânzări locale.',AMAZON_ARCHIVE:'625 de poziții din catalogul istoric licențiat 2023. Arhiva este pentru explorare și nu intră în Consensus Live 2026.'};
  $('#marketContext').innerHTML=`<div><small>COMPARAȚIE SELECTATĂ</small><b>${esc(platform.emoji)} ${esc(platform.label)}</b><p>${esc(descriptions[platform.id]||'Sursă în pregătire.')}</p></div><div class="market-health ${isLive?'live':isArchive?'archive':'waiting'}"><b>${esc(statusLabel(platform.status))}</b><span>${Number(platform.publishedPositions||0).toLocaleString('ro-RO')} poziții publicate</span></div>${!isLive&&!isArchive?`<button type="button" data-platform-request="${esc(platform.id)}">Vreau acest Top 25</button>`:''}`;
}

function installMarketTabs(){
  $('#marketTabs').addEventListener('click',event=>{
    const button=event.target.closest('[data-platform]');if(!button)return;
    selectedPlatform=button.dataset.platform;comparison=new Set();drawMarketTabs();
    trackFreeDemand('FREE_NICHE_SELECTED',{nicheId:current?.id,nicheLabel:current?.label,target:`PLATFORM:${selectedPlatform}`});render({trackSearch:true});
  });
  $('#marketContext').addEventListener('click',event=>{
    const button=event.target.closest('[data-platform-request]');if(!button)return;
    button.disabled=true;button.textContent='Cerere înregistrată ✓';
    trackFreeDemand('FREE_DECISION_REACHED',{nicheId:current?.id,nicheLabel:current?.label,decision:'REQUEST_PLATFORM',target:`PLATFORM:${button.dataset.platform}`});
  });
  drawMarketTabs();
}

function displayProduct(raw){
  if(selectedPlatform==='AMAZON_ARCHIVE')return hardenTop25Evidence(raw);
  return {...raw,name:raw.name,rank:raw.rank,sourceUrl:raw.sourceUrl,sourceLabel:raw.sourceLabel,sourceTier:'A',sourcePeriod:`observat ${fmtDate(raw.observedAt)}`,sourceRank:raw.rank,sourceRankObserved:true,evidenceType:'EXACT_RANK',evidenceConfidence:raw.evidenceClass==='DIRECT'?'HIGH':'MEDIUM',evidenceClass:raw.evidenceClass,evidenceReviewedAt:raw.observedAt,metric:raw.sourceMetric||null};
}

function card(raw,movement,previousReviewedAt,currentEvidence,currentReviewedAt){
  const product=displayProduct(raw),sourceUrl=safeUrl(product.sourceUrl),key=freeProductKey(raw,selectedPlatform);
  const sourceMove=sourceMovementDisplay(movement),liveSourceRank=Number.isInteger(currentEvidence?.sourceRank)?currentEvidence.sourceRank:(product.sourceRankObserved?product.sourceRank:null);
  const rankSource=Number.isInteger(liveSourceRank)?`#${liveSourceRank}${sourceMove?` · ${sourceMove}`:''}`:'—';
  const liveEvidenceType=Boolean(currentEvidence?.rankAutoObserved)||product.sourceRankObserved?'EXACT_RANK':product.evidenceType;
  const mv=selectedPlatform==='AMAZON_ARCHIVE'?movementDisplay(movement):{tone:'new',label:'LIVE',detail:fmtDate(raw.observedAt)};
  const movementContext=previousReviewedAt?`Față de ${fmtDate(previousReviewedAt)}`:selectedPlatform==='AMAZON_ARCHIVE'?'Prima revizie centrală':'Observație recentă';
  const reviewedAt=currentReviewedAt||product.evidenceReviewedAt,saved=shortlist.has(key),compared=comparison.has(key);
  return `<article class="card" data-product="${esc(product.name)}" data-product-key="${esc(key)}"><div class="rank">#${product.rank}</div><div class="movement ${esc(mv.tone)}"><b>${esc(mv.label)}</b><span>${esc(mv.detail)}</span><small>${esc(movementContext)}</small></div><div class="product"><div class="media" aria-hidden="true"><span class="placeholder">${esc(current.emoji||'📦')}</span></div><div class="copy"><h3>${esc(product.name)}</h3><small>${esc(current.label)} · ${selectedPlatform==='AMAZON_ARCHIVE'?'rank MPR DERIVED':`rank ${esc(currentPlatform().shortLabel)}`}</small></div></div><div class="quick-actions"><button type="button" data-shortlist class="${saved?'selected':''}" aria-pressed="${saved}">${saved?'★ Salvat':'☆ Salvează'}</button><button type="button" data-compare class="${compared?'selected':''}" aria-pressed="${compared}">${compared?'✓ Compară':'⇄ Compară'}</button></div><div class="stats"><div class="stat"><small>Rank sursă observat</small><b>${esc(rankSource)}</b></div><div class="stat"><small>Încredere în dovadă</small><b>${esc(product.evidenceConfidence)}</b></div><div class="stat"><small>Tip dovadă</small><b>${esc(evidenceTypeLabel(liveEvidenceType))}</b></div><div class="stat"><small>Statistică publică</small><b>${esc(fmtMetric(product.metric))}</b></div></div><div class="evidence"><div class="src"><small>Sursă · Tier ${esc(product.sourceTier)} · ${esc(product.sourcePeriod)}</small><b>${esc(product.sourceLabel)}</b><small>Revizie dovadă · ${esc(fmtDate(reviewedAt))}</small></div><span class="chip ${String(product.sourceTier).toLowerCase()}">${esc(product.evidenceClass)}</span>${sourceUrl!=='#'?`<a class="source-link" data-product-opened data-product-action="source" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Vezi sursa</a>`:''}</div><div class="beta-decision"><small>Decizia ta după această analiză</small><div><button type="button" data-product-decision="INVESTIGATE">Merită investigat</button><button type="button" data-product-decision="HOLD">Nu acum</button><button type="button" data-product-decision="UNKNOWN">Dovezi insuficiente</button></div></div><div class="actions"><a class="discover" data-product-opened data-product-action="discover" href="login.html?next=discover.html">Creează cont și urmărește</a><a class="source" data-product-opened data-product-action="romania" href="pricing.html?upgrade=RADAR">Vreau analiza România</a></div></article>`;
}

function filteredProducts(products){
  const query=normalizeSearch($('#productSearch')?.value);let rows=products.filter(product=>!query||normalizeSearch(product.name||product.title).includes(query));
  if(shortlistOnly)rows=rows.filter(product=>shortlist.has(freeProductKey(product,selectedPlatform)));
  const sort=$('#productSort')?.value||'RANK';
  if(sort==='NAME')rows.sort((a,b)=>String(a.name||a.title).localeCompare(String(b.name||b.title),'ro'));
  if(sort==='REVIEWS')rows.sort((a,b)=>Number(b?.metric?.value||b?.reviewCount||0)-Number(a?.metric?.value||a?.reviewCount||0));
  return rows;
}

function drawCompareTray(){const tray=$('#compareTray'),count=comparison.size;tray.hidden=count===0;$('#compareCount').textContent=String(count);$('#shortlistCount').textContent=String(shortlist.size);}

function openComparison(){
  const products=platformProducts().filter(product=>comparison.has(freeProductKey(product,selectedPlatform))).map(displayProduct);if(products.length<2)return;
  $('#compareContent').innerHTML=`<div class="compare-table"><div class="compare-row head"><span>Criteriu</span>${products.map(product=>`<b>${esc(product.name)}</b>`).join('')}</div><div class="compare-row"><span>Poziție</span>${products.map(product=>`<b>#${product.rank}</b>`).join('')}</div><div class="compare-row"><span>Platformă</span>${products.map(()=>`<b>${esc(currentPlatform().shortLabel)}</b>`).join('')}</div><div class="compare-row"><span>Dovadă</span>${products.map(product=>`<b>${esc(product.evidenceClass)}</b>`).join('')}</div><div class="compare-row"><span>Statistică</span>${products.map(product=>`<b>${esc(fmtMetric(product.metric))}</b>`).join('')}</div><div class="compare-row"><span>Data</span>${products.map(product=>`<b>${esc(fmtDate(product.evidenceReviewedAt))}</b>`).join('')}</div></div>`;
  $('#compareDialog').showModal();trackFreeDemand('FREE_PRODUCT_OPENED',{nicheId:current.id,nicheLabel:current.label,target:'COMPARE',productCount:products.length});
}

async function trackingFor(niche,reviewedAt){
  if(selectedPlatform!=='AMAZON_ARCHIVE')return {movements:new Map(),currentProducts:new Map(),previousReviewedAt:null,currentReviewedAt:reviewedAt,historyMode:'LIVE'};
  const key=`${niche.id}:${reviewedAt}`;if(!trackingCache.has(key))trackingCache.set(key,prepareTop25MovementCentral(niche,reviewedAt));return trackingCache.get(key);
}

function emptyState(platform){
  if(shortlistOnly)return '<div class="empty-state"><b>Shortlist-ul este gol pentru această listă.</b><p>Salvează produsele interesante cu butonul „Salvează”. Lista rămâne numai pe dispozitivul tău.</p></div>';
  return `<div class="empty-state"><b>${esc(platform.label)} nu este încă publicat pentru ${esc(current.label)}.</b><p>Nu completăm spațiul cu rezultate inventate. Publicăm lista numai când avem 25 poziții recente, sursă permisă și etichetare corectă a semnalului.</p><button type="button" data-empty-request="${esc(platform.id)}">Anunță interesul pentru această listă</button></div>`;
}

async function render({trackSearch=false}={}){
  if(!current)return;
  const token=++renderToken,niche=current,platform=currentPlatform(),sourceProducts=platformProducts(),products=filteredProducts(sourceProducts),reviewedAt=niche.reviewedAt||TOP25_EVIDENCE_REVIEWED_AT;
  $('#nicheTitle').textContent=`${niche.emoji} ${platform.shortLabel} · ${niche.label}`;
  $('#nicheText').textContent=platform.id==='AMAZON_ARCHIVE'?`${sourceProducts.length} produse din datasetul istoric licențiat. Nu reprezintă vânzări curente și nu intră în Consensus Live 2026.`:platform.status==='LIVE'?`${sourceProducts.length} produse cu observații recente și sursă oficială sau licențiată.`:'Acest clasament se publică numai după acces oficial, verificarea drepturilor și 25/25 poziții recente.';
  $('#coverage').textContent=`${sourceProducts.length}/25${platform.status==='LIVE'?' LIVE':platform.id==='AMAZON_ARCHIVE'?' ARHIVĂ':''}`;$('#resultCount').textContent=`${products.length} rezultate afișate`;
  const tracking=await trackingFor(niche,reviewedAt);if(token!==renderToken||current!==niche)return;
  $('#trackingStatus').textContent=platform.id==='AMAZON_ARCHIVE'?(tracking.previousReviewedAt?`Comparat cu revizia ${fmtDate(tracking.previousReviewedAt)} · istoric central`:'ARHIVĂ · prima revizie centrală'):`${statusLabel(platform.status)} · prospețime maximă ${platform.freshnessDays||'—'} zile`;
  $('#grid').innerHTML=products.map(raw=>card(raw,tracking.movements.get(top25ProductKey(raw)),tracking.previousReviewedAt,tracking.currentProducts?.get(top25ProductKey(raw)),tracking.currentReviewedAt)).join('')||emptyState(platform);
  drawCompareTray();
  if(trackSearch)trackJourneyEvent('TOP25_SEARCHED',{nicheId:niche.id,nicheLabel:niche.label,productCount:sourceProducts.length,evidenceMode:platform.id});
}

async function loadData(){
  const [top25Result,crossResult]=await Promise.allSettled([fetch('/api/free/top25',{headers:{accept:'application/json'},cache:'no-store'}).then(async response=>({response,payload:await response.json()})),fetch('/api/free/cross-market',{headers:{accept:'application/json'},cache:'no-store'}).then(async response=>({response,payload:await response.json()}))]);
  const top25=top25Result.status==='fulfilled'?top25Result.value:null;if(!top25?.response.ok||!top25.payload?.ok||!Array.isArray(top25.payload.niches))return false;
  niches=top25.payload.niches.filter(niche=>Array.isArray(niche?.products)&&niche.products.length===25).slice(0,25).map(niche=>({...niche,id:niche.id||niche.nicheKey,emoji:niche.emoji||'📊',reviewedAt:niche.reviewedAt||top25.payload.updatedAt||TOP25_EVIDENCE_REVIEWED_AT}));current=niches[0]||null;
  const market=crossResult.status==='fulfilled'?crossResult.value:null;
  if(market?.response.ok&&market.payload?.ok&&Array.isArray(market.payload.platforms))crossMarket=market.payload;
  else crossMarket={platforms:FREE_CROSS_MARKET_PLATFORMS.map(platform=>({...platform,status:platform.id==='AMAZON_ARCHIVE'?'AVAILABLE_ARCHIVE':'ACCESS_REQUIRED',publishedPositions:platform.id==='AMAZON_ARCHIVE'?niches.length*25:0})),rankings:[],coverage:{archivePositions:niches.length*25}};
  return niches.length===25;
}

const loaded=await loadData();installFreeDemandTracking(document);
if(loaded){
  installNicheTabs();installMarketTabs();trackFreeDemand('FREE_TOP25_VIEW',{nicheCount:niches.length,productCount:niches.length*25,offer:'CROSS_MARKET_FREE'});
  $('#productSearch').addEventListener('input',render);$('#productSort').addEventListener('change',render);
  $('#shortlistToggle').addEventListener('click',()=>{shortlistOnly=!shortlistOnly;$('#shortlistToggle').classList.toggle('active',shortlistOnly);render();});
  $('#compareOpen').addEventListener('click',openComparison);$('#compareClear').addEventListener('click',()=>{comparison=new Set();render();});$('#compareClose').addEventListener('click',()=>$('#compareDialog').close());
  $('#grid').addEventListener('click',event=>{
    const cardElement=event.target.closest?.('[data-product]'),emptyRequest=event.target.closest?.('[data-empty-request]');
    if(emptyRequest){emptyRequest.disabled=true;emptyRequest.textContent='Interes înregistrat ✓';trackFreeDemand('FREE_DECISION_REACHED',{nicheId:current.id,nicheLabel:current.label,decision:'REQUEST_PLATFORM',target:`PLATFORM:${emptyRequest.dataset.emptyRequest}`});return;}
    if(!cardElement)return;const productName=cardElement.dataset.product||'',key=cardElement.dataset.productKey;
    if(event.target.closest('[data-shortlist]')){const result=toggleFreeShortlist(shortlist,key);shortlist=result.values;trackFreeDemand('FREE_DECISION_REACHED',{productName,nicheId:current.id,nicheLabel:current.label,decision:result.added?'SHORTLIST_ADD':'SHORTLIST_REMOVE',target:`PLATFORM:${selectedPlatform}`});render();return;}
    if(event.target.closest('[data-compare]')){const result=toggleComparison(comparison,key);comparison=result.values;if(result.limitReached){$('#compareHint').textContent='Poți compara maximum 3 produse.';return;}$('#compareHint').textContent=comparison.size<2?'Alege încă un produs pentru comparație.':'Comparația este gata.';render();return;}
    const opened=event.target.closest?.('[data-product-opened]');if(opened){const metadata={productName,nicheId:current.id,nicheLabel:current.label,target:opened.getAttribute('href')||'',label:selectedPlatform};trackJourneyEvent('PRODUCT_OPENED',{product:productName,...metadata});trackFreeDemand(opened.dataset.productAction==='source'?'FREE_SOURCE_OPENED':'FREE_PRODUCT_OPENED',metadata);}
    const decision=event.target.closest?.('[data-product-decision]');if(!decision)return;cardElement.querySelectorAll('[data-product-decision]').forEach(button=>{button.classList.toggle('selected',button===decision);button.setAttribute('aria-pressed',String(button===decision));});
    trackJourneyEvent('DECISION_REACHED',{product:productName,nicheId:current.id,nicheLabel:current.label,decision:decision.dataset.productDecision,source:'TOP25'});trackFreeDemand('FREE_DECISION_REACHED',{productName,nicheId:current.id,nicheLabel:current.label,decision:decision.dataset.productDecision,target:`PLATFORM:${selectedPlatform}`});
  });render({trackSearch:true});
}else{$('#nicheTitle').textContent='Top 25 indisponibil temporar';$('#nicheText').textContent='Datele licențiate nu au putut fi încărcate. Nu afișăm surse de rezervă cu drepturi neconfirmate.';$('#coverage').textContent='0/25';$('#trackingStatus').textContent='FAIL-CLOSED · încearcă din nou mai târziu';}
