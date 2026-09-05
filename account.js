import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,signOut,updatePassword} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {installCloudAutosync,localCloudSummary,pushLocalToCloud,pullCloudToLocal} from './cloud-sync.js';
import {getBillingStatus,cancelSubscription,resumeSubscription} from './billing-client.js';
const $=s=>document.querySelector(s);
const recoveryRequested=new URLSearchParams(location.search).get('reset')==='1';
function refreshLocalCount(){const total=localCloudSummary().reduce((s,x)=>s+x.count,0);$('#localCount').textContent=String(total);return total;}
function syncMessage(text,state='Pregătit'){ $('#syncMessage').textContent=text; $('#syncState').textContent=state; }
function recoveryMessage(text,kind=''){const el=$('#recoveryStatus');el.textContent=text;el.dataset.kind=kind;}
function validateNewPassword(password,confirmation){if(password.length<12)throw new Error('Parola trebuie să aibă minimum 12 caractere.');if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))throw new Error('Parola trebuie să conțină literă mică, literă mare, cifră și simbol.');if(password!==confirmation)throw new Error('Cele două parole nu coincid.');}
function fmtDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ro-RO');}
function billingStateLabel(status){const s=String(status||'').toLowerCase();return ({active:'ACTIV',trialing:'PERIOADĂ DE TEST',past_due:'PLATĂ RESTANTĂ',canceled:'ANULAT',cancelled:'ANULAT',incomplete:'INCOMPLET',unpaid:'NEPLĂTIT'})[s]||String(status||'—').toUpperCase();}
async function refreshBilling({retry=false,expectedCancel=null,stripeFallback=null,expectedPlan=null}={}){
  const message=$('#billingMessage');
  try{
    let data=await getBillingStatus();
    const normalizedExpectedPlan=['DISCOVER','RADAR','LAUNCH'].includes(String(expectedPlan||'').toUpperCase())?String(expectedPlan).toUpperCase():null;
    const needsRetry=()=>retry&&['FREE','STARTER'].includes(String(data.workspace?.plan||'').toUpperCase())||expectedCancel!==null&&Boolean(data.subscription?.cancelAtPeriodEnd)!==expectedCancel||normalizedExpectedPlan&&String(data.workspace?.plan||'').toUpperCase()!==normalizedExpectedPlan;
    for(let i=0;i<5&&needsRetry();i++){await new Promise(r=>setTimeout(r,1200));data=await getBillingStatus();}
    const sub=data.subscription;
    const backendPending=expectedCancel!==null&&Boolean(sub?.cancelAtPeriodEnd)!==expectedCancel;
    const planPending=Boolean(normalizedExpectedPlan&&String(data.workspace?.plan||'').toUpperCase()!==normalizedExpectedPlan);
    const pending=backendPending&&stripeFallback?Boolean(stripeFallback.cancelAtPeriodEnd):Boolean(sub?.cancelAtPeriodEnd);
    const periodEnd=backendPending&&stripeFallback?.currentPeriodEnd?stripeFallback.currentPeriodEnd:sub?.currentPeriodEnd;
    $('#billingState').textContent=sub?billingStateLabel(sub.status):'FREE';
    $('#billingEnd').textContent=fmtDate(periodEnd);
    $('#plan').textContent=data.workspace?.plan||$('#plan').textContent;
    const managed=Boolean(sub?.managedByStripe),activeLike=['active','trialing','past_due'].includes(String(sub?.status||'').toLowerCase());
    $('#cancelBilling').hidden=!managed||pending||!activeLike;
    $('#resumeBilling').hidden=!managed||!pending||!activeLike;
    $('#cancelBilling').disabled=false;
    $('#resumeBilling').disabled=false;
    if(backendPending&&stripeFallback){message.textContent=expectedCancel?`Stripe a confirmat anularea programată până la ${fmtDate(periodEnd)}. Statusul contului se actualizează după webhook; accesul rămâne controlat exclusiv de starea verificată Stripe.`:'Stripe a confirmat retragerea anulării. Statusul contului se actualizează după webhook; accesul rămâne controlat exclusiv de starea verificată Stripe.';return;}
    if(planPending){message.textContent=`Stripe a confirmat schimbarea către ${normalizedExpectedPlan}. Planul afișat rămâne starea verificată până când webhook-ul Stripe finalizează sincronizarea.`;return;}
    message.textContent=pending?`Anulare programată. Accesul rămâne activ până la ${fmtDate(periodEnd)}. Poți retrage anularea înainte de această dată.`:managed?'Abonamentul este activ și poate fi schimbat din pagina de planuri.':'Nu există încă un abonament plătit activ.';
  }catch(e){message.textContent=stripeFallback?'Stripe a confirmat acțiunea, dar statusul contului nu a putut fi reîncărcat momentan. Entitlement-ul nu este modificat din browser.':'Informațiile despre abonament nu sunt disponibile momentan.';$('#cancelBilling').disabled=false;$('#resumeBilling').disabled=false;}
}
async function load(){
  if(!isSaasConfigured(SAAS_CONFIG)){ $('#authStatus').textContent='Indisponibil'; return; }
  $('#foundation').hidden=true;
  const session=await getCurrentSession();
  if(!session){
    if(recoveryRequested){$('#recoveryCard').hidden=false;$('#completeRecovery').disabled=true;$('#authStatus').textContent='Link invalid sau expirat';recoveryMessage('Linkul de recuperare nu mai are o sesiune validă. Solicită un link nou din pagina de login.','error');return;}
    location.href='login.html';return;
  }
  if(recoveryRequested){$('#recoveryCard').hidden=false;recoveryMessage('Sesiune de recuperare validă. Poți seta parola nouă.');}
  $('#email').textContent=session.user.email||session.user.id;
  $('#authStatus').textContent='Autentificat';
  try{await installCloudAutosync({hydrate:true,reloadOnHydrate:false});const ws=await ensurePersonalWorkspace('My Radar');$('#workspace').textContent=ws.name||'My Radar';$('#plan').textContent=ws.plan||'FREE';$('#status').textContent='Datele contului sunt sincronizate în siguranță și păstrate separat pentru contul tău.';refreshLocalCount();syncMessage('Sincronizarea automată este activă.','AUTO');}catch(e){$('#status').textContent='Sincronizarea datelor nu este disponibilă momentan.';}
  const qs=new URLSearchParams(location.search);const billingResult=qs.get('billing');await refreshBilling({retry:billingResult==='success',expectedPlan:billingResult==='changed'?qs.get('plan'):null});
}
$('#completeRecovery').addEventListener('click',async()=>{
  $('#completeRecovery').disabled=true;
  try{
    const before=await getCurrentSession();if(!before)throw new Error('Sesiunea de recuperare a expirat. Solicită un link nou.');
    const password=$('#newPassword').value,confirmation=$('#confirmPassword').value;validateNewPassword(password,confirmation);
    recoveryMessage('Actualizare parolă...');await updatePassword(password);
    const after=await getCurrentSession();if(!after||after.user.id!==before.user.id)throw new Error('Parola a fost actualizată, dar sesiunea nu a putut fi reconfirmată. Autentifică-te din nou.');
    history.replaceState({},'',new URL('account.html',location.href));
    $('#newPassword').value='';$('#confirmPassword').value='';
    recoveryMessage('Parola a fost actualizată. Sesiunea contului a rămas activă și a fost reconfirmată.','ok');
  }catch(e){recoveryMessage(e.message||'Actualizarea parolei nu a reușit.','error');}
  finally{$('#completeRecovery').disabled=false;}
});
$('#cloudPush').addEventListener('click',async()=>{
  if(!confirm('Trimiți datele locale curente în cloud? Copia cloud pentru cele 7 categorii va fi înlocuită.'))return;
  $('#cloudPush').disabled=true;syncMessage('Sincronizare în curs…','Push');
  try{const r=await pushLocalToCloud();syncMessage(`Sincronizare reușită: ${r.total} înregistrări salvate.`, 'OK');}
  catch(e){syncMessage('Sincronizarea nu a reușit. Încearcă din nou.','Eroare');}
  finally{$('#cloudPush').disabled=false;refreshLocalCount();}
});
$('#cloudPull').addEventListener('click',async()=>{
  if(!confirm('Descarci copia cloud? Datele locale din cele 7 categorii vor fi înlocuite.'))return;
  $('#cloudPull').disabled=true;syncMessage('Descărcare în curs…','Pull');
  try{const r=await pullCloudToLocal();syncMessage(`Restaurare reușită: ${r.total} înregistrări.`, 'OK');}
  catch(e){syncMessage('Restaurarea nu a reușit. Încearcă din nou.','Eroare');}
  finally{$('#cloudPull').disabled=false;refreshLocalCount();}
});
$('#cancelBilling').addEventListener('click',async()=>{
  if(!confirm('Anulezi abonamentul la finalul perioadei curente? Accesul rămâne activ până atunci.'))return;
  $('#cancelBilling').disabled=true;
  try{const stripe=await cancelSubscription();await refreshBilling({expectedCancel:true,stripeFallback:stripe});}catch(e){$('#billingMessage').textContent='Anularea nu a reușit. Încearcă din nou.';$('#cancelBilling').disabled=false;}
});
$('#resumeBilling').addEventListener('click',async()=>{
  if(!confirm('Retragi anularea programată și păstrezi abonamentul activ?'))return;
  $('#resumeBilling').disabled=true;
  try{const stripe=await resumeSubscription();await refreshBilling({expectedCancel:false,stripeFallback:stripe});}catch(e){$('#billingMessage').textContent='Retragerea anulării nu a reușit. Încearcă din nou.';$('#resumeBilling').disabled=false;}
});
$('#logout').addEventListener('click',async()=>{await signOut();location.href='login.html';});
load();
