import {getSupabaseClient} from './supabase-client.js';
import {getActiveWorkspace} from './workspace-client.js';

const state={rows:[],filter:'all'};
const $=s=>document.querySelector(s);
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmt(v){return v?new Date(v).toLocaleString('ro-RO',{dateStyle:'short',timeStyle:'short'}):'—';}
function uiSeverity(sev){return sev==='critical'||sev==='high'?'intervention':sev==='medium'?'review':sev==='low'?'watch':'monitor';}
function badge(sev){const s=uiSeverity(sev);return `<span class="badge ${s}">${s==='intervention'?'🔴 Intervention':s==='review'?'🟠 Review':s==='watch'?'🟡 Watch':'🟢 Monitor'}</span>`;}
function render(){
 const rows=state.rows.filter(r=>state.filter==='all'||uiSeverity(r.severity)===state.filter);
 $('#list').innerHTML=rows.length?rows.map(r=>`<article class="item"><div class="itemtop"><div><b>${esc(r.title||r.canonical_key||'Intervention')}</b><div class="meta">${esc(r.event_type||'change')} · ${fmt(r.detected_at)}</div></div>${badge(r.severity)}</div><div class="summary"><b>Ce s-a schimbat:</b> ${esc(r.change_summary||'—')}</div>${r.impact_summary?`<div class="meta"><b>Impact:</b> ${esc(r.impact_summary)}</div>`:''}${r.recommended_action?`<div class="meta"><b>Acțiune:</b> ${esc(r.recommended_action)}</div>`:''}<div class="actions"><button class="btn primary" data-open="${r.id}">View details</button>${r.status!=='resolved'?`<button class="btn ghost" data-resolve="${r.id}">Resolve</button>`:''}</div></article>`).join(''):'<div class="empty">Nu există intervenții pentru filtrul selectat.</div>';
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>resolve(b.dataset.resolve));
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const r=state.rows.find(x=>x.id===b.dataset.open);if(r)show(`${r.title||r.canonical_key||'Intervention'}\n\n${r.change_summary||''}\n\nImpact: ${r.impact_summary||'—'}\n\nAcțiune: ${r.recommended_action||'—'}`);});
}
async function load(){
 try{
  const client=await getSupabaseClient();const ws=await getActiveWorkspace();
  if(!client||!ws){$('#workspace').textContent='Login required';$('#list').innerHTML='<div class="empty">Autentifică-te pentru a vedea workspace-ul și intervențiile.</div>';return;}
  $('#workspace').textContent=ws.name||ws.slug;
  await client.rpc('mpr_sync_intervention_watch',{p_workspace_id:ws.id,p_lookback_hours:48,p_limit:100});
  const {data,error}=await client.from('intervention_events_v1').select('*').eq('workspace_id',ws.id).order('detected_at',{ascending:false}).limit(200);
  if(error)throw error;state.rows=data||[];
  $('#total').textContent=state.rows.filter(r=>!['resolved','ignored'].includes(r.status)).length;
  $('#urgent').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='intervention'&&r.status!=='resolved').length;
  $('#review').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='review'&&r.status!=='resolved').length;
  $('#watch').textContent=state.rows.filter(r=>uiSeverity(r.severity)==='watch'&&r.status!=='resolved').length;
  $('#resolved').textContent=state.rows.filter(r=>r.status==='resolved').length;
  $('#refreshAt').textContent=new Date().toLocaleTimeString('ro-RO');render();
 }catch(e){$('#list').innerHTML=`<div class="empty">Nu am putut încărca datele: ${esc(e.message||e)}</div>`;}
}
async function resolve(id){
 try{const client=await getSupabaseClient();const {error}=await client.rpc('resolve_intervention_event',{p_event_id:id,p_note:'Resolved from Intervention Watch'});if(error)throw error;show('Intervenția a fost marcată ca rezolvată.');await load();}catch(e){show(e.message||String(e));}
}
function show(text){const t=$('#toast');t.textContent=text;t.style.display='block';clearTimeout(show.timer);show.timer=setTimeout(()=>t.style.display='none',3200);}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;render();});
$('#refresh').onclick=load;load();
