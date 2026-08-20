import {getCurrentSession,getSupabaseClient} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {trackJourneyEvent} from './journey-events.js';

const $=s=>document.querySelector(s);

async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=beta-feedback.html';return;}
  $('#email').textContent=session.user.email||'Cont autentificat';
  await trackJourneyEvent('BETA_FEEDBACK_VIEW');
}

$('#feedbackForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('#submit');
  const status=$('#status');
  button.disabled=true;status.textContent='Trimitem feedback-ul…';
  try{
    const session=await getCurrentSession();
    if(!session)throw new Error('Autentificare necesară.');
    const message=$('#message').value.trim();
    if(message.length<10)throw new Error('Scrie minimum 10 caractere ca să putem folosi feedback-ul.');
    const client=await getSupabaseClient();
    const ws=await ensurePersonalWorkspace('My Radar');
    const row={
      workspace_id:ws.id,
      user_id:session.user.id,
      rating:Number($('#rating').value),
      area:$('#area').value,
      message,
      would_pay:$('#wouldPay').value==='YES'?true:$('#wouldPay').value==='NO'?false:null,
      requested_feature:$('#requestedFeature').value.trim().slice(0,500)||null,
      metadata:{plan:String(ws.plan||'FREE'),source:'beta-feedback.html'}
    };
    const {error}=await client.from('beta_feedback').insert(row);
    if(error)throw error;
    await trackJourneyEvent('BETA_FEEDBACK_SUBMITTED',{rating:row.rating,area:row.area,wouldPay:row.would_pay});
    $('#feedbackForm').reset();
    status.textContent='Mulțumim. Feedback-ul a fost salvat și va intra în prioritizarea beta.';
  }catch(error){status.textContent=`Eroare: ${error.message||error}`;}
  finally{button.disabled=false;}
});

load().catch(error=>{$('#status').textContent=`Eroare: ${error.message||error}`;});
