import {getCurrentSession} from './supabase-client.js';
import {getActiveWorkspace} from './workspace-client.js';
import {roCategory,roProductName} from './product-ro.js';
import {trackJourneyEvent} from './journey-events.js';
import {normalizeOpportunityUxV1,nextValidationStepV1,opportunityActionStorageKeyV1,isCanonicalFinalistV1,OPPORTUNITY_COMPONENT_ORDER} from './opportunity-ux-v1.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const score=v=>finite(v)===null?'—':Math.round(Number(v));
const pct=v=>finite(v)===null?'UNKNOWN':`${Math.round(Number(v))}%`;
const statusClass=v=>String(v||'UNKNOWN').toLowerCase().replace(/[^a-z]/g,'');
const row=(label,value)=>`<div class="row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

function savedAction(product,view){const key=opportunityActionStorageKeyV1(product,view);return key?localStorage.getItem(key):null;}
function setAction(product,view,action){const key=opportunityActionStorageKeyV1(product,view);if(key)localStorage.setItem(key,action);}
function componentCard(component){return `<div class="component"><div class="component-head"><h3>${esc(component.label)}</h3><span class="badge ${statusClass(component.status)}">${esc(component.status)}</span></div><div class="numbers"><span>Score: <b>${score(component.score)}</b></span><span>Confidence: <b>${pct(component.confidence)}</b></span><span>Evidence: <b>${esc(component.evidenceClass)}</b></span></div></div>`;}
function render(product){
  const view=normalizeOpportunityUxV1(product),next=nextValidationStepV1(view),name=roProductName(product.name),cat=roCategory(product.cat||'')||product.cat||'Categorie',action=savedAction(product,view);
  const unknown=view.missingComponents.length?view.missingComponents.join(', '):'Niciuna raportată de Opportunity V5';
  const blockers=view.blockers.length?view.blockers:'Niciun blocker canonic raportat';
  const merit=isCanonicalFinalistV1(view)?'DA — FINALIST pentru etapa pre-test.':'NU ÎNCĂ — necesită validare.';
  $('#app').innerHTML=`<section class="card hero"><div><h1>${esc(name)}</h1><div class="muted">${esc(cat)} · canonicalProductId: ${esc(view.canonicalProductId||'LIPSĂ')}</div><span class="badge ${statusClass(view.recommendation)}">${esc(view.recommendation)}</span></div><div class="score">${score(view.opportunityScore)}<small>OPPORTUNITY SCORE</small></div></section>
<section class="card"><div class="metrics"><div class="metric"><small>Merită?</small><b>${esc(merit)}</b></div><div class="metric"><small>Confidence</small><b>${pct(view.confidence)}</b></div><div class="metric"><small>Blockers</small><b>${view.blockers.length}</b></div></div></section>
<section class="card"><h2 class="section-title">De ce?</h2><div class="components">${OPPORTUNITY_COMPONENT_ORDER.map(name=>componentCard(view.components[name])).join('')}</div></section>
<section class="card"><h2 class="section-title">Ce dovezi avem?</h2>${OPPORTUNITY_COMPONENT_ORDER.map(name=>{const c=view.components[name];return row(c.label,`${c.status} · evidence ${c.evidenceClass} · confidence ${pct(c.confidence)}`);}).join('')}</section>
<section class="card"><h2 class="section-title">Ce nu știm încă?</h2>${row('Componente lipsă',unknown)}${row('Identitate canonică',view.canonicalProductId?'LEGATĂ':'NECONFIRMATĂ')}${row('Cross-product evidence',view.identityMismatches.length?view.identityMismatches.join(', '):'Nicio nepotrivire raportată')}</section>
<section class="card"><h2 class="section-title">Riscuri / blockers</h2>${Array.isArray(blockers)?blockers.map(x=>row('Blocker',x)).join(''):row('Stare',blockers)}</section>
<section class="card"><h2 class="section-title">Economics</h2>${row('Gate',view.components.economics.status)}${row('Score',score(view.components.economics.score))}${row('Confidence',pct(view.components.economics.confidence))}${row('Evidence class',view.components.economics.evidenceClass)}<div class="integrity" style="margin-top:12px">Economics este afișat ca stare canonică a componentei. Datele lipsă nu sunt transformate în cost zero, iar acest ecran nu autorizează achiziția.</div></section>
<section class="card"><h2 class="section-title">Ce trebuie validat?</h2><div class="next"><b>${esc(next.label)}</b><br>${esc(next.reason)}</div><div class="actions">${['IGNORE','WATCH','VALIDATE'].map(x=>`<button type="button" data-action="${x}" class="${action===x?'selected':''}">${x}</button>`).join('')}<a class="primary" href="commercial-radar.html">Înapoi la Opportunities</a></div></section>
<section class="card"><h2 class="section-title">Beta pulse</h2><div class="muted">Această oportunitate ți se pare utilă pentru o decizie reală? Răspunsul măsoară utilitatea beta și nu schimbă scorul sau gate-urile.</div><div class="actions"><button type="button" data-beta-rating="USEFUL">UTILĂ</button><button type="button" data-beta-rating="FALSE_POSITIVE">FALS POZITIV</button><button type="button" data-beta-rating="UNCLEAR">NECLARĂ</button></div></section>
<section class="card"><div class="integrity"><b>Decision safety:</b> Opportunity Detail se oprește la FINALIST. TEST_READY și BUY_READY necesită test real și Decision Authority. Legacy BUY nu este autoritate. purchaseAuthorized=false și automaticPurchaseAllowed=false.</div></section>`;
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',event=>{const value=event.currentTarget.dataset.action;setAction(product,view,value);trackJourneyEvent('OPPORTUNITY_WORK_ACTION',{product:product.name,canonicalProductId:view.canonicalProductId||null,action:value,source:'DETAIL'});render(product);}));
  document.querySelectorAll('[data-beta-rating]').forEach(button=>button.addEventListener('click',async event=>{const verdict=event.currentTarget.dataset.betaRating;await trackJourneyEvent('BETA_OPPORTUNITY_RATED',{canonicalProductId:view.canonicalProductId||null,useful:verdict==='USEFUL'?true:verdict==='FALSE_POSITIVE'?false:null,falsePositive:verdict==='FALSE_POSITIVE',verdict,source:'OPPORTUNITY_DETAIL'});document.querySelectorAll('[data-beta-rating]').forEach(x=>x.classList.toggle('selected',x===event.currentTarget));}));
}

async function load(){
  try{
    const session=await getCurrentSession();if(!session){location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return;}
    const workspace=await getActiveWorkspace();if(!workspace?.id)throw new Error('Workspace indisponibil.');
    const response=await fetch('/api/commercial/radar',{headers:{authorization:`Bearer ${session.access_token}`,'x-mpr-workspace-id':workspace.id},cache:'no-store'});const data=await response.json();
    if(response.status===403){location.href='pricing.html?upgrade=RADAR';return;}if(!response.ok)throw new Error(data.error||'Opportunities indisponibile');
    const list=Array.isArray(data.products)?data.products:[];const params=new URLSearchParams(location.search),wanted=params.get('product')||'',canonical=params.get('canonical')||'';
    const product=(canonical&&list.find(p=>normalizeOpportunityUxV1(p).canonicalProductId===canonical))||list.find(p=>String(p.name||'')===wanted)||list.find(p=>String(p.name||'').toLowerCase()===wanted.toLowerCase())||null;
    if(!product)throw new Error('Produsul nu a fost găsit în setul curent de oportunități.');
    render(product);const view=normalizeOpportunityUxV1(product);trackJourneyEvent('OPPORTUNITY_DETAIL_VIEW',{product:product.name,canonicalProductId:view.canonicalProductId||null,recommendation:view.recommendation});
  }catch(error){$('#app').innerHTML=`<section class="card empty"><h3>Opportunity Detail nu este disponibil</h3><p>${esc(error?.message||error)}</p><a href="commercial-radar.html">Înapoi la Opportunities</a></section>`;}
}
load();
