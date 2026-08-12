const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let products=[],tab='all';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v)));
const money=v=>`${n(v).toLocaleString('ro-RO',{maximumFractionDigits:2})} lei`;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function economics(p){const sell=n(p.sell),landed=n(p.landed),profit=sell/1.21-sell*.17-sell*.08-landed;return{profit,margin:sell?profit/sell*100:0,roi:landed?profit/landed*100:0};}
function isKids(p){return /kids|copii|3.?6|0.?6/i.test(`${p.cat||''} ${p.age||''}`);}
function hasLiveSignal(p){return String(p.sourceStatus||'').toUpperCase()==='WEB_SIGNAL'&&n(p.marketScout?.checks)>=3&&n(p.marketScout?.foreignPresence)>=1;}
function fallbackAnalysis(p){
  const e=economics(p),foreign=n(p.marketScout?.foreignPresence),ro=n(p.marketScout?.romaniaPresence),china=n(p.marketScout?.chinaSourcingPresence),score=n(p.megaScore||p.score);
  const gap=clamp(55+foreign*12+china*8-ro*25),sat=ro?58:90,margin=clamp(e.margin*1.7+e.roi*.25),demand=clamp(40+foreign*18),trend=55;
  let action=String(p.action||p.verdict||'WATCH').toUpperCase();if(action==='BUY ZONE')action='BUY';if(action==='SAMPLE'||action==='VALIDATE')action='TEST';if(!['BUY','TEST','WATCH','REJECT'].includes(action))action=score>=82?'BUY':score>=76?'TEST':'WATCH';
  return{score,action,lifecycle:p.lifecycle||'WATCH',components:{demand,trend,romaniaGap:gap,saturation:sat,margin,supplier:china?72:45,logistics:n(p.logistics)||78,compliance:n(p.compliance)||78},trendVelocity:{percent:null,label:'BASELINE'},economics:{...e,landed:n(p.landed),sell:n(p.sell)},testPlan:null};
}
function analysis(p){return p.megaAnalysis||fallbackAnalysis(p);}
function actionOf(p){if(isKids(p)&&String(p.kidsGate||'').toUpperCase()!=='PASS'&&analysis(p).action==='BUY')return'TEST';return analysis(p).action||'WATCH';}
function link(site,name){const q=encodeURIComponent(name);return site==='Alibaba'?`https://www.alibaba.com/trade/search?SearchText=${q}`:site==='1688'?`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`:site==='eMAG'?`https://www.emag.ro/search/${q}`:site==='Trendyol'?`https://www.trendyol.com/sr?q=${q}`:`https://www.amazon.de/s?k=${q}`;}
function tone(action){return action==='BUY'?'buy':action==='TEST'?'test':action==='REJECT'?'reject':'watch';}
function component(label,value){const v=Math.round(clamp(value));return `<div class="component"><div><span>${esc(label)}</span><b>${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`;}
function signals(p){const s=p.marketScout?.signals;if(!s)return'';const keys=[['amazonDE','Amazon DE',''],['allegroPL','Allegro PL',''],['trendyolTR','Trendyol',''],['emagRO','eMAG RO','ro'],['alibabaCN','Alibaba','']];return `<div class="signals">${keys.map(([k,l,c])=>`<span class="signal ${s[k]?.present?(c||'on'):''}">${esc(l)} ${s[k]?.present?'✓':'–'}</span>`).join('')}</div>`;}
function why(p,a){const e=a.economics||economics(p),items=[];if(a.components?.romaniaGap>=70)items.push(`Romania Gap ${Math.round(a.components.romaniaGap)}/100`);if(a.components?.saturation>=70)items.push('competiție RO estimată redusă');if(a.components?.margin>=70)items.push(`economie bună: ${money(e.profit)} profit/buc.`);if(a.components?.trend>=65)items.push(`trend ${a.trendVelocity?.label||'în creștere'}`);if(n(p.marketScout?.foreignPresence)>=2)items.push(`semnal în ${n(p.marketScout.foreignPresence)} piețe externe`);return items.slice(0,3).join(' • ')||'Necesită validare suplimentară înainte de comandă.';}
function card(p){
  const a=analysis(p),e=a.economics||economics(p),action=actionOf(p),checked=p.marketScout?.checkedAt||p.lastChecked,trend=a.trendVelocity||{},plan=a.testPlan;
  return `<article class="card ${tone(action)}card"><div class="top"><div><div class="name">${esc(p.name)}</div><div class="cat">${esc(p.cat||'Fără categorie')} • ${esc(a.lifecycle||'WATCH')}</div><span class="badge ${tone(action)}">${esc(action)}</span></div><div class="score"><small>MEGA</small>${Math.round(n(a.score||p.score))}<span>/100</span></div></div>
  <div class="hero-metrics"><div><small>Romania Gap</small><b>${Math.round(n(a.components?.romaniaGap))}/100</b></div><div><small>Trend</small><b>${esc(trend.label||'BASELINE')}</b><em>${trend.percent==null?'—':`${trend.percent>0?'+':''}${trend.percent}%`}</em></div><div><small>Profit / buc.</small><b>${money(e.profit)}</b><em>ROI ${n(e.roi).toFixed(0)}%</em></div><div><small>Saturație</small><b>${Math.round(n(a.components?.saturation))}/100</b></div></div>
  <details><summary>De ce acest produs?</summary><p class="why">${esc(why(p,a))}</p><div class="components">${component('Demand',a.components?.demand)}${component('Trend',a.components?.trend)}${component('Romania Gap',a.components?.romaniaGap)}${component('Saturation',a.components?.saturation)}${component('Margin',a.components?.margin)}${component('Supplier',a.components?.supplier)}${component('Logistics',a.components?.logistics)}${component('Compliance',a.components?.compliance)}</div></details>
  <div class="metrics"><div class="metric"><small>Cost China</small><b>${money(p.chinaMin)} – ${money(p.chinaMax)}</b></div><div class="metric"><small>Landed</small><b>${money(e.landed||p.landed)}</b></div><div class="metric"><small>Preț RO</small><b>${money(e.sell||p.sell)}</b></div><div class="metric"><small>Marjă</small><b>${n(e.margin).toFixed(1)}%</b></div></div>
  ${plan?`<div class="testplan"><b>Test recomandat: ${n(plan.units)} buc.</b><span>Investiție ${money(plan.investment)} • Profit potențial ${money(plan.profitPotential)}</span></div>`:''}${signals(p)}${checked?`<div class="validated">Ultima verificare: ${esc(new Date(checked).toLocaleString('ro-RO'))} • ${hasLiveSignal(p)?'semnal web live':'validare parțială'}</div>`:''}
  <div class="actions"><a target="_blank" rel="noopener" href="${link('Alibaba',p.name)}">Alibaba ↗</a><a target="_blank" rel="noopener" href="${link('1688',p.name)}">1688 ↗</a><a target="_blank" rel="noopener" href="${link('eMAG',p.name)}">eMAG ↗</a><a target="_blank" rel="noopener" href="${link('Trendyol',p.name)}">Trendyol ↗</a><a target="_blank" rel="noopener" href="${link('Amazon',p.name)}">Amazon DE ↗</a></div></article>`;
}
function normalize(a){return Array.isArray(a)?a.filter(x=>x&&x.name).map(x=>({...x,score:n(x.score),megaScore:n(x.megaScore||x.score),sell:n(x.sell),landed:n(x.landed),chinaMin:n(x.chinaMin),chinaMax:n(x.chinaMax)})):[];}
function renderTop(){const top=[...products].sort((a,b)=>n(analysis(b).score)-n(analysis(a).score)).slice(0,3);$('#top3').innerHTML=top.map((p,i)=>`<div class="topitem"><span>#${i+1}</span><div><b>${esc(p.name)}</b><small>${esc(actionOf(p))} • Gap ${Math.round(n(analysis(p).components?.romaniaGap))}</small></div><strong>${Math.round(n(analysis(p).score))}</strong></div>`).join('');}
function render(){
  const q=$('#search').value.trim().toLowerCase(),cat=$('#category').value,sort=$('#sort').value;let a=products.filter(p=>(!cat||p.cat===cat)&&(!q||`${p.name} ${p.cat}`.toLowerCase().includes(q)));
  if(tab!=='all')a=a.filter(p=>actionOf(p).toLowerCase()===tab);a.sort((x,y)=>sort==='gap'?n(analysis(y).components?.romaniaGap)-n(analysis(x).components?.romaniaGap):sort==='profit'?n(analysis(y).economics?.profit)-n(analysis(x).economics?.profit):n(analysis(y).score)-n(analysis(x).score));
  $('#grid').innerHTML=a.length?a.map(card).join(''):'<div class="empty">Nu există produse pentru filtrele selectate.</div>';
  $('#total').textContent=products.length;$('#buy').textContent=products.filter(p=>actionOf(p)==='BUY').length;$('#test').textContent=products.filter(p=>actionOf(p)==='TEST').length;$('#avg').textContent=products.length?Math.round(products.reduce((s,p)=>s+n(analysis(p).score),0)/products.length):'—';renderTop();
}
async function load(){
  const btn=$('#refresh');btn.disabled=true;$('#status').textContent='Se actualizează…';
  try{let live=null;try{const r=await fetch(`radar-live.json?t=${Date.now()}`,{cache:'no-store'});if(r.ok)live=await r.json();}catch{}
    if(live?.live&&normalize(live.products).length){products=normalize(live.products);$('#source').textContent=`${live.engine||'Radar LIVE'} • ${n(live.successfulChecks)} checks`;$('#updated').textContent=live.updatedAt?new Date(live.updatedAt).toLocaleString('ro-RO'):'—';$('#status').innerHTML='<span class="good">Online</span>';}else{const r=await fetch(`products.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);products=normalize(await r.json());$('#source').textContent='Bază fallback';$('#updated').textContent='date de bază';$('#status').innerHTML='<span class="good">Online</span>';}
    const cats=[...new Set(products.map(p=>p.cat).filter(Boolean))].sort();$('#category').innerHTML='<option value="">Toate categoriile</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join('');render();
  }catch(e){$('#status').innerHTML=`<span class="error">Eroare: ${esc(e.message)}</span>`;$('#grid').innerHTML='<div class="empty">Datele nu s-au putut încărca. Apasă Refresh.</div>';}finally{btn.disabled=false;}
}
$('#search').addEventListener('input',render);$('#category').addEventListener('change',render);$('#sort').addEventListener('change',render);$('#refresh').addEventListener('click',load);$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');tab=b.dataset.tab;render();}));
load();
