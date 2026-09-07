import {getCurrentSession,signOut} from './supabase-client.js';

const $=selector=>document.querySelector(selector);
async function authHeaders(){const session=await getCurrentSession();if(!session?.access_token)throw new Error('Sesiunea a expirat. Autentifică-te din nou.');return {authorization:`Bearer ${session.access_token}`};}
function status(message,kind=''){const el=$('#privacyActionStatus');if(!el)return;el.textContent=message;el.dataset.kind=kind;}

$('#exportAccountData')?.addEventListener('click',async()=>{
  const button=$('#exportAccountData');button.disabled=true;status('Pregătesc exportul…');
  try{
    const response=await fetch('/api/account/export',{headers:await authHeaders(),cache:'no-store'});
    if(!response.ok)throw new Error('Exportul nu a putut fi generat.');
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mega-product-radar-account-export.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);status('Exportul a fost generat.','ok');
  }catch(error){status(error.message||'Exportul nu a reușit.','error');}
  finally{button.disabled=false;}
});

$('#deleteAccount')?.addEventListener('click',async()=>{
  const phrase=prompt('Ștergerea este definitivă. Pentru confirmare scrie exact: DELETE MY ACCOUNT');
  if(phrase===null)return;
  if(phrase!=='DELETE MY ACCOUNT'){status('Confirmarea nu corespunde. Contul nu a fost șters.','error');return;}
  if(!confirm('Confirmi ștergerea definitivă a contului și a workspace-urilor deținute?'))return;
  const button=$('#deleteAccount');button.disabled=true;status('Ștergere în curs…');
  try{
    const headers={...(await authHeaders()),'content-type':'application/json'};
    const response=await fetch('/api/account/delete',{method:'POST',headers,body:JSON.stringify({confirmation:phrase}),cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Ștergerea contului nu a reușit.');
    try{await signOut();}catch{}
    location.replace('beta.html?account=deleted');
  }catch(error){status(error.message||'Ștergerea contului nu a reușit.','error');button.disabled=false;}
});
