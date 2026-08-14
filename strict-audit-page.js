import {buildStrictAudit} from './v2-audit.js';
import {roProductName,roCategory} from './product-ro.js';
const $=s=>document.querySelector(s);
const money=v=>`${Number(v||0).toLocaleString('ro-RO',{maximumFractionDigits:2})} lei`;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const decisionLabel=d=>({'BUY':'CUMPĂRĂ','TEST':'TESTEAZĂ','WAIT':'AȘTEAPTĂ','REJECT':'RESPINGE'}[d]||d);
const confidenceLabel=c=>({'HIGH':'RIDICATĂ','MEDIUM':'MEDIE','LOW':'SCĂZUTĂ'}[c]||c);
const blockerLabel=b=>({
  'SUPPLIER_UNVERIFIED':'Furnizor neverificat',
  'SUPPLIER_PARTIAL':'Furnizor verificat doar parțial',
  'NO_REVIEW_EVIDENCE':'Lipsesc dovezi din recenzii',
  'EVIDENCE_LOW':'Dovezi insuficiente',
  'LOW_NET_PROFIT':'Profit net prea mic',
  'LOW_NET_MARGIN':'Marjă netă prea mică',
  'LOW_ROI':'ROI prea mic',
  'PRICE_UNVERIFIED':'Preț nevalidat',
  'PRICE_INCOMPLETE':'Preț incomplet',
  'DATA_PARTIAL':'Date parțiale',
  'NOT_LIVE':'Datele nu sunt încă LIVE',
  'ROMANIA_GAP_LOW':'Avantaj slab pe piața din România',
  'IMPORT_RISK':'Risc de import prea mare',
  'REVIEW_EVIDENCE_LOW':'Dovezi slabe din recenzii',
  'TREND_LOW':'Trend insuficient',
  'FOREIGN_EVIDENCE_LOW':'Prezență externă insuficientă'
}[b]||String(b||'').replaceAll('_',' ').toLowerCase());
function localizeStatic(){const map=new Map([['Command Center','Centru de comandă'],['Executive','Executiv'],['V2 Audit','Audit V2'],['Strict Data Gate • TOP 10 • TOP 3 Test • Early Warning • fără BUY pe date PARTIAL','Filtru strict de date • TOP 10 • TOP 3 pentru test • Alertă timpurie • fără CUMPĂRARE pe date PARȚIALE'],['BUY strict','CUMPĂRĂ strict'],['TEST','TESTEAZĂ'],['WAIT','AȘTEAPTĂ'],['REJECT','RESPINGE'],['high confidence','încredere ridicată'],['🥇 TOP 3 pentru bani reali','🥇 TOP 3 pentru bani reali'],['⚡ V2 Early Warning','⚡ Alertă timpurie V2']]);document.querySelectorAll('body *').forEach(el=>{if(el.children.length===0){const t=el.textContent.trim();if(map.has(t))el.textContent=map.get(t);}});}
function installPremiumShell(){if(!document.querySelector('link[href="premium-ui.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='premium-ui.css';document.head.appendChild(l);}if(!document.querySelector('.bottom-nav'))document.body.insertAdjacentHTML('beforeend','<nav class="bottom-nav"><a href="index.html"><b>⌂</b>Acasă</a><a href="todays-opportunities.html"><b>🔥</b>Astăzi</a><a href="discovery-inbox.html"><b>⌕</b>Descoperă</a><a href="supplier-intelligence.html"><b>⌘</b>Furnizori</a><a class="active" href="strict-audit-ro.html"><b>✓</b>Audit</a></nav>');}
function badge(decision){const c=decision==='BUY'?'buy':decision==='TEST'?'test':decision==='REJECT'?'reject':'wait';return `<span class="badge ${c}">${decisionLabel(decision)}</span>`;}
function card(x,rank,extra=''){const p=x.testPlan;const supplier=x.signals.supplierReady?'VALIDAT':x.signals.supplierPartial?'PARȚIAL':'NEVALIDAT';const blockers=(x.blockers||[]).map(blockerLabel);return `<article class="card ${extra}"><div class="row"><div><div class="rank">#${rank} • ${esc(roCategory(x.category))} • încredere ${esc(confidenceLabel(x.confidence))}</div><div class="name" title="${esc(x.name)}">${esc(roProductName(x.name))}</div>${badge(x.decision)}</div><div class="score">${x.score}<small>SCOR</small></div></div><div class="meta"><b>Dovezi ${x.evidenceScore}/100</b> • Profit ${money(x.economics.profit)} • Marjă ${x.economics.margin.toFixed(1)}% • ROI ${x.economics.roi.toFixed(0)}%</div><div class="signals">Cost import ${money(x.economics.landed)} • Preț vânzare ${money(x.economics.sell)} • ${x.signals.checks} verificări • ${x.signals.foreign} piețe externe • furnizor ${supplier} • gol RO ${x.signals.romaniaGap} • trend ${x.signals.trend}</div>${blockers.length?`<div class="blockers"><b>De ce nu avansează:</b><br>${blockers.map(esc).join(' • ')}</div>`:''}${p?`<div class="plan"><b>Plan de test:</b> ${p.units} buc. • investiție ${money(p.investment)} • venit potențial ${money(p.revenue)} • profit potențial ${money(p.profitPotential)}</div>`:''}</article>`;}
function renderAudit(a){$('#kTotal').textContent=a.summary.total;$('#kBuy').textContent=a.summary.buy;$('#kTest').textContent=a.summary.test;$('#kWait').textContent=a.summary.wait;$('#kReject').textContent=a.summary.reject;$('#kHigh').textContent=a.summary.highConfidence;$('#top3').innerHTML=a.top3.length?a.top3.map((x,i)=>card(x,i+1,'top3')).join(''):'<div class="note"><b>Niciun produs pregătit pentru bani reali.</b><br>Motorul strict nu a găsit încă suficiente dovezi pentru TEST sau CUMPĂRARE. Continuăm colectarea datelor fără să relaxăm pragurile.</div>';$('#top10').innerHTML=a.top10.map((x,i)=>card(x,i+1)).join('');$('#warnings').innerHTML=a.earlyWarnings.length?a.earlyWarnings.map((x,i)=>card(x,i+1,'warning')).join(''):'<div class="note">Nu există alerte timpurii validate LIVE în acest moment.</div>';}
async function load(){$('#refresh').disabled=true;$('#refresh').textContent='Audit în curs…';try{const r=await fetch(`radar-live.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();renderAudit(buildStrictAudit(data.products||[]));}catch(e){$('#top3').innerHTML=`<div class="note">Eroare la încărcarea auditului: ${esc(e.message)}</div>`;}finally{$('#refresh').disabled=false;$('#refresh').textContent='Rulează auditul';}}
installPremiumShell();localizeStatic();$('#refresh').onclick=load;load();