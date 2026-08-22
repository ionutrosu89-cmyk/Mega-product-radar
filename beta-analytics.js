import {getCurrentSession} from './supabase-client.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number(v||0);
const rate=v=>v===null||v===undefined?'—':`${Number(v).toFixed(1)}%`;
function countRow(label,value){return `<div class="eventrow"><span>${esc(label)}</span><b>${n(value)}</b></div>`;}
function metricCard(value,label,klass=''){return `<div class="retentionCard"><b class="${klass}">${esc(value)}</b><small>${esc(label)}</small></div>`;}
function funnelHtml(stages=[]){
  const max=Math.max(1,...stages.map(x=>n(x.workspaces)));
  return stages.map((x,i)=>`<div class="step"><div><b>${esc(x.label)}</b><div class="bar"><i style="width:${n(x.workspaces)===0?1:Math.max(3,n(x.workspaces)/max*100)}%"></i></div></div><strong>${n(x.workspaces)}</strong><div class="rate">${i===0?'bază':rate(x.conversionFromPrevious)}</div></div>`).join('');
}
function render(data){
  const t=data.totals||{},r=data.retention||{};
  $('#workspaces').textContent=n(t.workspaces);
  $('#active').textContent=n(t.activeWorkspaces);
  $('#users').textContent=n(t.activeUsers);
  $('#onboarding').textContent=n(t.onboardingCompleted);
  $('#upgrade').textContent=n(t.upgradeIntentWorkspaces);
  $('#paid').textContent=n(t.activePaidWorkspaces);
  $('#cancelPending').textContent=n(t.cancelPendingWorkspaces);
  $('#retentionRate').textContent=`${n(r.retentionRate).toFixed(1)}%`;
  $('#usageFunnel').innerHTML=funnelHtml(data.usageFunnel||[]);
  $('#billingFunnel').innerHTML=funnelHtml(data.billingFunnel||[]);
  $('#plans').innerHTML=['FREE','DISCOVER','RADAR','LAUNCH'].map(p=>`<div class="plan"><b>${n(data.byPlan?.[p])}</b><small>${p}</small></div>`).join('');
  $('#commercialChanges').innerHTML=countRow('Schimbări plan',t.planChangedWorkspaces)+countRow('Anulări programate în fereastră',t.cancelScheduledWorkspaces)+countRow('Anulări retrase în fereastră',t.cancelUnscheduledWorkspaces)+countRow('Abonamente încheiate în fereastră',t.endedWorkspaces);
  $('#retention').innerHTML=metricCard(n(r.activePaid),'Active')+metricCard(n(r.cancelPending),'Active cu anulare programată','warn')+metricCard(n(r.retainedPaid),'Retained fără anulare','ok')+metricCard(n(r.endedInWindow),'Churn real în fereastră','bad')+metricCard(`${n(r.retentionRate).toFixed(1)}%`,'Retained / active','ok')+metricCard(`${n(r.cancelPendingRate).toFixed(1)}%`,'Cancel pending / active','warn')+metricCard(`${n(r.churnRate).toFixed(1)}%`,'Churn observat','bad');
  $('#events').innerHTML=Object.entries(data.eventCounts||{}).sort((a,b)=>b[1]-a[1]).slice(0,24).map(([k,v])=>`<div class="eventrow"><span>${esc(k)}</span><b>${v}</b></div>`).join('')||'<div class="status">Nu există încă evenimente.</div>';
  $('#status').textContent=`REAL EVENT DATA · Actualizat ${new Date(data.generatedAt).toLocaleString('ro-RO')} · fereastră ${data.days} zile · ${n(t.events)} evenimente. Conversia cu bază 0 este afișată „—”, nu 0%. Cancel pending nu este churn.`;
}
async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=beta-analytics.html';return;}
  $('#status').textContent='Încarc analytics…';
  const r=await fetch(`/api/internal/beta-analytics?days=${encodeURIComponent($('#days').value)}`,{headers:{authorization:`Bearer ${session.access_token}`},cache:'no-store'});
  const d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.error||'Analytics indisponibil');
  render(d);
}
$('#refresh').addEventListener('click',()=>load().catch(e=>$('#status').textContent=e.message));
$('#days').addEventListener('change',()=>load().catch(e=>$('#status').textContent=e.message));
load().catch(e=>$('#status').textContent=e.message);
