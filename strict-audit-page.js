import {buildStrictAudit} from './v2-audit.js';
const $=s=>document.querySelector(s);
const money=v=>`${Number(v||0).toLocaleString('ro-RO',{maximumFractionDigits:2})} lei`;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function badge(decision){const c=decision==='BUY'?'buy':decision==='TEST'?'test':decision==='REJECT'?'reject':'wait';return `<span class="badge ${c}">${decision}</span>`;}
function card(x,rank,extra=''){
  const p=x.testPlan;
  return `<article class="card ${extra}"><div class="row"><div><div class="rank">#${rank} • ${esc(x.category)} • confidence ${esc(x.confidence)}</div><div class="name">${esc(x.name)}</div>${badge(x.decision)}</div><div class="score">${x.score}</div></div><div class="meta">Profit ${money(x.economics.profit)} • marjă ${x.economics.margin.toFixed(1)}% • ROI ${x.economics.roi.toFixed(0)}% • landed ${money(x.economics.landed)} • sell ${money(x.economics.sell)}</div><div class="signals">LIVE ${x.signals.dataLive?'DA':'NU'} • checks ${x.signals.checks} • extern ${x.signals.foreign} • supplier ${x.signals.supplierReady?'OK':'NEVALIDAT'} • review ${x.signals.reviewSources} • RO gap ${x.signals.romaniaGap} • trend ${x.signals.trend}</div>${x.blockers.length?`<div class="blockers">Blocaje: ${x.blockers.join(' • ')}</div>`:''}${p?`<div class="plan">Plan test: ${p.units} buc. • investiție ${money(p.investment)} • venit potențial ${money(p.revenue)} • profit potențial ${money(p.profitPotential)}</div>`:''}</article>`;
}
function renderAudit(a){
  $('#kTotal').textContent=a.summary.total;$('#kBuy').textContent=a.summary.buy;$('#kTest').textContent=a.summary.test;$('#kWait').textContent=a.summary.wait;$('#kReject').textContent=a.summary.reject;$('#kHigh').textContent=a.summary.highConfidence;
  $('#top3').innerHTML=a.top3.length?a.top3.map((x,i)=>card(x,i+1,'top3')).join(''):'<p class="note">Niciun produs nu a trecut încă pragul BUY/TEST strict. Acesta este un rezultat valid: mai trebuie colectate dovezi înainte de bani reali.</p>';
  $('#top10').innerHTML=a.top10.map((x,i)=>card(x,i+1)).join('');
  $('#warnings').innerHTML=a.earlyWarnings.length?a.earlyWarnings.map((x,i)=>card(x,i+1,'warning')).join(''):'<p class="note">Nicio alertă Early Warning validată LIVE în acest moment.</p>';
}
async function load(){
  $('#refresh').disabled=true;$('#refresh').textContent='Audit în curs…';
  try{const r=await fetch(`radar-live.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();renderAudit(buildStrictAudit(data.products||[]));}
  catch(e){$('#top3').innerHTML=`<p class="note">Eroare: ${esc(e.message)}</p>`;}
  finally{$('#refresh').disabled=false;$('#refresh').textContent='Rulează auditul';}
}
$('#refresh').onclick=load;load();