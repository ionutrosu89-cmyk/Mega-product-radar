import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,signOut} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {installCloudAutosync,localCloudSummary,pushLocalToCloud,pullCloudToLocal} from './cloud-sync.js';
const $=s=>document.querySelector(s);
function refreshLocalCount(){const total=localCloudSummary().reduce((s,x)=>s+x.count,0);$('#localCount').textContent=String(total);return total;}
function syncMessage(text,state='Pregatit'){ $('#syncMessage').textContent=text; $('#syncState').textContent=state; }
async function load(){
  if(!isSaasConfigured(SAAS_CONFIG)){ $('#authStatus').textContent='FOUNDATION'; return; }
  $('#foundation').hidden=true;
  const session=await getCurrentSession();
  if(!session){location.href='login.html';return;}
  $('#email').textContent=session.user.email||session.user.id;
  $('#authStatus').textContent='Autentificat';
  try{await installCloudAutosync({hydrate:true,reloadOnHydrate:false});const ws=await ensurePersonalWorkspace('My Radar');$('#workspace').textContent=ws.name||'My Radar';$('#plan').textContent=ws.plan||'STARTER';$('#status').textContent='Workspace cloud activ, separat prin RLS si sincronizat cloud-first.';refreshLocalCount();syncMessage('Cloud-first activ: modificarile din modulele conectate se sincronizeaza automat.','AUTO');}catch(e){$('#status').textContent=e.message;}
}
$('#cloudPush').addEventListener('click',async()=>{
  if(!confirm('Trimiti datele locale curente in cloud? Copia cloud pentru cele 7 categorii va fi inlocuita.'))return;
  $('#cloudPush').disabled=true;syncMessage('Sincronizare in curs…','Push');
  try{const r=await pushLocalToCloud();syncMessage(`Push reusit: ${r.total} inregistrari salvate in workspace-ul tau.`, 'OK');}
  catch(e){syncMessage(`Eroare Push: ${e.message}`,'Eroare');}
  finally{$('#cloudPush').disabled=false;refreshLocalCount();}
});
$('#cloudPull').addEventListener('click',async()=>{
  if(!confirm('Descarci copia cloud? Datele locale din cele 7 categorii vor fi inlocuite.'))return;
  $('#cloudPull').disabled=true;syncMessage('Descarcare in curs…','Pull');
  try{const r=await pullCloudToLocal();syncMessage(`Pull reusit: ${r.total} inregistrari restaurate local.`, 'OK');}
  catch(e){syncMessage(`Eroare Pull: ${e.message}`,'Eroare');}
  finally{$('#cloudPull').disabled=false;refreshLocalCount();}
});
$('#logout').addEventListener('click',async()=>{await signOut();location.href='login.html';});
load();
