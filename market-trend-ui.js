import {roProductName} from './product-ro.js';

const norm=v=>String(v||'').trim().toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const statusLabel={ACCELERATING:'Accelerează',RISING:'În creștere',STABIL:'Stabil',COOLING:'Încetinește',DECLINING:'În scădere',INSUFICIENT:'Istoric insuficient'};
const trendClass=s=>['ACCELERATING','RISING'].includes(s)?'good':['COOLING','DECLINING'].includes(s)?'bad':'warn';
const rankClass=t=>t==='TOP OPORTUNITATE'?'good':t==='URMĂREȘTE PRIORITAR'?'good':t==='DE VALIDAT'?'warn':t==='PRIORITATE MICĂ'?'bad':'warn';
let byRoName=new Map();
let applying=false;

function selectedTrend(){return document.querySelector('#trendStatus')?.value||'';}
function selectedSignal(){return document.querySelector('#trendSignal')?.value||'';}
function selectedRank(){return document.querySelector('#opportunityTier')?.value||'';}

function injectNav(){
  const nav=document.querySelector('.nav');
  if(!nav||nav.querySelector('a[href="watchlist.html"]'))return;
  const link=document.createElement('a');link.className='chip';link.href='watchlist.html';link.textContent='Top Opportunities';
  const purchase=nav.querySelector('a[href="purchase-manager-ro.html"]');
  if(purchase)nav.insertBefore(link,purchase);else nav.appendChild(link);
}

function injectFilters(){
  const filters=document.querySelector('.filters');
  if(!filters||document.querySelector('#trendStatus'))return;
  const status=document.createElement('select');
  status.id='trendStatus';
  status.innerHTML='<option value="">Orice trend</option><option value="ACCELERATING">Accelerează</option><option value="RISING">În creștere</option><option value="STABIL">Stabil</option><option value="COOLING">Încetinește</option><option value="DECLINING">În scădere</option><option value="INSUFICIENT">Istoric insuficient</option>';
  const signal=document.createElement('select');
  signal.id='trendSignal';
  signal.innerHTML='<option value="">Orice semnal trend</option><option value="cerere în accelerare">Cerere în accelerare</option><option value="gap în creștere">Gap în creștere</option><option value="presiune RO în scădere">Competiție RO în scădere</option><option value="presiune RO în creștere">Competiție RO în creștere</option><option value="sourcing se îmbunătățește">Sourcing se îmbunătățește</option><option value="acoperire dovezi în creștere">Dovezi în creștere</option>';
  const rank=document.createElement('select');
  rank.id='opportunityTier';
  rank.innerHTML='<option value="">Orice prioritate</option><option value="TOP OPORTUNITATE">Top oportunitate</option><option value="URMĂREȘTE PRIORITAR">Urmărește prioritar</option><option value="DE VALIDAT">De validat</option><option value="DE CERCETAT">De cercetat</option><option value="PRIORITATE MICĂ">Prioritate mică</option>';
  filters.append(status,signal,rank);
  [status,signal,rank].forEach(el=>el.addEventListener('change',decorateAndFilter));
}

function productForCard(card){return byRoName.get(norm(card.querySelector('.name')?.textContent||''));}

function decorateCard(card,p){
  if(!p||card.dataset.trendDecorated==='1')return;
  const t=p.trendIntelligence||{},r=p.opportunityRanking||{};
  const badges=card.querySelector('.badges');
  if(badges){
    const rb=document.createElement('span');rb.className=`badge ${rankClass(r.tier)}`;rb.textContent=`#${r.rank||'—'} · ${r.tier||'De cercetat'}`;badges.prepend(rb);
    const tb=document.createElement('span');tb.className=`badge ${trendClass(t.status)}`;tb.textContent=`Trend: ${statusLabel[t.status]||t.status||'—'}`;badges.appendChild(tb);
  }
  const scores=card.querySelector('.scores');
  if(scores){
    const rbox=document.createElement('div');rbox.className='score';rbox.innerHTML=`<span>Oportunitate</span><b class="${rankClass(r.tier)}">${Number(r.score||0)}</b>`;scores.prepend(rbox);
    const tbox=document.createElement('div');tbox.className='score';const score=Number(t.score||0);tbox.innerHTML=`<span>Trend</span><b class="${trendClass(t.status)}">${score>0?'+':''}${score}</b>`;scores.appendChild(tbox);
  }
  const hints=[...(Array.isArray(r.reasons)?r.reasons.slice(0,2):[]),...(Array.isArray(t.signals)?t.signals.slice(0,1):[])];
  if(hints.length){const hint=document.createElement('div');hint.className='trendHint';hint.style.cssText='margin-top:9px;font-size:12px;color:#9db0c9';hint.textContent=hints.join(' • ');card.appendChild(hint);}
  card.dataset.trendDecorated='1';
}

function decorateAndFilter(){
  if(applying)return; applying=true;
  try{
    const trend=selectedTrend(),signal=selectedSignal(),rank=selectedRank();let visible=0;
    document.querySelectorAll('#grid .card').forEach(card=>{
      const p=productForCard(card);decorateCard(card,p);const t=p?.trendIntelligence||{},r=p?.opportunityRanking||{};
      const show=(!trend||t.status===trend)&&(!signal||(Array.isArray(t.signals)&&t.signals.includes(signal)))&&(!rank||r.tier===rank);
      card.style.display=show?'':'none';if(show)visible++;
    });
    const count=document.querySelector('#count');if(count&&(trend||signal||rank))count.textContent=`${visible} rezultate după filtrele de prioritate`;
  }finally{applying=false;}
}

function injectXray(){
  const drawer=document.querySelector('#drawer');if(!drawer||drawer.querySelector('[data-trend-xray]'))return;
  const p=byRoName.get(norm(drawer.querySelector('h2')?.textContent||''));if(!p)return;
  const t=p.trendIntelligence||{},r=p.opportunityRanking||{},slopes=t.slopes||{};
  const section=document.createElement('div');section.className='section';section.dataset.trendXray='1';
  const reasons=(r.reasons||[]).map(x=>`<span class="badge good">${esc(x)}</span>`).join(' ')||'<span class="note">Nu există încă motive suficient de puternice pentru prioritizare.</span>';
  const blockers=(r.blockers||[]).map(x=>`<span class="badge warn">${esc(x)}</span>`).join(' ')||'<span class="badge good">Fără blocaje majore detectate</span>';
  const sig=Array.isArray(t.signals)&&t.signals.length?t.signals.map(x=>`<span class="badge">${esc(x)}</span>`).join(' '):'<span class="note">Nu există încă un semnal direcțional suficient de puternic.</span>';
  section.innerHTML=`<h3>Opportunity Ranking V2</h3><div class="matrix"><div class="metric"><small>Loc</small><b>#${Number(r.rank||0)||'—'}</b></div><div class="metric"><small>Opportunity Score</small><b class="${rankClass(r.tier)}">${Number(r.score||0)}</b></div><div class="metric"><small>Prioritate</small><b class="${rankClass(r.tier)}">${esc(r.tier||'DE CERCETAT')}</b></div></div><div class="badges" style="margin-top:10px">${reasons}</div><div class="badges" style="margin-top:8px">${blockers}</div><div class="note">Acest ranking decide doar ordinea în care merită analizate produsele. Nu modifică verdictul TEST/CUMPĂRĂ.</div><h3 style="margin-top:16px">Trend Intelligence</h3><div class="matrix"><div class="metric"><small>Direcție</small><b class="${trendClass(t.status)}">${esc(statusLabel[t.status]||t.status||'—')}</b></div><div class="metric"><small>Trend score</small><b>${Number(t.score||0)>0?'+':''}${Number(t.score||0)}</b></div><div class="metric"><small>Încredere</small><b>${esc(t.confidence||'SCĂZUTĂ')}</b></div><div class="metric"><small>Δ Launch</small><b>${Number(t.deltaLaunch||0)>0?'+':''}${Number(t.deltaLaunch||0)}</b></div><div class="metric"><small>Δ Cerere</small><b>${Number(t.deltaDemand||0)>0?'+':''}${Number(t.deltaDemand||0)}</b></div><div class="metric"><small>Observații</small><b>${Number(t.sampleCount||0)}</b></div></div><div class="badges" style="margin-top:10px">${sig}</div><div class="note">Pante: Launch ${Number(slopes.launch||0)}, cerere ${Number(slopes.demand||0)}, gap ${Number(slopes.marketGap||0)}, competiție ${Number(slopes.competition||0)}, sourcing ${Number(slopes.sourcing||0)}.</div>`;
  drawer.appendChild(section);
}

async function init(){
  try{
    injectNav();
    const res=await fetch('./market-intelligence-live.json',{cache:'no-store'});const data=await res.json();
    byRoName=new Map((data.products||[]).map(p=>[norm(roProductName(p.name)),p]));injectFilters();decorateAndFilter();
    const grid=document.querySelector('#grid');if(grid)new MutationObserver(()=>decorateAndFilter()).observe(grid,{childList:true,subtree:false});
    const drawer=document.querySelector('#drawer');if(drawer)new MutationObserver(()=>injectXray()).observe(drawer,{childList:true,subtree:true});
  }catch(err){console.warn('Trend/Ranking UI indisponibil:',err?.message||err);}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
