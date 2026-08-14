import {roProductName} from './product-ro.js';

const norm=v=>String(v||'').trim().toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const statusLabel={ACCELERATING:'Accelerează',RISING:'În creștere',STABIL:'Stabil',COOLING:'Încetinește',DECLINING:'În scădere',INSUFICIENT:'Istoric insuficient'};
const trendClass=s=>['ACCELERATING','RISING'].includes(s)?'good':['COOLING','DECLINING'].includes(s)?'bad':'warn';
let byRoName=new Map();
let applying=false;

function selectedTrend(){return document.querySelector('#trendStatus')?.value||'';}
function selectedSignal(){return document.querySelector('#trendSignal')?.value||'';}

function injectFilters(){
  const filters=document.querySelector('.filters');
  if(!filters||document.querySelector('#trendStatus'))return;
  const status=document.createElement('select');
  status.id='trendStatus';
  status.innerHTML='<option value="">Orice trend</option><option value="ACCELERATING">Accelerează</option><option value="RISING">În creștere</option><option value="STABIL">Stabil</option><option value="COOLING">Încetinește</option><option value="DECLINING">În scădere</option><option value="INSUFICIENT">Istoric insuficient</option>';
  const signal=document.createElement('select');
  signal.id='trendSignal';
  signal.innerHTML='<option value="">Orice semnal trend</option><option value="cerere în accelerare">Cerere în accelerare</option><option value="gap în creștere">Gap în creștere</option><option value="presiune RO în scădere">Competiție RO în scădere</option><option value="presiune RO în creștere">Competiție RO în creștere</option><option value="sourcing se îmbunătățește">Sourcing se îmbunătățește</option><option value="acoperire dovezi în creștere">Dovezi în creștere</option>';
  filters.append(status,signal);
  status.addEventListener('change',decorateAndFilter);
  signal.addEventListener('change',decorateAndFilter);
}

function productForCard(card){
  const name=card.querySelector('.name')?.textContent||'';
  return byRoName.get(norm(name));
}

function decorateCard(card,p){
  if(!p||card.dataset.trendDecorated==='1')return;
  const t=p.trendIntelligence||{};
  const badges=card.querySelector('.badges');
  if(badges){
    const b=document.createElement('span');
    b.className=`badge ${trendClass(t.status)}`;
    b.textContent=`Trend: ${statusLabel[t.status]||t.status||'—'}`;
    badges.appendChild(b);
  }
  const scores=card.querySelector('.scores');
  if(scores){
    const box=document.createElement('div');
    box.className='score';
    const score=Number(t.score||0);
    box.innerHTML=`<span>Trend</span><b class="${trendClass(t.status)}">${score>0?'+':''}${score}</b>`;
    scores.appendChild(box);
  }
  if(Array.isArray(t.signals)&&t.signals.length){
    const eco=card.querySelector('.economics');
    const hint=document.createElement('div');
    hint.className='trendHint';
    hint.style.cssText='margin-top:9px;font-size:12px;color:#9db0c9';
    hint.textContent=t.signals.slice(0,2).join(' • ');
    (eco?.parentElement||card).appendChild(hint);
  }
  card.dataset.trendDecorated='1';
}

function decorateAndFilter(){
  if(applying)return; applying=true;
  try{
    const trend=selectedTrend(),signal=selectedSignal();
    let visible=0;
    document.querySelectorAll('#grid .card').forEach(card=>{
      const p=productForCard(card); decorateCard(card,p);
      const t=p?.trendIntelligence||{};
      const okTrend=!trend||t.status===trend;
      const okSignal=!signal||(Array.isArray(t.signals)&&t.signals.includes(signal));
      const show=okTrend&&okSignal;
      card.style.display=show?'':'none';
      if(show)visible++;
    });
    const count=document.querySelector('#count');
    if(count&&(trend||signal))count.textContent=`${visible} rezultate după filtrul de trend`;
  }finally{applying=false;}
}

function injectXray(){
  const drawer=document.querySelector('#drawer');
  if(!drawer||drawer.querySelector('[data-trend-xray]'))return;
  const title=drawer.querySelector('h2')?.textContent||'';
  const p=byRoName.get(norm(title)); if(!p)return;
  const t=p.trendIntelligence||{};
  const section=document.createElement('div');
  section.className='section'; section.dataset.trendXray='1';
  const sig=Array.isArray(t.signals)&&t.signals.length?t.signals.map(x=>`<span class="badge">${esc(x)}</span>`).join(' '):'<span class="note">Nu există încă un semnal direcțional suficient de puternic.</span>';
  const slopes=t.slopes||{};
  section.innerHTML=`<h3>Trend Intelligence</h3><div class="matrix"><div class="metric"><small>Direcție</small><b class="${trendClass(t.status)}">${esc(statusLabel[t.status]||t.status||'—')}</b></div><div class="metric"><small>Trend score</small><b>${Number(t.score||0)>0?'+':''}${Number(t.score||0)}</b></div><div class="metric"><small>Încredere</small><b>${esc(t.confidence||'SCĂZUTĂ')}</b></div><div class="metric"><small>Δ Launch</small><b>${Number(t.deltaLaunch||0)>0?'+':''}${Number(t.deltaLaunch||0)}</b></div><div class="metric"><small>Δ Cerere</small><b>${Number(t.deltaDemand||0)>0?'+':''}${Number(t.deltaDemand||0)}</b></div><div class="metric"><small>Observații</small><b>${Number(t.sampleCount||0)}</b></div></div><div class="badges" style="margin-top:10px">${sig}</div><div class="note">Pante: Launch ${Number(slopes.launch||0)}, cerere ${Number(slopes.demand||0)}, gap ${Number(slopes.marketGap||0)}, competiție ${Number(slopes.competition||0)}, sourcing ${Number(slopes.sourcing||0)}. Trendul folosește doar istoricul intern și nu modifică verdictul TEST/CUMPĂRĂ.</div>`;
  drawer.appendChild(section);
}

async function init(){
  try{
    const res=await fetch('./market-intelligence-live.json',{cache:'no-store'});
    const data=await res.json();
    byRoName=new Map((data.products||[]).map(p=>[norm(roProductName(p.name)),p]));
    injectFilters();
    decorateAndFilter();
    const grid=document.querySelector('#grid');
    if(grid)new MutationObserver(()=>decorateAndFilter()).observe(grid,{childList:true,subtree:false});
    const drawer=document.querySelector('#drawer');
    if(drawer)new MutationObserver(()=>injectXray()).observe(drawer,{childList:true,subtree:true});
  }catch(err){console.warn('Trend UI indisponibil:',err?.message||err);}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
