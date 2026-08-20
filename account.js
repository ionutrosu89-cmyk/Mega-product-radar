import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,signOut} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {installCloudAutosync,localCloudSummary,pushLocalToCloud,pullCloudToLocal} from './cloud-sync.js';
import {getBillingStatus,cancelSubscription} from './billing-client.js';
const $=s=>document.querySelector(s);
function refreshLocalCount(){const total=localCloudSummary().reduce((s,x)=>s+x.count,0);$('#localCount').textContent=String(total);return total;}
function syncMessage(text,state='Pregatit'){ $('#syncMessage').textContent=text; $('#syncState').textContent=state; }
function fmtDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ro-RO');}
async function refreshBilling({retry=false}={}){
  const message=$('#billingMessage');
  try{
    let data=await getBillingStatus();
    if(retry){for(let i=0;i<5&&['FREE','STARTER'].includes(String(data.workspace?.plan||'').toUpperCase());i++){await new Promise(r=>setTimeout(r,1200));data=await getBillingStatus();}}
    const sub=data.subscription;
    $('#billingState').textContent=sub?String(sub.status||'—').toUpperCase():'FREE';
    $('#billingEnd').textContent=fmtDate(sub?.currentPeriodEnd);
    $('#plan').textContent=data.workspace?.plan||$('#plan').textContent;
    const managed=Boolean(sub?.managedByStripe),pending=Boolean(sub?.cancelAtPeriodEnd);
    $('#cancelBilling').hidden=!managed||pending||!['active','trialing','past_due'].includes(String(sub?.status||'').toLowerCase());
    message.textContent=pending?`Anulare programată. Accesul rămâne activ până la ${fmtDate(sub.currentPeriodEnd)}.`:managed?'Abonamentul este administrat prin Stripe. Schimbarea planului reutilizează același abonament.':'Nu există încă un abonament Stripe activ.';
  }catch(e){message.textContent=`Billing indisponibil momentan: ${e.message}`;}
}
async function load(){
  if(!isSaasConfigured(SAAS_CONFIG)){ $('#authStatus').textContent='FOUNDATION'; return; }
  $('#foundation').hidden=true;
  const session=await getCurrentSession();
  if(!session){location.href='login.html';return;}
  $('#email').textContent=session.user.email||session.user.id;
  $('#authStatus').textContent='Autentificat';
  try{await installCloudAutosync({hydrate:true,reloadOnHydrate:false});const ws=await ensurePersonalWorkspace('My Radar');$('#workspace').textContent=ws.name||'My Radar';$('#plan').textContent=ws.plan||'FREE';$('#status').textContent='Workspace cloud activ, separat prin RLS și sincronizat cloud-first.';refreshLocalCount();syncMessage('Cloud-first activ: modificările din modulele conectate se sincronizează automat.','AUTO');}catch(e){$('#status').textContent=e.message;}
  const qs=new URLSearchParams(location.search);await refreshBilling({retry:['success','changed'].includes(qs.get('billing'))});
}
$('#cloudPush').addEventListener('click',async()=>{
  if(!confirm('Trimiți datele locale curente în cloud? Copia cloud pentru cele 7 categorii va fi înlocuită.'))return;
  $('#cloudPush').disabled=true;syncMessage('Sincronizare în curs…','Push');
  try{const r=await pushLocalToCloud();syncMessage(`Push reușit: ${r.total} înregistrări salvate în workspace-ul tău.`, 'OK');}
  catch(e){syncMessage(`Eroare Push: ${e.message}`,'Eroare');}
  finally{$('#cloudPush').disabled=false;refreshLocalCount();}
});
$('#cloudPull').addEventListener('click',async()=>{
  if(!confirm('Descarci copia cloud? Datele locale din cele 7 categorii vor fi înlocuite.'))return;
  $('#cloudPull').disabled=true;syncMessage('Descărcare în curs…','Pull');
  try{const r=await pullCloudToLocal();syncMessage(`Pull reușit: ${r.total} înregistrări restaurate local.`, 'OK');}
  catch(e){syncMessage(`Eroare Pull: ${e.message}`,'Eroare');}
  finally{$('#cloudPull').disabled=false;refreshLocalCount();}
});
$('#cancelBilling').addEventListener('click',async()=>{
  if(!confirm('Anulezi abonamentul la finalul perioadei curente? Accesul rămâne activ până atunci.'))return;
  $('#cancelBilling').disabled=true;
  try{await cancelSubscription();await refreshBilling();}catch(e){$('#billingMessage').textContent=`Anularea nu a reușit: ${e.message}`;$('#cancelBilling').disabled=false;}
});
$('#logout').addEventListener('click',async()=>{await signOut();location.href='login.html';});
load();
