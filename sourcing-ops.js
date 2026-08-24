import {installCloudAutosync} from './cloud-sync.js';
import {followUpStatus,markRfqFollowUp,markRfqReplied,markRfqSent,seedRfqRecords,validateRfqRecord} from './rfq-dispatch-state.js';

const STORAGE='megaRadarRfqDispatchV1';
const PRODUCT_KEY='car-sunglasses-magnetic-visor-holder';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const read=()=>{try{const v=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(v)?v:[];}catch{return[];}};
const write=rows=>localStorage.setItem(STORAGE,JSON.stringify(rows));
const keyOf=x=>`${String(x.productKey||'').toLowerCase()}::${String(x.supplierName||'').toLowerCase()}`;
let queue=null,candidates=null,rfqText='',activeKey='';

function mergeSeed(seed,stored){const map=new Map((stored||[]).map(x=>[keyOf(x),x]));return seed.map(x=>map.has(keyOf(x))?{...x,...map.get(keyOf(x)),sourceUrl:x.sourceUrl||map.get(keyOf(x)).sourceUrl}:x);}
function currentRows(){return read().filter(x=>x.productKey===PRODUCT_KEY).sort((a,b)=>(a.priority||999)-(b.priority||999));}
function replaceRow(next){const rows=read(),k=keyOf(next),i=rows.findIndex(x=>keyOf(x)===k);if(i>=0)rows[i]=next;else rows.push(next);write(rows);}
function statusClass(s){return s==='REPLIED'?'good':s==='SENT'?'warn':'neutral';}
function slaClass(s){return ['FOLLOW_UP_1_DUE','FOLLOW_UP_2_DUE','STALE_REVIEW'].includes(s)?'warn':s==='REPLIED'?'good':'';}
function quoteUrl(r){const p=new URLSearchParams({product:r.productName,supplier:r.supplierName,platform:r.platform||''});return`./supplier-intelligence.html?${p.toString()}`;}

function render(){
  const rows=currentRows(),sla=rows.map(r=>({r,s:followUpStatus(r)}));
  $('#kNotSent').textContent=rows.filter(x=>x.status==='NOT_SENT').length;$('#kSent').textContent=rows.filter(x=>x.status==='SENT').length;$('#kReplied').textContent=rows.filter(x=>x.status==='REPLIED').length;$('#kTotal').textContent=rows.length;
  if($('#kFollowUp'))$('#kFollowUp').textContent=sla.filter(x=>x.s.due&&x.r.status==='SENT').length;
  $('#supplierGrid').innerHTML=sla.map(({r,s})=>{
    const check=validateRfqRecord(r),source=r.sourceUrl?`<a class="link" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">Vezi listing public</a>`:'',sent=r.sentAt?`<div class="meta">Trimis: ${esc(new Date(r.sentAt).toLocaleString('ro-RO'))} · ${esc(r.sentBy||'')} · ${esc(r.channel||'')}</div>`:'',reply=r.responseReceivedAt?`<div class="meta">Răspuns: ${esc(new Date(r.responseReceivedAt).toLocaleString('ro-RO'))} · ref. ${esc(r.responseReference||'')}</div>`:'';
    const follows=(r.followUps||[]).length?`<div class="meta">Follow-up-uri reale: ${(r.followUps||[]).map((x,i)=>`#${i+1} ${esc(new Date(x.sentAt).toLocaleString('ro-RO'))}`).join(' · ')}</div>`:'';
    let actions='';
    if(r.status==='NOT_SENT')actions=`<button class="btn primary" data-sent="${esc(keyOf(r))}">Marchează TRIMIS</button>`;
    else if(r.status==='SENT')actions=`${s.due&&s.status!=='STALE_REVIEW'?`<button class="btn" data-followup="${esc(keyOf(r))}">Marchează FOLLOW-UP</button>`:''}<button class="btn primary" data-replied="${esc(keyOf(r))}">Înregistrează RĂSPUNS</button>`;
    else if(r.status==='REPLIED')actions=`<a class="btn primary" href="${esc(quoteUrl(r))}">Deschide Quote Intake</a>`;
    return`<article class="supplier"><div class="top"><div><div class="priority">Prioritate ${Number(r.priority||0)}</div><h3>${esc(r.supplierName)}</h3><div class="meta">${esc(r.platform||'')}</div></div><div><span class="status ${statusClass(r.status)}">${esc(r.status)}</span><div class="status ${slaClass(s.status)}" style="margin-top:5px">${esc(s.status)}</div></div></div>${sent}${follows}${reply}<div class="meta" style="margin-top:7px">SLA: ${esc(s.nextAction||'—')}${Number.isFinite(s.hoursSinceSent)?` · ${s.hoursSinceSent.toFixed(1)}h de la RFQ`:''}</div><div class="actions">${source}${actions}</div>${!check.valid?`<div class="error">Stare invalidă: ${esc(check.blockers.join(' · '))}</div>`:''}</article>`;
  }).join('');
  $('#rfqBody').value=rfqText||'';
}

function rowByKey(k){return currentRows().find(x=>keyOf(x)===k)||null;}
function openSent(k){const r=rowByKey(k);if(!r)return;activeKey=k;$('#sentSupplier').textContent=r.supplierName;$('#sentBy').value='';$('#sentChannel').value='Alibaba';$('#sentConfirm').checked=false;$('#sentError').textContent='';$('#sentDialog').showModal();}
function openReply(k){const r=rowByKey(k);if(!r)return;activeKey=k;$('#replySupplier').textContent=r.supplierName;$('#responseReference').value='';$('#replyConfirm').checked=false;$('#replyError').textContent='';$('#replyDialog').showModal();}
function openFollowUp(k){const r=rowByKey(k);if(!r)return;activeKey=k;$('#followSupplier').textContent=r.supplierName;$('#followBy').value=r.sentBy||'';$('#followChannel').value=r.channel||'Alibaba';$('#followNote').value='';$('#followConfirm').checked=false;$('#followError').textContent='';$('#followDialog').showModal();}
async function copyRfq(){try{await navigator.clipboard.writeText(rfqText);$('#copyStatus').textContent='RFQ copiat. Copierea NU înseamnă că a fost trimis.';}catch{$('#copyStatus').textContent='Nu am putut copia automat. Selectează textul manual.';}}

async function boot(){await installCloudAutosync({hydrate:true,reloadOnHydrate:false});const[q,c,r]=await Promise.all([fetch('./supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json',{cache:'no-store'}).then(x=>x.json()),fetch('./supplier-candidates/car-sunglasses-magnetic-visor-holder.json',{cache:'no-store'}).then(x=>x.json()),fetch('./docs/rfq-car-sunglasses-magnetic-visor-holder.md',{cache:'no-store'}).then(x=>x.text())]);queue=q;candidates=c;rfqText=r;const seed=seedRfqRecords(queue,candidates),stored=read(),merged=mergeSeed(seed,stored.filter(x=>x.productKey===PRODUCT_KEY)),others=stored.filter(x=>x.productKey!==PRODUCT_KEY);if(JSON.stringify([...others,...merged])!==JSON.stringify(stored))write([...others,...merged]);render();}

$('#copyRfq')?.addEventListener('click',copyRfq);
$('#supplierGrid')?.addEventListener('click',e=>{const a=e.target.closest('[data-sent]'),b=e.target.closest('[data-replied]'),f=e.target.closest('[data-followup]');if(a)openSent(a.dataset.sent);if(b)openReply(b.dataset.replied);if(f)openFollowUp(f.dataset.followup);});
$('#cancelSent')?.addEventListener('click',()=>$('#sentDialog').close());$('#cancelReply')?.addEventListener('click',()=>$('#replyDialog').close());$('#cancelFollow')?.addEventListener('click',()=>$('#followDialog').close());
$('#sentForm')?.addEventListener('submit',e=>{e.preventDefault();const r=rowByKey(activeKey);if(!r)return;const result=markRfqSent(r,{sentBy:$('#sentBy').value,channel:$('#sentChannel').value,confirmedRealDispatch:$('#sentConfirm').checked});if(!result.ok){$('#sentError').textContent=result.blockers.join(' · ');return;}replaceRow(result.record);$('#sentDialog').close();render();});
$('#followForm')?.addEventListener('submit',e=>{e.preventDefault();const r=rowByKey(activeKey);if(!r)return;const result=markRfqFollowUp(r,{sentBy:$('#followBy').value,channel:$('#followChannel').value,note:$('#followNote').value,confirmedRealFollowUp:$('#followConfirm').checked});if(!result.ok){$('#followError').textContent=result.blockers.join(' · ');return;}replaceRow(result.record);$('#followDialog').close();render();});
$('#replyForm')?.addEventListener('submit',e=>{e.preventDefault();const r=rowByKey(activeKey);if(!r)return;const result=markRfqReplied(r,{responseReference:$('#responseReference').value,confirmedRealResponse:$('#replyConfirm').checked});if(!result.ok){$('#replyError').textContent=result.blockers.join(' · ');return;}replaceRow(result.record);$('#replyDialog').close();render();});
boot().catch(e=>{$('#pageError').textContent=`Sourcing Ops indisponibil: ${e?.message||e}`;});
