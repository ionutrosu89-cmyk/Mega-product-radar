import {SAAS_CONFIG,isSaasConfigured} from './saas-config.js';
import {getCurrentSession,signOut} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
const $=s=>document.querySelector(s);
async function load(){
  if(!isSaasConfigured(SAAS_CONFIG)){ $('#authStatus').textContent='FOUNDATION'; return; }
  $('#foundation').hidden=true;
  const session=await getCurrentSession();
  if(!session){location.href='login.html';return;}
  $('#email').textContent=session.user.email||session.user.id;
  $('#authStatus').textContent='Autentificat';
  try{const ws=await ensurePersonalWorkspace('My Radar');$('#workspace').textContent=ws.name||'My Radar';$('#plan').textContent=ws.plan||'STARTER';$('#status').textContent='Workspace cloud activ si separat prin RLS.';}catch(e){$('#status').textContent=e.message;}
}
$('#logout').addEventListener('click',async()=>{await signOut();location.href='login.html';});
load();
