import {getCurrentSession} from './supabase-client.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
async function api(path,options={}){const session=await getCurrentSession();if(!session?.access_token){location.href='login.html?next=beta-participants.html';return null;}const r=await fetch(path,{...options,headers:{...(options.headers||{}),authorization:`Bearer ${session.access_token}`}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Request failed ${r.status}`);return data;}
const pct=v=>v===null||v===undefined?'UNKNOWN':`${Number(v).toFixed(1)}%`;
const metricValue=m=>m?.key==='firstUsefulOpportunityMinutes'?(m.value==null?'UNKNOWN':`${Number(m.value).toFixed(1)} min`):m?.key==='cohortSize'?(m.value==null?'UNKNOWN':String(m.value)):pct(m?.value);
const targetText=m=>m?.key==='firstUsefulOpportunityMinutes'?`< ${m.target} min`:m?.key==='cohortSize'?`10–15`:`${m.comparison==='LT'?'<':'>'} ${m.target}%`;
function renderScorecard(data){
  $('#betaStatus').textContent=data.status||'UNKNOWN';
  $('#betaStatus').dataset.status=data.status||'UNKNOWN';
  $('#linked').textContent=data.linkedParticipantCount??0;
  const metrics=Object.values(data.metrics||{});
  $('#scorecard').innerHTML=metrics.map(m=>`<div class="metric ${String(m.status||'UNKNOWN').toLowerCase()}"><div class="metricTop"><b>${esc(m.label)}</b><span>${esc(m.status)}</span></div><strong>${esc(metricValue(m))}</strong><small>Țintă ${esc(targetText(m))} · n=${Number(m.samples||0)}</small></div>`).join('')||'<div class="muted">Scorecard indisponibil.</div>';
  const unknown=(data.unknown||[]).join(', ')||'niciunul';const failed=(data.failed||[]).join(', ')||'niciunul';
  $('#scorecardNote').textContent=`UNKNOWN: ${unknown} · FAIL: ${failed} · automaticLaunchAllowed=false · purchaseAuthorized=false`;
}
function render(data){const s=data.summary||{},st=s.statuses||{};$('#total').textContent=s.participants??0;$('#activated').textContent=st.ACTIVATED??0;$('#completed').textContent=st.COMPLETED??0;$('#rating').textContent=s.avgRating==null?'—':String(s.avgRating);$('#unlinked').textContent=s.unlinked??0;$('#feedback').textContent=`${s.feedbackCount||0} feedback-uri · would pay: ${s.wouldPay?.YES||0} DA / ${s.wouldPay?.NO||0} NU / ${s.wouldPay?.UNKNOWN||0} necunoscut`;
$('#list').innerHTML=(data.participants||[]).length?(data.participants||[]).map(p=>`<div class="row"><div><b>${esc(p.email)}</b><div class="muted">${esc(p.notes||'—')}</div></div><span>${esc(p.status)}</span><span class="muted">${p.user_id&&p.workspace_id?`LINKED · ${esc(p.workspace_id)}`:'IDENTITATE NELEGATĂ'}</span><button type="button" data-link-id="${esc(p.id)}" ${p.user_id&&p.workspace_id?'disabled':''}>${p.user_id&&p.workspace_id?'Legat':'Leagă contul real'}</button></div>`).join(''):'<div class="muted">Nu există încă participanți beta înregistrați.</div>';
  document.querySelectorAll('[data-link-id]').forEach(button=>button.addEventListener('click',()=>linkIdentity(button.dataset.linkId)));
}
async function linkIdentity(participantId){
  $('#message').textContent='Validez identitatea reală și membership-ul…';
  try{
    const workspaceId=window.prompt('Workspace ID opțional. Lasă gol dacă utilizatorul are exact un workspace eligibil.','')||'';
    await api('/api/internal/beta-participants',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'LINK_IDENTITY',participantId,workspaceId:workspaceId.trim()||null})});
    $('#message').textContent='Participant legat de contul și workspace-ul real.';await load();
  }catch(error){$('#message').textContent=`Eroare legare: ${error.message}`;}
}
async function load(){try{const [participants,scorecard]=await Promise.all([api('/api/internal/beta-participants'),api('/api/internal/closed-beta-scorecard')]);if(participants)render(participants);if(scorecard)renderScorecard(scorecard);}catch(e){$('#message').textContent=`Eroare: ${e.message}`;}}
$('#form')?.addEventListener('submit',async e=>{e.preventDefault();$('#message').textContent='Salvez…';try{await api('/api/internal/beta-participants',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:$('#email').value,status:$('#status').value,notes:$('#notes').value})});$('#form').reset();$('#message').textContent='Participant salvat.';await load();}catch(error){$('#message').textContent=`Eroare: ${error.message}`;}});
$('#refresh')?.addEventListener('click',()=>load());
load();
