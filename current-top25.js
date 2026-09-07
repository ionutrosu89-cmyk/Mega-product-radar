const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl=value=>{try{const url=new URL(String(value||''),location.href);return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return'#';}};
const normalize=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const fmtDate=value=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);};
let windowDays=7,data=null;

function productCard(product){
  const url=safeUrl(product.sourceUrl),eligible=product.commercialEligible===true;
  const basis=product.rankingBasis==='WINDOW_PERSISTENCE_FROM_DIRECT_PLATFORM_RANK'?'Persistență rang platformă':product.rankingBasis||'Dovadă actuală';
  const metric=product.windowMetrics?`rang mediu ${Number(product.windowMetrics.averageRank||0).toFixed(1)} · ${product.windowMetrics.persistenceDays||0}/${product.windowMetrics.observedDays||0} zile observate`:'';
  return `<article class="product"><div class="rank">#${Number(product.rank)||'—'}</div><h3>${esc(product.name)}</h3><div class="meta"><span class="chip">${esc(product.platform||'SURSA')}</span><span class="chip">${esc(product.evidenceClass||'UNKNOWN')}</span><span class="chip ${eligible?'ok':'hold'}">${eligible?'ELIGIBIL':'HOLD COMERCIAL'}</span></div><div class="evidence"><b>${esc(basis)}</b><br>${esc(metric)}${metric?'<br>':''}Observat: ${esc(fmtDate(product.observedAt))}<br>${esc(product.salesEvidenceClass||'')}</div>${url!=='#'?`<a class="source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Vezi sursa</a>`:''}</article>`;
}

function render(){
  if(!data)return;
  const query=normalize($('#search').value),filter=$('#coverageFilter').value;
  const rows=(data.niches||[]).filter(niche=>{
    if(filter==='WITH_DATA'&&Number(niche.productCount||0)===0)return false;
    if(filter==='COMPLETE'&&Number(niche.productCount||0)!==25)return false;
    if(!query)return true;
    return normalize(`${niche.label} ${niche.id} ${(niche.products||[]).map(p=>p.name).join(' ')}`).includes(query);
  });
  $('#niches').innerHTML=rows.map(niche=>{
    const products=Array.isArray(niche.products)?niche.products:[];
    const source=products[0]?.sourceLabel||niche.sourceLabel||'Dovezi actuale aprobate';
    const body=products.length?`<div class="products">${products.map(productCard).join('')}</div>`:`<div class="empty"><b>0/25 · INSUFFICIENT DATA</b><br>Nu există încă suficiente poziții actuale aprobate pentru această nișă. Nu folosim arhiva 2023 ca înlocuitor.</div>`;
    return `<section class="niche"><div class="niche-head"><div><h2>${esc(niche.emoji||'📊')} ${esc(niche.label||niche.id)}</h2><p>${esc(source)} · ${windowDays} zile · actualizat ${esc(fmtDate(niche.windowEnd||data.updatedAt))}</p></div><div class="coverage"><b>${Number(niche.productCount||0)}/25</b><small>${Number(niche.commercialEligibleCount||0)}/25 comercial</small></div></div>${body}</section>`;
  }).join('')||'<div class="notice">Nicio nișă nu corespunde filtrului selectat.</div>';
}

async function load(nextWindow){
  windowDays=nextWindow;$('#window7').classList.toggle('active',windowDays===7);$('#window30').classList.toggle('active',windowDays===30);$('#windowLabel').textContent=`${windowDays}D`;$('#notice').className='notice';$('#notice').textContent='Se încarcă dovezile actuale…';
  try{
    const response=await fetch(`/api/free/top25?window=${windowDays}`,{headers:{accept:'application/json'},cache:'no-store'});
    const payload=await response.json();
    if(!response.ok||!payload?.ok||!Array.isArray(payload.niches))throw new Error(payload?.code||payload?.error||`HTTP ${response.status}`);
    data=payload;
    $('#completeNiches').textContent=`${Number(payload.stats?.completeNicheCount||0)}/25`;
    $('#publishedPositions').textContent=`${Number(payload.stats?.publishedProductCount||0)}/625`;
    $('#commercialPositions').textContent=`${Number(payload.stats?.commercialEligibleProductCount||0)}/625`;
    const complete=payload.coverage?.complete===true;
    $('#notice').className=`notice${complete?'':' warn'}`;
    $('#notice').innerHTML=complete?`<strong>Coverage complet ${windowDays}D.</strong> Toate cele 25 de nișe au câte 25 de poziții actuale aprobate.`:`<strong>Coverage actual incomplet.</strong> Sunt publicate ${Number(payload.stats?.publishedProductCount||0)} din 625 poziții necesare. Nișele lipsă rămân INSUFFICIENT DATA; nu sunt completate cu produse istorice.`;
    render();
  }catch(error){data=null;$('#completeNiches').textContent='0/25';$('#publishedPositions').textContent='0/625';$('#commercialPositions').textContent='0/625';$('#notice').className='notice warn';$('#notice').textContent=`Topul actual nu poate fi încărcat în siguranță (${String(error?.message||error)}). Nu afișăm fallback istoric.`;$('#niches').innerHTML='';}
}

$('#window7').addEventListener('click',()=>load(7));$('#window30').addEventListener('click',()=>load(30));$('#search').addEventListener('input',render);$('#coverageFilter').addEventListener('change',render);
load(7);
