import {getCurrentSession} from './supabase-client.js';
import {getActiveWorkspace} from './workspace-client.js';
import {roCategory,roProductName} from './product-ro.js';
import {trackJourneyEvent,installJourneyLinkTracking} from './journey-events.js';
import {normalizeOpportunityUxV1,nextValidationStepV1,opportunityActionStorageKeyV1,isCanonicalFinalistV1,OPPORTUNITY_COMPONENT_ORDER} from './opportunity-ux-v1.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>finite(v)===null?'UNKNOWN':`${Math.round(Number(v))}%`;
const score=v=>finite(v)===null?'—':Math.round(Number(v));
const statusClass=v=>String(v||'UNKNOWN').toLowerCase().replace(/[^a-z]/g,'');
let products=[];

function savedAction(product,view){const key=opportunityActionStorageKeyV1(product,view);return key?localStorage.getItem(key):null;}
function setAction(product,view,action){const key=opportunityActionStorageKeyV1(product,view);if(key)localStorage.setItem(key,action);}
function priority(view){if(isCanonicalFinalistV1(view))return 4;if(view.recommendation==='VALIDATE')return 3;if(view.recommendation==='PROMISING')return 2;return 1;}
function componentPills(view){return OPPORTUNITY_COMPONENT_ORDER.map(name=>{const c=view.components[name];return `<span class="component ${statusClass(c.status)}" title="${esc(c.label)}: ${esc(c.status)}">${esc(c.label)} · ${esc(c.status)}</span>`;}).join('');}
function card(product){
  const view=normalizeOpportunityUxV1(product),next=nextValidationStepV1(view),name=roProductName(product.name),cat=roCategory(product.cat||'')||product.cat||'Categorie';
  const action=savedAction(product,view);
  const detail=`commercial-product.html?product=${encodeURIComponent(product.name||'')}${view.canonicalProductId?`&canonical=${encodeURIComponent(view.canonicalProductId)}`:''}`;
  const blockerText=view.blockers.length?view.blockers.slice(0,2).join(' · '):'Niciun blocker canonic raportat';
  return `<article class="card" data-product="${esc(product.name||'')}"><div class="top"><div class="product"><h3>${esc(name)}</h3><div class="muted">${esc(cat)}${view.canonicalProductId?` · ${esc(view.canonicalProductId)}`:' · identitate canonică lipsă'}</div><span class="badge ${statusClass(view.recommendation)}">${esc(view.recommendation)}</span></div><div class="score">${score(view.opportunityScore)}<small>OPPORTUNITY SCORE</small></div></div><div class="metrics"><div class="metric"><small>Confidence</small><b>${pct(view.confidence)}</b></div><div class="metric"><small>Date lipsă</small><b>${view.missingComponents.length}</b></div><div class="metric"><small>Blockers</small><b>${view.blockers.length}</b></div></div><div class="component-strip">${componentPills(view)}</div><div class="next"><b>Următorul pas:</b> ${esc(next.reason)}<br><small>${esc(blockerText)}</small></div><div class="actions customer-actions"><a class="primary" data-journey-event="OPPORTUNITY_OPEN_DETAIL" href="${detail}">Opportunity Detail</a>${['IGNORE','WATCH','VALIDATE'].map(x=>`<button type="button" data-action="${x}" class="${action===x?'selected':''}">${x}</button>`).join('')}</div></article>`;
}
function filtered(){
  const q=(document.querySelector('#search')?.value||'').trim().toLowerCase();
  const sortBy=document.querySelector('#sort')?.value||'PRIORITY';
  const list=products.filter(p=>!q||`${p.name||''} ${roProductName(p.name)} ${p.cat||''} ${roCategory(p.cat||'')}`.toLowerCase().includes(q));
  list.sort((a,b)=>{const av=normalizeOpportunityUxV1(a),bv=normalizeOpportunityUxV1(b);if(sortBy==='SCORE')return (bv.opportunityScore??-1)-(av.opportunityScore??-1);if(sortBy==='CONFIDENCE')return (bv.confidence??-1)-(av.confidence??-1);return priority(bv)-priority(av)||(bv.opportunityScore??-1)-(av.opportunityScore??-1);});
  return list;
}
function render(){
  const views=products.map(normalizeOpportunityUxV1),list=filtered();
  document.querySelector('#grid').innerHTML=list.length?list.map(card).join(''):'<div class="empty customer-empty"><h3>Nicio oportunitate</h3><p>Schimbă filtrul pentru a vedea din nou produsele.</p></div>';
  document.querySelector('#kTotal').textContent=products.length;
  document.querySelector('#kFinalist').textContent=views.filter(isCanonicalFinalistV1).length;
  document.querySelector('#kValidate').textContent=views.filter(v=>v.recommendation==='VALIDATE').length;
  document.querySelector('#kUnknown').textContent=views.filter(v=>!v.rawPresent||v.missingComponents.length||!v.canonicalProductId).length;
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',event=>{const cardEl=event.currentTarget.closest('[data-product]');const product=products.find(p=>String(p.name||'')===cardEl?.dataset.product);if(!product)return;const view=normalizeOpportunityUxV1(product),action=event.currentTarget.dataset.action;setAction(product,view,action);trackJourneyEvent('OPPORTUNITY_WORK_ACTION',{product:product.name,canonicalProductId:view.canonicalProductId||null,action});render();}));
}
async function load(){
  const grid=document.querySelector('#grid');
  try{
    const session=await getCurrentSession();if(!session){location.href='login.html?next=commercial-radar.html';return;}
    const workspace=await getActiveWorkspace();if(!workspace?.id)throw new Error('Workspace indisponibil.');
    const response=await fetch('/api/commercial/radar',{headers:{authorization:`Bearer ${session.access_token}`,'x-mpr-workspace-id':workspace.id},cache:'no-store'});const data=await response.json();
    if(response.status===403){trackJourneyEvent('UPGRADE_INTENT_RADAR',{source:'OPPORTUNITIES_ACCESS_GATE'});location.href='pricing.html?upgrade=RADAR';return;}
    if(!response.ok)throw new Error(data.error||'Opportunities indisponibile');
    document.querySelector('#planName').textContent=data.plan||'RADAR';products=Array.isArray(data.products)?data.products:[];render();trackJourneyEvent('OPPORTUNITIES_VIEW',{products:products.length,finalists:products.map(normalizeOpportunityUxV1).filter(isCanonicalFinalistV1).length});
  }catch(error){grid.innerHTML=`<div class="errorbox customer-empty"><h3>Opportunities indisponibile momentan</h3><p>${esc(error?.message||error)}</p><a href="home.html">Înapoi la Today</a></div>`;}
}
document.querySelector('#search')?.addEventListener('input',render);document.querySelector('#sort')?.addEventListener('change',render);installJourneyLinkTracking(document);load();
