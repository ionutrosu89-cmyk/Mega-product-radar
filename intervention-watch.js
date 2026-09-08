import {getSupabaseClient} from './supabase-client.js';
import {getActiveWorkspace} from './workspace-client.js';

const state={rows:[],filter:'all',selected:null};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=v=>v?new Date(v).toLocaleString('ro-RO',{dateStyle:'short',timeStyle:'short'}):'—';
const uiSeverity=sev=>sev==='critical'||sev==='high'?'intervention':sev==='medium'?'review':sev==='low'?'watch':'monitor';
const badge=sev=>{const s=uiSeverity(sev);return `<span class="badge ${s}">${s==='intervention'?'🔴 Intervention':s==='review'?'🟠 Review':s==='watch'?'🟡 Watch':'🟢 Monitor'}</span>`};
function render(){
 const rows=state.rows.filter(r=>state.filter==='all'||uiSeverity(r.severity)===state.filter);
 $('#list').innerHTML=rows.length?rows.map(r=>`<article class="item"><div class="itemtop"><div><b>${esc(r.title||r.canonical_key||'Intervention')}</b><div class="meta">${esc(r.event_type||'change')} · ${fmt(r.detected_at)}</div></div>${badge(r.severity)}</div><div class="summary"><b>Ce s-a schimbat:</b> ${esc(r.change_summary||'—')}</div>${r.impact_summary?`<div class="meta"><b>Impact:</b> ${esc(r.impact_summary)}</div>`:''}${r.recommended_action?`<div class="meta"><b>Acțiune recomandată:</b> ${esc(r.recommended_action)}</div>`:''}<div class="actions"><button class="btn primary" data-open="${r.id}">View details</button>${r.status!=='resolved'&&r.status!=='ignored'?`<button class="btn ghost" data-ack="${r.id}">Acknowledge</button><button class="btn ghost" data-resolve="${r.id}">Resolve</button>`:''}</div></article>`).join(''):'<div class="empty">Nu există intervenții pentru filtrul selectat.</div>';
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>act(b.dataset.resolve,'resolve','Intervenția a fost rezolvată.'));
 document.querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>act(b.dataset.ack,'acknowledge','Intervenția a fost confirmată.'));
}
async function load(){
 try{const client=await getSupabaseClient();const ws=await getActiveWorkspace();if(!client||!ws){$('#workspace').textContent='Login required';$('#list').innerHTML='<div class="empty">Autentifică-te pentru a vedea workspace-ul și intervențiile.</div>';return;}
  $('#workspace').textContent=ws.name||ws.slug;
  await client.rpc('mpr_sync_intervention_watch',{p_workspace_id:ws.id,p_lookback_hours:48,p_limit:100});
  const {data,error}=await client.from('intervention_events_v1').select('*').eq('workspace_id',ws.id).order('detected_at',{ascending:false}).limit(200);if(error)throw error;state.rows=data||[];
  $('#total').textContent=state.rows.filter(r=>!['resolved','ignored'].includes(r.status)).length;
  $('#urgent').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='intervention'&&!['resolved','ignored'].includes(r.status)).length;
  $('#review').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='review'&&!['resolved','ignored'].includes(r.status)).length;
  $('#watch').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='watch'&&!['resolved','ignored'].includes(r.status)).length;
  $('#resolved').textContent=state.rows.filter(r=>r.status==='resolved').length;$('#refreshAt').textContent=new Date().toLocaleTimeString('ro-RO');render();
 }catch(e){$('#list').innerHTML=`<div class="empty">Nu am putut încărca datele: ${esc(e.message||e)}</div>`}
}
async function openDetail(id){
 try{const client=await getSupabaseClient();const {data,error}=await client.from('intervention_watch_detail_v1').select('*').eq('id',id).single();if(error)throw error;state.selected=data;
  $('#detailTitle').textContent=data.title||data.canonical_key||'Intervention';$('#detailBody').innerHTML=`<div class="detail-grid"><div><div class="detail-label">Priority</div>${badge(data.severity)}</div><div><div class="detail-label">Status</div><b>${esc(data.status)}</b></div><div><div class="detail-label">Detected</div><b>${fmt(data.detected_at)}</b></div><div><div class="detail-label">Event</div><b>${esc(data.event_type||'change')}</b></div></div><section class="detail-section"><h3>What changed</h3><p>${esc(data.change_summary||'—')}</p></section><section class="detail-section"><h3>Why it matters</h3><p>${esc(data.impact_summary||'—')}</p></section><section class="detail-section"><h3>Recommended action</h3><p>${esc(data.recommended_action||'—')}</p></section><section class="detail-section"><h3>Evidence</h3><pre>${esc(JSON.stringify(data.evidence||{},null,2))}</pre></section><section class="detail-section"><h3>Before → After</h3><div class="compare"><pre>${esc(JSON.stringify(data.previous_value||{},null,2))}</pre><pre>${esc(JSON.stringify(data.current_value||{},null,2))}</pre></div></section><section class="detail-section"><h3>Audit trail</h3>${(data.audit_trail||[]).length?data.audit_trail.map(a=>`<div class="audit"><b>${esc(a.action_type)}</b><span>${fmt(a.executed_at||a.created_at)}</span><p>${esc(a.action_text||a.notes||'')}</p></div>`).join(''):'<div class="small">Nicio acțiune înregistrată.</div>'}</section><div class="actions"><button class="btn primary" id="detailResolve">Resolve</button><button class="btn ghost" id="detailAcknowledge">Acknowledge</button><button class="btn ghost" id="detailIgnore">Ignore</button><button class="btn ghost" id="detailClose">Close</button></div>`;
  $('#detail').classList.add('open');$('#detailResolve').onclick=()=>act(id,'resolve','Resolved from Intervention Watch');$('#detailAcknowledge').onclick=()=>act(id,'acknowledge','Acknowledged from Intervention Watch');$('#detailIgnore').onclick=()=>act(id,'ignore','Ignored from Intervention Watch');$('#detailClose').onclick=()=>$('#detail').classList.remove('open');
 }catch(e){show(e.message||String(e))}
}
async function act(id,type,message){try{const client=await getSupabaseClient();const ws=await getActiveWorkspace();const {error}=await client.rpc('record_intervention_action',{p_intervention_id:id,p_workspace_id:ws.id,p_action_type:type,p_action_text:message});if(error)throw error;show(message);$('#detail').classList.remove('open');await load()}catch(e){show(e.message||String(e))}}
function show(text){const t=$('#toast');t.textContent=text;t.style.display='block';clearTimeout(show.timer);show.timer=setTimeout(()=>t.style.display='none',3200)}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;render()});
$('#refresh').onclick=load;load();
