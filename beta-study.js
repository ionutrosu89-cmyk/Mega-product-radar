import {trackJourneyEvent} from './journey-events.js';
import {buildBetaStudyMetadata} from './beta-study-answers.js';
document.querySelector('#study').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),status=document.querySelector('#status');
 if(button.disabled)return;
 button.disabled=true;
 try{
  let metadata;
  try{metadata=buildBetaStudyMetadata(new FormData(form));}
  catch(error){status.textContent=error.message;return;}
  const saved=await trackJourneyEvent('BETA_VALIDATION_SESSION',metadata);
  status.textContent=saved?'Evaluarea a fost salvată. Mulțumim!':'Evaluarea nu a fost salvată. Autentifică-te și încearcă din nou.';
 }catch{
  status.textContent='Evaluarea nu a fost salvată. Verifică conexiunea și încearcă din nou.';
 }finally{button.disabled=false;}
});
